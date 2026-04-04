"use client";
import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';

const MODELS = [
  { id: 'gemini-2.5-flash', provider: 'gemini', name: 'Gemini 2.5 Flash', desc: 'Fast & free', color: 'var(--blue)' },
  { id: 'llama-3.3-70b-versatile', provider: 'groq', name: 'Llama 3.3 70B', desc: 'Groq · fast', color: 'var(--amber)' },
];

const EXAMPLE_PROMPTS = [
  'A bakery website with menu and online ordering',
  'Portfolio for a freelance photographer',
  'Landing page for a fitness app',
  'Restaurant with reservations and gallery',
];

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
  const [modelOpen, setModelOpen] = useState(false);

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
        res = await fetch(`/api/projects/${projectId}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
      } else {
        res = await fetch('/api/projects', { method: 'POST', headers, body: JSON.stringify(payload) });
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
      const providerMap = {
        'gemini-2.5-flash': 'gemini',
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

        {/* FILES */}
        <div className="sb-section">
          <div className="sb-header">
            <span className="sb-label">Files</span>
          </div>
          {fileCount === 0 ? (
            <div style={{ fontSize:'11px', color:'var(--muted)', padding: '4px 2px' }}>No files yet</div>
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

      {/* Prompt + model selector at bottom */}
      <div className="sidebar-bottom">
        <span className="sb-label">Describe your website</span>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="e.g. A bakery website with menu, gallery, and online ordering..."
          disabled={loading}
          id="promptArea"
        />

        {/* Example prompts when empty */}
        {!prompt && !loading && fileCount === 0 && (
          <div className="prompt-chips">
            {EXAMPLE_PROMPTS.map((p, i) => (
              <button key={i} className="prompt-chip" onClick={() => setPrompt(p)}>{p}</button>
            ))}
          </div>
        )}

        <button
          className="btn btn-primary btn-full"
          onClick={generateSite}
          disabled={loading || !prompt.trim()}
        >
          {loading
            ? <><div className="gen-spinner"></div> Generating...</>
            : 'Generate website'
          }
        </button>

        {/* Model selector */}
        <div className="model-selector-bottom">
          <button className="model-toggle" onClick={() => setModelOpen(!modelOpen)}>
            <div className="model-dot" style={{ background: currentModel.color }}></div>
            <span>{currentModel.name}</span>
            <span className="chevron" style={{ transform: modelOpen ? 'rotate(180deg)' : '' }}>▾</span>
          </button>
          {modelOpen && (
            <div className="model-list">
              {MODELS.map(m => (
                <button
                  key={m.id}
                  className={`model-option ${selectedModel === m.id ? 'active' : ''}`}
                  onClick={() => { setSelectedModel(m.id); localStorage.setItem('WEBCRAFT_MODEL', m.id); setModelOpen(false); }}
                >
                  <div className="model-dot" style={{ background: m.color }}></div>
                  <span>{m.name}</span>
                  {selectedModel === m.id && <span style={{ marginLeft: 'auto', color: 'var(--green)', fontSize: '11px' }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
