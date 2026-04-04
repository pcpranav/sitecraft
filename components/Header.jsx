"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAppContext } from '@/context/AppContext';
import AuthModal from './AuthModal';
import JSZip from 'jszip';

export default function Header() {
  const {
    user, supabaseClient, theme, setTheme, view, setView,
    isAuthOpen, setIsAuthOpen, pages, setPages, setCss, setJs,
    setDesc, setHistory, setProjectId,
    sidebarOpen, setSidebarOpen, setCurrentFile,
    currentHtml, setCurrentHtml, setChatMessages, setFeatures, setImageUrls
  } = useAppContext();

  const [menuOpen, setMenuOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  // Fetch projects when dropdown opens
  useEffect(() => {
    if (!menuOpen || !user || !supabaseClient) return;
    (async () => {
      setLoadingProjects(true);
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch('/api/projects', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        const data = await res.json();
        if (res.ok && data.projects) setProjects(data.projects);
      } catch (e) { console.warn('Failed to load projects:', e); }
      finally { setLoadingProjects(false); }
    })();
  }, [menuOpen, user, supabaseClient]);

  const loadProject = async (proj) => {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const res = await fetch(`/api/projects/${proj.id}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      if (res.ok && data.project) {
        const p = data.project;
        setPages(p.pages || {});
        setCss(p.shared_css || '');
        setJs(p.shared_js || '');
        setDesc(p.description || '');
        setHistory(p.history || []);
        setProjectId(p.id);
        setCurrentFile('index.html');
        setMenuOpen(false);
      }
    } catch (e) { console.warn('Failed to load project:', e); }
  };

  const getUserInitial = () => {
    const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email;
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  const getUserDisplay = () => {
    return user?.user_metadata?.full_name || user?.user_metadata?.name || null;
  };

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
      setCurrentHtml('');
      setChatMessages([]);
      setFeatures([]);
      setImageUrls([]);
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
          const exportHtml = currentHtml || Object.values(pages)[0];
          if (!exportHtml) {
            alert('No website to export. Generate one first.');
            return;
          }
          const zip = new JSZip();
          zip.file('index.html', exportHtml);
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
          <div className="user-pill-wrap" ref={menuRef}>
            <button className="user-pill" onClick={() => setMenuOpen(!menuOpen)}>
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} className="user-avatar-img" alt="" />
              ) : (
                <div className="user-avatar">{getUserInitial()}</div>
              )}
              <span className="user-pill-name">{getUserDisplay() || 'Account'}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div className={`user-dropdown ${menuOpen ? 'open' : ''}`}>
              <div className="ud-header">
                <div className="ud-name">{getUserDisplay() || 'User'}</div>
                <div className="ud-email">{user.email}</div>
              </div>
              <div className="ud-divider" />
              <div className="ud-section-label">Recent projects</div>
              <div className="ud-projects">
                {loadingProjects ? (
                  <div className="ud-item" style={{ justifyContent: 'center', color: 'var(--muted)' }}>
                    <div className="gen-spinner" style={{ width: 12, height: 12 }}></div>
                    Loading...
                  </div>
                ) : projects.length === 0 ? (
                  <div className="ud-empty">No projects yet</div>
                ) : (
                  projects.slice(0, 5).map(p => (
                    <button key={p.id} className="ud-item" onClick={() => loadProject(p)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                      <span className="ud-proj-name">{p.name || 'Untitled'}</span>
                    </button>
                  ))
                )}
              </div>
              <div className="ud-divider" />
              <button className="ud-item danger" onClick={() => { setMenuOpen(false); handleSignOut(); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <button className="hdr-btn" onClick={() => setIsAuthOpen(true)}>Sign in</button>
        )}
      </header>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
}
