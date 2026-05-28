"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAppContext } from '@/context/AppContext';
import { signOut } from 'next-auth/react';
import AuthModal from './AuthModal';
import Icon from '@/components/Icon';
import BrandMark from '@/components/BrandMark';
import JSZip from 'jszip';

export default function Header() {
  const {
    user, theme, setTheme, view, setView,
    isAuthOpen, setIsAuthOpen, pages, setPages, setCss, setJs,
    desc, setDesc, setHistory, setProjectId, projectId,
    sidebarOpen, setSidebarOpen, setCurrentFile,
    currentHtml, setCurrentHtml, setChatMessages, setFeatures, setImageUrls,
    chatMessages,
  } = useAppContext();

  const projectTitle = (desc || '').trim().slice(0, 50);
  const hasActiveProject = chatMessages.length > 0 || currentHtml || projectTitle;

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
    sessionStorage.removeItem('SITECRAFT_PROJECT');
    sessionStorage.removeItem('WEBCRAFT_PROJECT'); // legacy
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
    sessionStorage.removeItem('SITECRAFT_PROJECT');
    sessionStorage.removeItem('WEBCRAFT_PROJECT'); // legacy
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
    localStorage.setItem('SITECRAFT_THEME', newTheme);
  };

  const hasActiveSession = chatMessages.length > 0 || currentHtml;

  return (
    <>
      <header className="header">
        <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">
          <Icon name="hamburger" size={18} />
        </button>
        <Link href="/" className="logo">
          <BrandMark size={34} className="logo-icon" />
          <div className="logo-text">Sitecraft</div>
        </Link>

        {hasActiveProject && (
          <div className="header-project" title={desc || 'Untitled session'}>
            <span className="header-project-sep">/</span>
            <span className="header-project-title">{projectTitle || 'Untitled session'}</span>
          </div>
        )}

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
          a.download = 'sitecraft-project.zip';
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
              <Icon name="chevron" size={10} stroke={2.5} />
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
                    <Icon name="trash" size={14} />
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
                        <Icon name="file" size={14} />
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
                          <Icon name="trash" size={12} />
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="ud-divider" />
              <button className="ud-item danger" onClick={() => { setMenuOpen(false); handleSignOut(); }}>
                <Icon name="signout" size={14} />
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
