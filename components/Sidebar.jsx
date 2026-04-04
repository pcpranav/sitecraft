"use client";
import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';

export default function Sidebar() {
  const { 
    pages, setPages, css, setCss, js, setJs, 
    desc, setDesc, history, setHistory, currentFile, setCurrentFile,
    supabaseClient, projectId, setProjectId, user, totalTokens, setTotalTokens,
    setIsAuthOpen, sidebarOpen, setSidebarOpen, selectedModel, setSelectedModel
  } = useAppContext();
  
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [mobileModelOpen, setMobileModelOpen] = useState(false);

  const MODELS = [
    { id: 'gemini-2.5-flash', provider: 'gemini', name: 'Gemini 2.5 Flash', desc: 'Fast & free', color: 'var(--blue)' },
    { id: 'gemini-2.0-flash', provider: 'gemini', name: 'Gemini 2.0 Flash', desc: 'Lightweight', color: 'var(--blue)' },
    { id: 'llama-3.3-70b-versatile', provider: 'groq', name: 'Llama 3.3 70B', desc: 'Groq · blazing fast', color: 'var(--amber)' },
  ];
  const currentModel = MODELS.find(m => m.id === selectedModel) || MODELS[0];

  useEffect(() => {
    if (desc) setPrompt(desc);
  }, [desc]);

  const saveToCloud = async (newPages, newCss, newJs, newHistory) => {
    if (!supabaseClient || !user) return;
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session?.access_token) return;

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      };
      const payload = {
        name: desc || 'Untitled',
        description: desc,
        pages: newPages,
        shared_css: newCss,
        shared_js: newJs,
        history: newHistory,
      };
      let res;
      if (projectId) {
        res = await fetch(`/api/projects/${projectId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/projects', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
      }
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error);
      if (!projectId && resData.project?.id) setProjectId(resData.project.id);
    } catch(e) {
      console.warn("Save to cloud failed:", e);
    }
  };

  const generateSite = async () => {
    if (!prompt.trim()) return;
    setDesc(prompt);
    setLoading(true);
    setLoadingMsg('Architecting your site');

    let cycleCount = 0;
    const interval = setInterval(() => {
      cycleCount++;
      const msgs = ['Architecting your site','Designing the layout','Writing the code','Polishing the details','Almost ready'];
      setLoadingMsg(msgs[cycleCount % msgs.length]);
    }, 4000);

    try {
      // Derive provider from selected model
      const providerMap = {
        'gemini-2.5-flash': 'gemini', 'gemini-2.0-flash': 'gemini',
        'llama-3.3-70b-versatile': 'groq',
      };
      const provider = providerMap[selectedModel] || 'gemini';
      const payload = { prompt, isEdit: false, pages: {}, css: '', js: '', currentFile: 'index.html', model: selectedModel, provider };
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setPages(data.pages || {});
      setCss(data.shared_css || '');
      setJs(data.shared_js || '');
      setCurrentFile('index.html');
      setTotalTokens(prev => prev + (data.tokens || 0));
      
      const newHistory = [{
        prompt,
        pages: data.pages || {}, css: data.shared_css || '', js: data.shared_js || '',
        ts: Date.now()
      }, ...history];
      
      setHistory(newHistory);
      saveToCloud(data.pages || {}, data.shared_css || '', data.shared_js || '', newHistory);
    } catch(e) {
      alert("Generation failed: " + e.message);
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  const fileCount = Object.keys(pages).length;

  const closeSidebarOnMobile = () => {
    if (window.innerWidth <= 768) setSidebarOpen(false);
  };

  return (
    <>
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="sidebar-scroll">

        {/* MODEL SELECTOR (mobile only, hidden on desktop via CSS) */}
        <div className="sb-section sidebar-model-section">
          <div className="sb-header">
            <span className="sb-label">Model</span>
          </div>
          <button
            className="sidebar-model-select"
            onClick={() => setMobileModelOpen(!mobileModelOpen)}
          >
            <div className="model-dot" style={{ background: currentModel.color }}></div>
            <span style={{ flex: 1 }}>{currentModel.name}</span>
            <span className="chevron" style={{ transform: mobileModelOpen ? 'rotate(180deg)' : '' }}>▾</span>
          </button>
          {mobileModelOpen && (
            <div className="sidebar-model-dropdown">
              {MODELS.map(m => (
                <button
                  key={m.id}
                  className={`md-item ${selectedModel === m.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedModel(m.id);
                    localStorage.setItem('WEBCRAFT_MODEL', m.id);
                    setMobileModelOpen(false);
                  }}
                >
                  <div className="model-dot" style={{ background: m.color }}></div>
                  <div className="md-item-info">
                    <div className="md-item-name">{m.name}</div>
                    <div className="md-item-desc">{m.desc}</div>
                  </div>
                  {selectedModel === m.id && <span style={{ fontSize: '11px', color: 'var(--green)' }}>✓</span>}
                </button>
              ))}
            </div>
          )}
          <div className="sb-divider" />
        </div>

        {/* FILES */}
        <div className="sb-section">
          <div className="sb-header">
            <span className="sb-label">Files</span>
          </div>
          {fileCount === 0 ? (
            <div style={{ fontSize:'11px', color:'var(--muted)', padding: '4px 2px' }}>No files</div>
          ) : (
            <div className="file-tree">
              {Object.keys(pages).map(file => (
                <div
                  key={file}
                  className={`ft-item ft-html ${currentFile === file ? 'active' : ''}`}
                  onClick={() => { setCurrentFile(file); closeSidebarOnMobile(); }}
                >
                  <div className="ft-dot"></div>
                  {file}
                </div>
              ))}
              {css && (
                <div
                  className={`ft-item ft-css ${currentFile === 'shared.css' ? 'active' : ''}`}
                  onClick={() => { setCurrentFile('shared.css'); closeSidebarOnMobile(); }}
                >
                  <div className="ft-dot"></div>
                  shared.css
                </div>
              )}
              {js && (
                <div
                  className={`ft-item ft-js ${currentFile === 'shared.js' ? 'active' : ''}`}
                  onClick={() => { setCurrentFile('shared.js'); closeSidebarOnMobile(); }}
                >
                  <div className="ft-dot"></div>
                  shared.js
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sb-divider" />

        {/* HISTORY */}
        <div className="sb-section">
          <div className="sb-header">
            <span className="sb-label">History</span>
            {!user && (
              <button
                className="btn btn-xs btn-ghost"
                onClick={() => setIsAuthOpen(true)}
                style={{ fontSize: '9px' }}
              >
                Sign in to save
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <div style={{ fontSize:'11px', color:'var(--muted)', padding: '4px 2px' }}>No sites yet</div>
          ) : (
            <div className="hist-list">
              {history.map((h, i) => (
                <div key={i} className={`hi ${i === 0 ? 'active' : ''}`} onClick={() => {
                  setPages(h.pages); setCss(h.css); setJs(h.js); closeSidebarOnMobile();
                }}>
                  <span className="hi-icon">✦</span>
                  <span className="hi-label">{h.prompt.substring(0, 38)}{h.prompt.length > 38 ? '…' : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Loading indicator */}
      {loading && (
        <div style={{
          padding: '12px 16px', background: 'var(--panel)',
          borderTop: '1px solid var(--border)',
          display: 'flex', gap: '10px', alignItems: 'center'
        }}>
          <div className="spinner" style={{ width: 14, height: 14 }}></div>
          <span style={{ fontSize: '11px', color: 'var(--subtle)', fontFamily: 'var(--font-mono)' }}>{loadingMsg}</span>
        </div>
      )}

      {/* Prompt input at bottom */}
      <div style={{
        borderTop: '1px solid var(--border)',
        padding: '14px 12px',
        background: 'var(--surface)',
        display: 'flex', flexDirection: 'column', gap: '10px'
      }}>
        <div className="sb-header">
          <span className="sb-label">Idea</span>
          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>
            {prompt.length} chars
          </span>
        </div>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="A luxury watch brand..."
          disabled={loading}
          id="promptArea"
          style={{ height: 88 }}
        />
        <button
          className="btn btn-primary btn-full"
          onClick={generateSite}
          disabled={loading || !prompt.trim()}
        >
          {loading
            ? <><div className="gen-spinner"></div> Generating…</>
            : '✦ Generate website'
          }
        </button>
      </div>
    </div>
    </>
  );
}
