"use client";
import React, { useRef, useEffect, useState } from 'react';
import { useAppContext } from '@/context/AppContext';

const QUICK_IDEAS = [
  'A bakery with menu and online ordering',
  'Portfolio for a freelance designer',
  'Landing page for a fitness app',
  'Restaurant with reservations and gallery',
  'Tech startup with pricing and features',
  'Wedding photographer portfolio',
];

export default function PreviewFrame() {
  const {
    pages, css, js, currentFile, view, setPages, setCss, setJs,
    setDesc, setCurrentFile, setTotalTokens,
    history, setHistory, selectedModel, user
  } = useAppContext();
  const iframeRef = useRef(null);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  const hasContent = Object.keys(pages).length > 0;

  // Update iframe whenever code changes
  useEffect(() => {
    if (view !== 'preview' || !hasContent) return;

    const timer = setTimeout(() => {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;

      const htmlContent = pages[currentFile] || '';
      const isFullDoc = htmlContent.trimStart().startsWith('<!DOCTYPE') || htmlContent.trimStart().startsWith('<html');

      let fullHTML;
      if (isFullDoc) {
        fullHTML = htmlContent;
      } else if (htmlContent) {
        fullHTML = `<!DOCTYPE html>
<html>
<head><style>${css}</style></head>
<body>
${htmlContent}
<script>${js}<\/script>
</body>
</html>`;
      } else {
        fullHTML = '<!DOCTYPE html><html><body></body></html>';
      }

      doc.open();
      doc.write(fullHTML);
      doc.close();
    }, 150);

    return () => clearTimeout(timer);
  }, [pages, css, js, currentFile, view, hasContent]);

  const generateSite = async () => {
    if (!prompt.trim()) return;
    setDesc(prompt);
    setLoading(true);
    const msgs = [
      'Thinking about your website...',
      'Sketching out the layout...',
      'Picking the right colors and fonts...',
      'Writing clean, semantic HTML...',
      'Styling everything to look great...',
      'Adding interactive elements...',
      'Making it responsive for all screens...',
      'Polishing the little details...',
      'Almost there, just finishing up...',
      'Running a final check...',
    ];
    setLoadingMsg(msgs[0]);

    let cycleCount = 0;
    const interval = setInterval(() => {
      cycleCount++;
      setLoadingMsg(msgs[Math.min(cycleCount, msgs.length - 1)]);
    }, 3500);

    try {
      const providerMap = { 'gemini-2.5-flash': 'gemini', 'llama-3.3-70b-versatile': 'groq' };
      const provider = providerMap[selectedModel] || 'gemini';
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, isEdit: false, pages: {}, css: '', js: '', currentFile: 'index.html', model: selectedModel, provider })
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error('Unexpected response from server'); }
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');

      setPages(data.pages || {});
      setCss(data.shared_css || '');
      setJs(data.shared_js || '');
      setCurrentFile('index.html');
      setTotalTokens(prev => prev + (data.tokens || 0));

      const newHistory = [{ prompt, pages: data.pages || {}, css: data.shared_css || '', js: data.shared_js || '', ts: Date.now() }, ...history];
      setHistory(newHistory);
    } catch (e) {
      alert("Generation failed: " + (e.message || 'Unknown error. Try a different model.'));
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  const handleCodeChange = (e) => {
    const newVal = e.target.value;
    if (currentFile === 'shared.css') setCss(newVal);
    else if (currentFile === 'shared.js') setJs(newVal);
    else setPages({ ...pages, [currentFile]: newVal });
  };

  const getCodeValue = () => {
    if (currentFile === 'shared.css') return css;
    if (currentFile === 'shared.js') return js;
    return pages[currentFile] || '';
  };

  // Empty state — show prompt input directly
  if (!hasContent && view === 'preview') {
    return (
      <div className="preview">
        <div className="empty-prompt-wrap">
          <h2>{user ? `Hey ${user.user_metadata?.full_name?.split(' ')[0] || user.user_metadata?.name?.split(' ')[0] || user.email?.split('@')[0] || 'there'}! What are we building?` : 'What website do you want to build?'}</h2>
          <p>Describe your idea and we'll generate a complete website in seconds.</p>
          <textarea
            className="empty-prompt-input"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="e.g. A bakery website with a menu, photo gallery, and online ordering form..."
            disabled={loading}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generateSite(); } }}
          />
          <button
            className="btn btn-primary btn-full empty-prompt-btn"
            onClick={generateSite}
            disabled={loading || !prompt.trim()}
          >
            {loading ? loadingMsg : 'Generate website'}
          </button>

          {!prompt && !loading && (
            <div className="quick-ideas">
              <span className="quick-ideas-label">Try an idea:</span>
              <div className="quick-ideas-list">
                {QUICK_IDEAS.map((idea, i) => (
                  <button key={i} className="quick-idea" onClick={() => setPrompt(idea)}>{idea}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="preview">
      {view === 'preview' ? (
        <iframe
          ref={iframeRef}
          sandbox="allow-scripts allow-same-origin"
          style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
          title="Preview"
        />
      ) : (
        <textarea
          className="code-editor"
          value={getCodeValue()}
          onChange={handleCodeChange}
          spellCheck={false}
          style={{
            width: '100%', height: '100%', padding: '16px',
            fontFamily: 'var(--font-mono)', fontSize: '13px',
            background: 'var(--bg)', color: 'var(--body)',
            border: 'none', outline: 'none', resize: 'none'
          }}
        />
      )}
    </div>
  );
}
