"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAppContext } from '@/context/AppContext';
import { signOut } from 'next-auth/react';
import AuthModal from './AuthModal';
import JSZip from 'jszip';

export default function Header() {
  const {
    user, theme, setTheme, view, setView,
    isAuthOpen, setIsAuthOpen, pages, setPages, setCss, setJs,
    setDesc, setHistory, setProjectId, projectId,
    sidebarOpen, setSidebarOpen, setCurrentFile,
    currentHtml, setCurrentHtml, setChatMessages, setFeatures, setImageUrls,
    chatMessages,
  } = useAppContext();

  const [menuOpen, setMenuOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
        setConfirmDeleteId(null);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen || !user) return;
    fetchProjects();
  }, [menuOpen, user]);

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (res.ok && data.projects) setProjects(data.projects);
    } catch (e) { console.warn('Failed to load projects:', e); }
    finally { setLoadingProjects(false); }
  };

  const loadProject = async (proj) => {
    try {
      const res = await fetch(`/api/projects/${proj.id}`);
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
        // Restore currentHtml from pages
        const html = p.pages?.['index.html'] || '';
        setCurrentHtml(html);
        // Restore chat if available, otherwise create a summary
        if (p.chatMessages) {
          setChatMessages(p.chatMessages);
        } else {
          setChatMessages([
            { id: 1, role: 'user', content: p.description || 'Loaded project', timestamp: Date.now() },
            { id: 2, role: 'assistant', content: 'Project loaded. You can ask me to make changes.', timestamp: Date.now() },
          ]);
        }
        setMenuOpen(false);
        setConfirmDeleteId(null);
      }
    } catch (e) { console.warn('Failed to load project:', e); }
  };

  const deleteProject = async (projId, e) => {
    e.stopPropagation();
    if (confirmDeleteId !== projId) {
      setConfirmDeleteId(projId);
      return;
    }
    setDeletingId(projId);
    try {
      const res = await fetch(`/api/projects/${projId}`, { method: 'DELETE' });
      if (res.ok) {
        setProjects(prev => prev.filter(p => p.id !== projId));
        // If we deleted the currently loaded project, clear state
        if (projectId === projId) {
          clearAll();
        }
      }
    } catch (e) { console.warn('Failed to delete project:', e); }
    finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const clearAll = () => {
    setChatMessages([]);
    setCurrentHtml('');
    setPages({});
    setCss('');
    setJs('');
    setDesc('');
    setHistory([]);
    setFeatures([]);
    setImageUrls([]);
    setProjectId(null);
    sessionStorage.removeItem('WEBCRAFT_PROJECT');
  };

  const clearHistory = () => {
    setHistory([]);
    setChatMessages([]);
    setCurrentHtml('');
    setPages({});
    setCss('');
    setJs('');
    setDesc('');
    setFeatures([]);
    setImageUrls([]);
    setProjectId(null);
    sessionStorage.removeItem('WEBCRAFT_PROJECT');
    setMenuOpen(false);
  };

  const getUserInitial = () => {
    const name = user?.name || user?.email;
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  const getUserDisplay = () => {
    return user?.name || null;
  };

  const handleSignOut = async () => {
    try {
      clearAll();
      await signOut({ callbackUrl: '/' });
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

  const hasActiveSession = chatMessages.length > 0 || currentHtml;

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
          <span className="export-label">Export</span>
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
            <button className="user-pill" onClick={() => { setMenuOpen(!menuOpen); setConfirmDeleteId(null); }}>
              {user.image ? (
                <img src={user.image} className="user-avatar-img" alt="" />
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

              {/* Clear current session */}
              {hasActiveSession && (
                <>
                  <button className="ud-item" onClick={clearHistory}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M5 6v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    Clear current session
                  </button>
                  <div className="ud-divider" />
                </>
              )}

              <div className="ud-section-label">Saved projects</div>
              <div className="ud-projects">
                {loadingProjects ? (
                  <div className="ud-item" style={{ justifyContent: 'center', color: 'var(--muted)' }}>
                    <div className="gen-spinner" style={{ width: 12, height: 12 }}></div>
                    Loading...
                  </div>
                ) : projects.length === 0 ? (
                  <div className="ud-empty">No projects yet</div>
                ) : (
                  projects.slice(0, 10).map(p => (
                    <div key={p.id} className="ud-proj-row">
                      <button className="ud-item ud-proj-item" onClick={() => loadProject(p)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                        <span className="ud-proj-name">{p.name || 'Untitled'}</span>
                      </button>
                      <button
                        className={`ud-proj-delete ${confirmDeleteId === p.id ? 'confirm' : ''}`}
                        onClick={(e) => deleteProject(p.id, e)}
                        disabled={deletingId === p.id}
                        title={confirmDeleteId === p.id ? 'Click again to confirm' : 'Delete project'}
                      >
                        {deletingId === p.id ? (
                          <div className="gen-spinner" style={{ width: 10, height: 10 }}></div>
                        ) : confirmDeleteId === p.id ? (
                          <span style={{ fontSize: '10px' }}>Delete?</span>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M5 6v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6"/></svg>
                        )}
                      </button>
                    </div>
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
