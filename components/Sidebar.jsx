"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';

const MODELS = [
  { id: 'gemini-2.5-flash', provider: 'gemini', name: 'Gemini 2.5 Flash', desc: 'Fast & smart', color: '#3b82f6' },
  { id: 'gemini-2.5-flash-lite', provider: 'gemini', name: 'Gemini 2.5 Flash Lite', desc: 'Fastest · unlimited', color: '#06b6d4' },
  { id: 'gemini-2.5-pro', provider: 'gemini', name: 'Gemini 2.5 Pro', desc: 'Best quality', color: '#8b5cf6' },
  { id: 'gemini-3-flash-preview', provider: 'gemini', name: 'Gemini 3 Flash', desc: 'Latest · preview', color: '#10b981' },
  { id: 'llama-3.3-70b-versatile', provider: 'groq', name: 'Llama 3.3 70B', desc: 'Groq · fast', color: '#eab308' },
];

const FEATURE_OPTIONS = [
  { id: 'auth', label: 'Auth Pages', icon: '🔐', desc: 'Login & signup forms' },
  { id: 'contact-form', label: 'Contact Form', icon: '📝', desc: 'Contact or feedback form' },
  { id: 'image-gallery', label: 'Image Gallery', icon: '🖼️', desc: 'Photo grid with lightbox' },
  { id: 'multi-page', label: 'Multi-Page', icon: '📄', desc: 'Multiple page sections' },
];

const LOADING_MESSAGES = [
  'Understanding your vision...',
  'Designing the layout...',
  'Choosing the perfect color palette...',
  'Crafting the typography...',
  'Building the structure...',
  'Writing clean HTML & CSS...',
  'Adding interactive elements...',
  'Making it responsive...',
  'Polishing every detail...',
  'Adding the finishing touches...',
  'Almost ready for you...',
  'Just a moment longer...',
];

const STARTER_PROMPTS = [
  { label: 'SaaS Landing Page', prompt: 'A modern SaaS landing page with hero, features, pricing table, testimonials, and CTA' },
  { label: 'Portfolio', prompt: 'A creative portfolio website for a freelance designer with project gallery, about me, and contact' },
  { label: 'Restaurant', prompt: 'An elegant restaurant website with menu, reservations, photo gallery, and location map' },
  { label: 'Online Store', prompt: 'A trendy e-commerce storefront with product grid, filters, cart preview, and checkout' },
  { label: 'Blog / Magazine', prompt: 'A clean blog or online magazine with featured articles, categories, and newsletter signup' },
  { label: 'Startup', prompt: 'A bold tech startup landing page with animated hero, team section, pricing, and integrations' },
];

export default function Sidebar() {
  const {
    setPages, setCss, setJs,
    desc, setDesc, history, setHistory, setCurrentFile,
    projectId, setProjectId, user, totalTokens, setTotalTokens,
    setIsAuthOpen, sidebarOpen, setSidebarOpen, selectedModel, setSelectedModel,
    chatMessages, setChatMessages, currentHtml, setCurrentHtml,
    features, setFeatures, imageUrls, setImageUrls,
  } = useAppContext();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [modelOpen, setModelOpen] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const currentModel = MODELS.find(m => m.id === selectedModel) || MODELS[0];
  const hasConversation = chatMessages.length > 0;

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  }, [input]);

  const toggleFeature = (featureId) => {
    setFeatures(prev =>
      prev.includes(featureId)
        ? prev.filter(f => f !== featureId)
        : [...prev, featureId]
    );
  };

  const handleImageUpload = (e) => {
    const MAX = 4 * 1024 * 1024; // 4MB per image
    const files = Array.from(e.target.files);
    const oversized = files.filter(f => f.size > MAX);
    if (oversized.length) {
      alert(`Skipped ${oversized.length} image(s) over 4MB.`);
    }
    files.filter(f => f.size <= MAX).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => setImageUrls(prev => [...prev, ev.target.result]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeImage = (idx) => {
    setImageUrls(prev => prev.filter((_, i) => i !== idx));
  };

  const saveToCloud = async (newPages, newCss, newJs, newHistory) => {
    if (!user) return;
    try {
      const headers = { 'Content-Type': 'application/json' };
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

  const sendMessage = async (messageText) => {
    const text = (messageText || input).trim();
    if (!text || loading) return;
    setInput('');
    // Auto-close sidebar on mobile so user sees the preview
    if (window.innerWidth <= 768) setSidebarOpen(false);

    const isFirst = chatMessages.length === 0;
    if (isFirst) setDesc(text);

    // Add user message
    const userMsg = { id: Date.now(), role: 'user', content: text, timestamp: Date.now(), model: selectedModel };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);

    setLoading(true);
    setLoadingMsg(LOADING_MESSAGES[0]);

    let msgIdx = 0;
    const interval = setInterval(() => {
      msgIdx++;
      setLoadingMsg(LOADING_MESSAGES[Math.min(msgIdx, LOADING_MESSAGES.length - 1)]);
    }, 3000);

    try {
      const model = MODELS.find(m => m.id === selectedModel) || MODELS[0];
      const provider = model.provider;

      // Build conversation messages for the API
      // Include current HTML context in the conversation
      const apiMessages = [];

      for (const msg of updatedMessages) {
        if (msg.role === 'user') {
          let content = msg.content;
          // For non-first messages, include current HTML context
          if (msg.id === userMsg.id && currentHtml && !isFirst) {
            content = `Here is the current website HTML:\n\n${currentHtml}\n\nUser request: ${msg.content}\n\nReturn the COMPLETE updated HTML with the requested changes.`;
          }
          apiMessages.push({ role: 'user', content });
        } else {
          // For assistant messages, just send a short acknowledgment to save tokens
          apiMessages.push({ role: 'assistant', content: 'Done. The website has been updated.' });
        }
      }

      const headers = { 'Content-Type': 'application/json' };

      // Abort after 90s — server's hard cap is 60s; this guards against hangs.
      const ctrl = new AbortController();
      const abortTimer = setTimeout(() => ctrl.abort(), 90_000);

      let res;
      try {
        res = await fetch('/api/ai', {
          method: 'POST',
          headers,
          signal: ctrl.signal,
          body: JSON.stringify({
            messages: apiMessages,
            model: selectedModel,
            provider,
            features: features.map(f => FEATURE_OPTIONS.find(o => o.id === f)?.label || f),
            imageUrls,
          }),
        });
      } catch (err) {
        if (err.name === 'AbortError') throw new Error('Generation timed out. Please try again.');
        throw err;
      } finally {
        clearTimeout(abortTimer);
      }

      if (!res.ok) {
        const errText = await res.text();
        let errMsg = `Generation failed (${res.status})`;
        try { errMsg = JSON.parse(errText).error || errMsg; } catch {}
        throw new Error(errMsg);
      }

      // Parse SSE stream response. Last data: line wins.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let data = null;

      const consume = (chunk) => {
        buffer += chunk;
        // SSE messages end with a blank line; split on that.
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || '';
        for (const ev of events) {
          for (const line of ev.split(/\r?\n/)) {
            if (line.startsWith('data: ')) {
              try { data = JSON.parse(line.slice(6)); } catch {}
            }
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        consume(decoder.decode(value, { stream: true }));
      }
      // Flush any final event without trailing blank line.
      if (buffer.trim()) consume('\n\n');

      if (!data) throw new Error('No response received from server');
      if (data.error) throw new Error(data.error);

      const html = data.html || '';

      // Add assistant message
      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: isFirst ? 'Here\'s your website! You can ask me to make any changes.' : 'Done! I\'ve updated the website with your changes.',
        timestamp: Date.now(),
        model: selectedModel,
      };
      setChatMessages([...updatedMessages, assistantMsg]);

      // Update the current HTML and legacy state
      setCurrentHtml(html);
      setPages({ 'index.html': html });
      setCss('');
      setJs('');
      setCurrentFile('index.html');
      setTotalTokens(prev => prev + (data.tokens || 0));

      const newHistory = [{
        prompt: text, pages: { 'index.html': html }, css: '', js: '', ts: Date.now()
      }, ...history];
      setHistory(newHistory);
      saveToCloud({ 'index.html': html }, '', '', newHistory);

    } catch (e) {
      // Add error message to chat
      const errMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `Something went wrong: ${e.message}. Please try again.`,
        timestamp: Date.now(),
        isError: true,
      };
      setChatMessages([...updatedMessages, errMsg]);
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startNew = () => {
    setChatMessages([]);
    setCurrentHtml('');
    setPages({});
    setCss('');
    setJs('');
    setDesc('');
    setHistory([]);
    setFeatures([]);
    setImageUrls([]);
    setInput('');
    setProjectId(null);
    sessionStorage.removeItem('WEBCRAFT_PROJECT');
  };

  return (
    <>
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>

        {/* Sidebar Header */}
        <div className="sb-top">
          <button className="sb-new-btn" onClick={startNew}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New website
          </button>
          {!user && (
            <button className="sb-signin-btn" onClick={() => setIsAuthOpen(true)}>Sign in</button>
          )}
        </div>

        {/* Chat Messages */}
        <div className="chat-scroll">
          {!hasConversation ? (
            <div className="chat-empty">
              <div className="chat-empty-icon">W</div>
              <h3>What do you want to build?</h3>
              <p>Describe your website and I'll create it instantly. You can keep refining with follow-up messages.</p>

              {/* Feature Pills */}
              <div className="feature-pills">
                <span className="feature-pills-label">Add features:</span>
                <div className="feature-pills-row">
                  {FEATURE_OPTIONS.map(f => (
                    <button
                      key={f.id}
                      className={`feature-pill ${features.includes(f.id) ? 'active' : ''}`}
                      onClick={() => toggleFeature(f.id)}
                    >
                      <span className="feature-pill-icon">{f.icon}</span>
                      <span>{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Starter Prompts */}
              <div className="starter-prompts">
                {STARTER_PROMPTS.map((s, i) => (
                  <button key={i} className="starter-prompt" onClick={() => sendMessage(s.prompt)}>
                    <span className="starter-label">{s.label}</span>
                    <span className="starter-desc">{s.prompt.substring(0, 60)}...</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="chat-messages">
              {chatMessages.map(msg => (
                <div key={msg.id} className={`chat-msg ${msg.role} ${msg.isError ? 'error' : ''}`}>
                  {msg.role === 'assistant' && (
                    <div className="chat-msg-avatar">W</div>
                  )}
                  <div className="chat-msg-bubble">
                    <div className="chat-msg-text">{msg.content}</div>
                    <div className="chat-msg-meta">
                      {msg.model && (
                        <span className="chat-msg-model">
                          <span className="chat-model-dot" style={{ background: MODELS.find(m => m.id === msg.model)?.color || '#888' }}></span>
                          {MODELS.find(m => m.id === msg.model)?.name || msg.model}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Loading indicator in chat */}
              {loading && (
                <div className="chat-msg assistant">
                  <div className="chat-msg-avatar">W</div>
                  <div className="chat-msg-bubble loading-bubble">
                    <div className="chat-loading-dots">
                      <span></span><span></span><span></span>
                    </div>
                    <span className="chat-loading-text">{loadingMsg}</span>
                  </div>
                </div>
              )}

              {/* Quick action chips after generation */}
              {!loading && hasConversation && currentHtml && (
                <div className="quick-actions">
                  <button className="quick-action-chip" onClick={() => sendMessage('Add more high-quality images throughout the website. Use different images for each section.')}>
                    + Add more images
                  </button>
                  <button className="quick-action-chip" onClick={() => sendMessage('Replace all placeholder or broken images with working, relevant images. Make sure every image loads correctly.')}>
                    Fix images
                  </button>
                  <button className="quick-action-chip" onClick={() => sendMessage('Make the design more polished - improve spacing, typography, and color consistency')}>
                    Polish design
                  </button>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Feature pills when in conversation */}
        {hasConversation && (
          <div className="chat-features-bar">
            <button
              className="chat-features-toggle"
              onClick={() => setShowFeatures(!showFeatures)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Features {features.length > 0 && <span className="feature-count">{features.length}</span>}
            </button>
            {showFeatures && (
              <div className="chat-features-dropdown">
                {FEATURE_OPTIONS.map(f => (
                  <button
                    key={f.id}
                    className={`feature-dropdown-item ${features.includes(f.id) ? 'active' : ''}`}
                    onClick={() => toggleFeature(f.id)}
                  >
                    <span>{f.icon}</span>
                    <div>
                      <div className="feature-dropdown-name">{f.label}</div>
                      <div className="feature-dropdown-desc">{f.desc}</div>
                    </div>
                    {features.includes(f.id) && <span className="feature-check">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Image preview strip */}
        {imageUrls.length > 0 && (
          <div className="image-strip">
            {imageUrls.map((url, i) => (
              <div key={i} className="image-thumb">
                <img src={url} alt={`Upload ${i + 1}`} />
                <button className="image-thumb-remove" onClick={() => removeImage(i)}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* Chat Input */}
        <div className="chat-input-area">
          <div className="chat-input-row">
            <div className="chat-input-actions">
              <button className="chat-action-btn" onClick={() => fileInputRef.current?.click()} title="Upload image">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
            </div>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={hasConversation ? 'Ask for changes...' : 'Describe your website...'}
              disabled={loading}
              rows={1}
              className="chat-textarea"
            />
            <button
              className="chat-send-btn"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
            >
              {loading ? (
                <div className="send-spinner"></div>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              )}
            </button>
          </div>

          {/* Model selector */}
          <div className="chat-bottom-bar">
            <button className="model-select-btn" onClick={() => setModelOpen(!modelOpen)}>
              <span className="model-dot-sm" style={{ background: currentModel.color }}></span>
              <span>{currentModel.name}</span>
              <span className="chevron" style={{ transform: modelOpen ? 'rotate(180deg)' : '' }}>▾</span>
            </button>
            {modelOpen && (
              <div className="model-dropdown-chat">
                {MODELS.map(m => (
                  <button
                    key={m.id}
                    className={`model-dropdown-item ${selectedModel === m.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedModel(m.id);
                      localStorage.setItem('WEBCRAFT_MODEL', m.id);
                      setModelOpen(false);
                    }}
                  >
                    <span className="model-dot-sm" style={{ background: m.color }}></span>
                    <div>
                      <div className="model-dropdown-name">{m.name}</div>
                      <div className="model-dropdown-desc">{m.desc}</div>
                    </div>
                    {selectedModel === m.id && <span style={{ marginLeft: 'auto', color: 'var(--green)' }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
            <span className="token-count">{totalTokens > 0 ? `${(totalTokens / 1000).toFixed(1)}k tokens` : ''}</span>
          </div>
        </div>
      </div>
    </>
  );
}
