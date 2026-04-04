"use client";
import React, { useRef, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';

export default function PreviewFrame() {
  const { pages, css, js, currentFile, view, setPages, setCss, setJs } = useAppContext();
  const iframeRef = useRef(null);

  // Update iframe whenever code changes but ONLY if we are in preview mode
  useEffect(() => {
    if (view !== 'preview') return;

    // De-bounce slightly
    const timer = setTimeout(() => {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;

      const htmlContent = pages[currentFile] || '';
      const isFullDoc = htmlContent.trimStart().startsWith('<!DOCTYPE') || htmlContent.trimStart().startsWith('<html');

      let fullHTML;
      if (isFullDoc) {
        // AI returned a complete HTML document — use it directly
        fullHTML = htmlContent;
      } else if (htmlContent) {
        // Body fragment — wrap it with shared CSS/JS
        fullHTML = `<!DOCTYPE html>
<html>
<head><style>${css}</style></head>
<body>
${htmlContent}
<script>${js}<\/script>
</body>
</html>`;
      } else {
        // Empty state — onboarding for new users
        fullHTML = `<!DOCTYPE html>
<html>
<head><style>
body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fafafa;color:#666;}
.wrap{text-align:center;max-width:380px;padding:40px 20px;}
h1{font-size:22px;font-weight:600;color:#222;margin-bottom:8px;}
p{font-size:14px;line-height:1.6;margin-bottom:24px;}
.steps{display:flex;flex-direction:column;gap:12px;text-align:left;}
.step{display:flex;gap:10px;align-items:flex-start;font-size:13px;color:#555;}
.num{width:22px;height:22px;border-radius:50%;background:#222;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;}
</style></head>
<body>
<div class="wrap">
<h1>Your website preview</h1>
<p>Describe what you want in the sidebar and click Generate. Your website will appear here.</p>
<div class="steps">
<div class="step"><div class="num">1</div><span>Type a description in the sidebar, e.g. "A bakery website with menu and ordering"</span></div>
<div class="step"><div class="num">2</div><span>Click <b>Generate website</b> and wait a few seconds</span></div>
<div class="step"><div class="num">3</div><span>Your site appears here — edit, export, or regenerate</span></div>
</div>
</div>
</body>
</html>`;
      }

      doc.open();
      doc.write(fullHTML);
      doc.close();
    }, 150);

    return () => clearTimeout(timer);
  }, [pages, css, js, currentFile, view]);

  const handleCodeChange = (e) => {
    const newVal = e.target.value;
    if (currentFile === 'shared.css') {
      setCss(newVal);
    } else if (currentFile === 'shared.js') {
      setJs(newVal);
    } else {
      setPages({ ...pages, [currentFile]: newVal });
    }
  };

  const getCodeValue = () => {
    if (currentFile === 'shared.css') return css;
    if (currentFile === 'shared.js') return js;
    return pages[currentFile] || '';
  };

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
