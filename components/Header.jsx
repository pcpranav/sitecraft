"use client";
import React from 'react';
import Link from 'next/link';
import { useAppContext } from '@/context/AppContext';
import AuthModal from './AuthModal';
import JSZip from 'jszip';

export default function Header() {
  const {
    user, supabaseClient, theme, setTheme, view, setView,
    isAuthOpen, setIsAuthOpen, pages, setPages, css, setCss, js, setJs,
    setDesc, setHistory, setProjectId, sidebarOpen, setSidebarOpen
  } = useAppContext();

  const handleSignOut = async () => {
    if (!supabaseClient) return;
    try {
      await supabaseClient.auth.signOut();
      setPages({});
      setCss('');
      setJs('');
      setDesc('');
      setHistory([]);
      setProjectId(null);
      sessionStorage.removeItem('WEBCRAFT_PROJECT');
    } catch (e) {
      console.error('Sign out failed:', e);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('WEBCRAFT_THEME', newTheme);
  };

  return (
    <>
      <header className="header">
        <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <Link href="/" className="logo">
          <div className="logo-icon">W</div>
          <div className="logo-text">Webcraft<span>STUDIO</span></div>
        </Link>

        <div style={{ flex: 1 }}></div>

        <button className="hdr-btn" onClick={async () => {
          if (!user) {
            setIsAuthOpen(true);
            return;
          }
          if (!Object.keys(pages).length) {
            alert('No pages to export. Generate a website first.');
            return;
          }
          const zip = new JSZip();
          Object.entries(pages).forEach(([filename, content]) => {
            const isFullDoc = content.trimStart().startsWith('<!DOCTYPE') || content.trimStart().startsWith('<html');
            if (isFullDoc) {
              zip.file(filename, content);
            } else {
              zip.file(filename, `<!DOCTYPE html>\n<html>\n<head>\n<link rel="stylesheet" href="style.css">\n</head>\n<body>\n${content}\n<script src="script.js"></script>\n</body>\n</html>`);
            }
          });
          if (css) zip.file('style.css', css);
          if (js) zip.file('script.js', js);
          const blob = await zip.generateAsync({type:"blob"});
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = 'webcraft-project.zip';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }}>
          ⬇ <span className="export-label">Export</span>
        </button>

        <button
          className="hdr-btn code-toggle"
          onClick={() => setView(view === 'preview' ? 'code' : 'preview')}
          style={{
            color: view === 'code' ? 'var(--heading)' : '',
            background: view === 'code' ? 'var(--card)' : ''
          }}
        >
          &lt;&gt; code
        </button>

        <button className="theme-btn" onClick={toggleTheme}>
          {theme === 'dark' ? '☾' : '☼'}
        </button>

        {user ? (
          <button className="hdr-btn" onClick={handleSignOut}>Sign out</button>
        ) : (
          <button className="hdr-btn" onClick={() => setIsAuthOpen(true)}>Sign in</button>
        )}
      </header>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
}
