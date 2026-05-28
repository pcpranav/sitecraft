// lib/html-extract.js
// Used by /api/ai (full extraction on stream completion) and by Sidebar
// (lenient partial extraction during streaming).

const HTML_FENCE_RE = /```[a-zA-Z]*\s*\n?([\s\S]*?)\n?```/g;

function looksLikeHtml(s) {
  const l = s.toLowerCase();
  return l.includes('<!doctype') || l.includes('<html');
}

// Lenient extractor for partial / in-flight model output. Drops any
// markdown fencing prefix and slices from the first <!doctype/<html
// onward. Returns whatever HTML-ish content is available so an iframe
// can render it as the model writes.
export function extractPartialHtml(rawText) {
  if (!rawText) return '';

  // If a fence has opened, the inner content is what we want even before it closes.
  const fenceStart = rawText.indexOf('```');
  let candidate = rawText;
  if (fenceStart !== -1) {
    const afterFence = rawText.indexOf('\n', fenceStart);
    if (afterFence !== -1) candidate = rawText.slice(afterFence + 1);
  }

  const lower = candidate.toLowerCase();
  const docIdx = lower.indexOf('<!doctype');
  const htmlIdx = lower.indexOf('<html');
  const startIdx = docIdx !== -1 ? docIdx : htmlIdx;
  if (startIdx > 0) candidate = candidate.slice(startIdx);

  return candidate;
}

// Strict extractor for the final response. Picks the largest fenced block
// containing HTML markers (handles models that emit an explanation block
// before the real HTML), then slices to a closing </html> if present.
export function extractHtml(rawText) {
  if (!rawText) return '';

  HTML_FENCE_RE.lastIndex = 0;
  const blocks = [];
  let m;
  while ((m = HTML_FENCE_RE.exec(rawText)) !== null) blocks.push(m[1].trim());

  let candidate = rawText;
  if (blocks.length) {
    const htmlBlocks = blocks.filter(looksLikeHtml);
    if (htmlBlocks.length) {
      candidate = htmlBlocks.reduce((a, b) => (b.length > a.length ? b : a));
    } else if (blocks.length === 1) {
      candidate = blocks[0];
    }
  }

  const lower = candidate.toLowerCase();
  const docIdx = lower.indexOf('<!doctype');
  const htmlIdx = lower.indexOf('<html');
  const startIdx = docIdx !== -1 ? docIdx : htmlIdx;
  if (startIdx > 0) candidate = candidate.slice(startIdx);

  const endIdx = candidate.toLowerCase().lastIndexOf('</html>');
  if (endIdx !== -1) candidate = candidate.slice(0, endIdx + 7);

  if (!looksLikeHtml(candidate)) return '';
  return candidate.trim();
}
