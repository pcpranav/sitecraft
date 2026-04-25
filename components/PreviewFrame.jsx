"use client";
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';

const VIEWPORTS = {
  desktop: { label: 'Desktop', width: '100%' },
  tablet: { label: 'Tablet', width: '768px' },
  mobile: { label: 'Mobile', width: '375px' },
};

export default function PreviewFrame() {
  const {
    currentHtml, pages, css, js, currentFile, view,
    setPages, setCss, setJs, setCurrentHtml,
  } = useAppContext();
  const iframeRef = useRef(null);
  const [imageStatus, setImageStatus] = useState(null); // { total, loaded, failed, failedSrcs }
  const [showImagePanel, setShowImagePanel] = useState(false);
  const [viewport, setViewport] = useState('desktop');

  const hasContent = !!currentHtml || Object.keys(pages).length > 0;

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

  const displayHtml = getDisplayHtml();

  // Check image load status after iframe renders
  const checkImages = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;
      const imgs = doc.querySelectorAll('img');
      if (imgs.length === 0) {
        setImageStatus(null);
        setShowImagePanel(false);
        return;
      }
      let loaded = 0, failed = 0;
      const failedSrcs = [];
      imgs.forEach(img => {
        if (img.complete) {
          if (img.naturalWidth > 0) loaded++;
          else { failed++; failedSrcs.push(img.src); }
        }
      });
      const pending = imgs.length - loaded - failed;
      setImageStatus({ total: imgs.length, loaded, failed, pending, failedSrcs });
      if (failed > 0) setShowImagePanel(true);
    } catch (e) {
      // Cross-origin restrictions
    }
  }, []);

  useEffect(() => {
    if (!displayHtml || view !== 'preview') return;
    // Reset status when HTML changes
    setImageStatus(null);
    setShowImagePanel(false);
    // Check after iframe loads
    const timer = setTimeout(checkImages, 2000);
    const timer2 = setTimeout(checkImages, 5000);
    return () => { clearTimeout(timer); clearTimeout(timer2); };
  }, [displayHtml, view, checkImages]);

  const handleIframeLoad = () => {
    setTimeout(checkImages, 1000);
  };

  // Replace failed images with working placeholders
  const fixFailedImages = () => {
    if (!imageStatus?.failedSrcs?.length) return;
    let html = currentHtml || pages[currentFile] || '';
    imageStatus.failedSrcs.forEach((src, i) => {
      // Extract the part after the domain to identify in source
      const urlObj = (() => { try { return new URL(src); } catch { return null; } })();
      if (!urlObj) return;
      const searchStr = urlObj.pathname + urlObj.search;
      // Replace with a placehold.co fallback
      const color = ['3b82f6', '8b5cf6', '10b981', 'eab308', 'ef4444'][i % 5];
      const replacement = `https://placehold.co/800x500/${color}/ffffff?text=Image+${i + 1}`;
      html = html.replace(new RegExp(escapeRegExp(src), 'g'), replacement);
      // Also try matching just the path portion in case src was relative
      if (searchStr) {
        html = html.replace(new RegExp(escapeRegExp(searchStr), 'g'), replacement);
      }
    });
    setCurrentHtml(html);
    setPages(prev => ({ ...prev, 'index.html': html }));
    setImageStatus(null);
    setShowImagePanel(false);
  };

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
        <>
          <div className="viewport-toolbar">
            {Object.entries(VIEWPORTS).map(([key, vp]) => (
              <button
                key={key}
                className={`viewport-btn ${viewport === key ? 'active' : ''}`}
                onClick={() => setViewport(key)}
                title={`${vp.label} (${vp.width})`}
              >
                {vp.label}
              </button>
            ))}
          </div>
          <div className="iframe-stage">
            <iframe
              ref={iframeRef}
              srcDoc={displayHtml}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              referrerPolicy="no-referrer"
              style={{
                width: '100%',
                maxWidth: VIEWPORTS[viewport].width,
                height: '100%',
                border: 'none',
                background: '#fff',
                margin: '0 auto',
                display: 'block',
                boxShadow: viewport === 'desktop' ? 'none' : '0 0 0 1px rgba(255,255,255,0.06)',
              }}
              title="Preview"
              onLoad={handleIframeLoad}
            />
          </div>
          {/* Image status bar */}
          {imageStatus && imageStatus.total > 0 && (
            <div className="image-status-bar">
              <button
                className="image-status-toggle"
                onClick={() => setShowImagePanel(!showImagePanel)}
              >
                <span className={`image-status-dot ${imageStatus.failed > 0 ? 'warn' : 'ok'}`}></span>
                <span>
                  Images: {imageStatus.loaded}/{imageStatus.total} loaded
                  {imageStatus.failed > 0 && ` · ${imageStatus.failed} failed`}
                  {imageStatus.pending > 0 && ` · ${imageStatus.pending} loading`}
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ transform: showImagePanel ? 'rotate(180deg)' : '', transition: 'transform .15s' }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {showImagePanel && (
                <div className="image-status-panel">
                  {imageStatus.failed > 0 && (
                    <>
                      <p className="image-status-desc">
                        {imageStatus.failed} image{imageStatus.failed > 1 ? 's' : ''} failed to load.
                      </p>
                      <div className="image-status-actions">
                        <button className="img-action-btn" onClick={fixFailedImages}>
                          Replace failed with placeholders
                        </button>
                        <button className="img-action-btn" onClick={() => { checkImages(); }}>
                          Re-check
                        </button>
                        <button className="img-action-btn secondary" onClick={() => setShowImagePanel(false)}>
                          Dismiss
                        </button>
                      </div>
                    </>
                  )}
                  {imageStatus.failed === 0 && (
                    <p className="image-status-desc ok">All {imageStatus.total} images loaded successfully.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </>
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

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
