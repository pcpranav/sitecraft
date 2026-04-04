"use client";
import React, { useRef, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';

export default function PreviewFrame() {
  const {
    currentHtml, pages, css, js, currentFile, view,
    setPages, setCss, setJs,
  } = useAppContext();
  const iframeRef = useRef(null);

  const hasContent = !!currentHtml || Object.keys(pages).length > 0;

  // Get the HTML to display
  const getDisplayHtml = () => {
    if (currentHtml) return currentHtml;
    const htmlContent = pages[currentFile] || '';
    const isFullDoc = htmlContent.trimStart().toLowerCase().startsWith('<!doctype') || htmlContent.trimStart().toLowerCase().startsWith('<html');
    if (isFullDoc) return htmlContent;
    if (htmlContent) {
      return `<!DOCTYPE html>\n<html>\n<head><style>${css}</style></head>\n<body>\n${htmlContent}\n<script>${js}<\/script>\n</body>\n</html>`;
    }
    return '';
  };

  // Update iframe whenever code changes
  useEffect(() => {
    if (view !== 'preview' || !hasContent) return;

    const timer = setTimeout(() => {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      const fullHTML = getDisplayHtml();
      doc.open();
      doc.write(fullHTML);
      doc.close();
    }, 150);

    return () => clearTimeout(timer);
  }, [currentHtml, pages, css, js, currentFile, view, hasContent]);

  const handleCodeChange = (e) => {
    const newVal = e.target.value;
    if (currentFile === 'shared.css') setCss(newVal);
    else if (currentFile === 'shared.js') setJs(newVal);
    else setPages(prev => ({ ...prev, [currentFile]: newVal }));
  };

  const getCodeValue = () => {
    if (currentHtml && currentFile === 'index.html') return currentHtml;
    if (currentFile === 'shared.css') return css;
    if (currentFile === 'shared.js') return js;
    return pages[currentFile] || '';
  };

  // Empty state — handled by sidebar chat now, just show a subtle message
  if (!hasContent && view === 'preview') {
    return (
      <div className="preview">
        <div className="preview-empty">
          <div className="preview-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="9" y1="21" x2="9" y2="9"/>
            </svg>
          </div>
          <p>Your website preview will appear here</p>
          <span>Start a conversation in the sidebar to generate your site</span>
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
