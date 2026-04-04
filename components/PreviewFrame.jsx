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
        // Empty state
        fullHTML = `<!DOCTYPE html>
<html>
<head><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;color:#888;}</style></head>
<body>
<div style="text-align:center"><h1 style="font-size:20px;font-weight:600;color:#333">Welcome to Webcraft Studio</h1><p>Generate a site to begin.</p></div>
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
