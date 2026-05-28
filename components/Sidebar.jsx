"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import Icon from '@/components/Icon';

const MODELS = [
  { id: 'gpt-oss-120b', provider: 'cerebras', name: 'Cerebras · GPT-OSS 120B', desc: '120B MoE · fastest large-model inference', color: '#f97316' },
  { id: 'openrouter/free', provider: 'openrouter', name: 'OpenRouter · Free Auto', desc: 'Auto-routes across ~24 free models · resilient to upstream throttling', color: '#10b981' },
  { id: 'meta-llama/llama-4-scout-17b-16e-instruct', provider: 'groq', name: 'Groq · Llama 4 Scout', desc: '17B-active MoE · 750 tok/s', color: '#eab308' },
  { id: '@cf/qwen/qwen3-30b-a3b-fp8', provider: 'cloudflare', name: 'Cloudflare · Qwen3 30B', desc: '30B MoE · 3B active · fast', color: '#f59e0b' },
];

const FEATURE_OPTIONS = [
  { id: 'contact-form', label: 'Contact Form', icon: '📝', desc: 'Contact or feedback form' },
  { id: 'image-gallery', label: 'Image Gallery', icon: '🖼️', desc: 'Photo grid with lightbox' },
];

const STYLE_PRESETS = [
  { id: 'auto', label: 'Auto-detect' },
  { id: 'landing', label: 'Landing page' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'blog', label: 'Blog / Magazine' },
  { id: 'saas', label: 'SaaS product' },
  { id: 'ecommerce', label: 'E-commerce' },
  { id: 'other', label: 'Other' },
];

const TONE_PRESETS = [
  { id: 'auto', label: 'Auto-detect' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'playful', label: 'Playful' },
  { id: 'corporate', label: 'Corporate' },
  { id: 'bold', label: 'Bold' },
  { id: 'retro', label: 'Retro' },
];

const LOADING_MESSAGES = [
  'Drafting layout',
  'Writing HTML',
  'Styling and motion',
  'Finalizing',
];

const STARTER_PROMPTS = [
  { label: 'SaaS Landing Page', prompt: 'A modern SaaS landing page with hero, features, pricing table, testimonials, and CTA' },
  { label: 'Portfolio', prompt: 'A creative portfolio website for a freelance designer with project gallery, about me, and contact' },
  { label: 'Restaurant', prompt: 'An elegant restaurant website with menu, reservations, photo gallery, and location map' },
  { label: 'Online Store', prompt: 'A trendy e-commerce storefront with product grid, filters, cart preview, and checkout' },
  { label: 'Blog / Magazine', prompt: 'A clean blog or online magazine with featured articles, categories, and newsletter signup' },
  { label: 'Startup', prompt: 'A bold tech startup landing page with animated hero, team section, pricing, and integrations' },
];

function PresetSelect({ value, options, onChange, label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = options.find(o => o.id === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div className="preset-field" ref={ref}>
      <span className="preset-label">{label}</span>
      <button type="button" className="preset-trigger" onClick={() => setOpen(!open)}>
        <span>{current.label}</span>
        <Icon name="chevron" size={10} stroke={2.5} style={{ transform: open ? 'rotate(180deg)' : '', transition: 'transform .15s' }} />
      </button>
      {open && (
        <div className="preset-dropdown">
          {options.map(opt => (
            <button
              key={opt.id}
              type="button"
              className={`preset-option ${opt.id === value ? 'active' : ''}`}
              onClick={() => { onChange(opt.id); setOpen(false); }}
            >
              {opt.label}
              {opt.id === value && <span className="preset-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [stylePreset, setStylePreset] = useState('auto');
  const [tonePreset, setTonePreset] = useState('auto');
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const modelPickerRef = useRef(null);
  const featuresBarRef = useRef(null);

  // Close model picker / features dropdown on outside-click or Escape.
  useEffect(() => {
    if (!modelOpen && !showFeatures) return;
    const handleClick = (e) => {
      if (modelOpen && modelPickerRef.current && !modelPickerRef.current.contains(e.target)) {
        setModelOpen(false);
      }
      if (showFeatures && featuresBarRef.current && !featuresBarRef.current.contains(e.target)) {
        setShowFeatures(false);
      }
    };
    const handleKey = (e) => {
      if (e.key !== 'Escape') return;
      setModelOpen(false);
      setShowFeatures(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [modelOpen, showFeatures]);

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

  const regenerateLast = () => {
    if (loading) return;
    const lastUser = [...chatMessages].reverse().find(m => m.role === 'user');
    if (!lastUser) return;
    // Trim back to the state BEFORE the last user prompt, then re-send it as a
    // fresh generation. We must pass the baseline explicitly because
    // setChatMessages is async and sendMessage would otherwise read the stale
    // pre-trim closure value, treating the re-run as a follow-up edit.
    const lastAssistantIdx = chatMessages.map(m => m.role).lastIndexOf('assistant');
    let baseline = chatMessages;
    if (lastAssistantIdx >= 0) {
      baseline = chatMessages.slice(0, lastAssistantIdx).filter(m => m.id !== lastUser.id);
      setChatMessages(baseline);
    }
    sendMessage(lastUser.content, { baselineMessages: baseline, regenerate: true });
  };

  const undoLastTurn = () => {
    if (loading || chatMessages.length === 0) return;
    // Drop trailing assistant + the user message that produced it.
    let trimmed = [...chatMessages];
    while (trimmed.length && trimmed[trimmed.length - 1].role === 'assistant') trimmed.pop();
    while (trimmed.length && trimmed[trimmed.length - 1].role === 'user') {
      trimmed.pop();
      break;
    }
    setChatMessages(trimmed);

    // Restore HTML from the previous history entry (history[0] is the current state).
    const prev = history[1];
    if (prev) {
      setCurrentHtml(prev.pages?.['index.html'] || '');
      setPages(prev.pages || {});
      setCss(prev.css || '');
      setJs(prev.js || '');
      setHistory(history.slice(1));
    } else {
      setCurrentHtml('');
      setPages({});
      setCss('');
      setJs('');
      setHistory([]);
    }
  };

  const saveToCloud = async (newPages, newCss, newJs, newHistory, descOverride) => {
    if (!user) return;
    // The first turn calls setDesc(text) right before saveToCloud, but React
    // hasn't flushed the state by the time we read `desc` via closure — that's
    // why every project saved as "Untitled". Callers can pass descOverride to
    // bypass the stale read.
    const effectiveDesc = (descOverride ?? desc ?? '').trim();
    const projectName = effectiveDesc.slice(0, 60) || 'Untitled';
    try {
      const headers = { 'Content-Type': 'application/json' };
      const payload = {
        name: projectName,
        description: effectiveDesc,
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

  const sendMessage = async (messageText, options = {}) => {
    const { baselineMessages, regenerate = false } = options;
    const text = (messageText || input).trim();
    if (!text || loading) return;
    setInput('');
    // Auto-close sidebar on mobile so user sees the preview
    if (window.innerWidth <= 768) setSidebarOpen(false);

    // baselineMessages lets regenerate pass the explicitly-trimmed history
    // since setState is async — reading chatMessages here gives stale data.
    const baseline = baselineMessages ?? chatMessages;
    // Regenerate is treated as a fresh first turn: we do NOT want to seed the
    // newly-selected model with the prior model's HTML, otherwise it just
    // reproduces the same design.
    const isFirst = baseline.length === 0 || regenerate;
    if (isFirst && !baselineMessages) setDesc(text);

    // Add user message
    const userMsg = { id: Date.now(), role: 'user', content: text, timestamp: Date.now(), model: selectedModel };
    const updatedMessages = [...baseline, userMsg];
    setChatMessages(updatedMessages);

    setLoading(true);
    setLoadingMsg(LOADING_MESSAGES[0]);

    // Cycle through the loading phrases over ~20s, then hold on the final one
    // so long generations don't show the same string flashing repeatedly.
    let msgIdx = 0;
    const interval = setInterval(() => {
      msgIdx++;
      setLoadingMsg(LOADING_MESSAGES[Math.min(msgIdx, LOADING_MESSAGES.length - 1)]);
    }, 5000);

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

      // Client-side abort guard. Set above the server's maxDuration so
      // genuine completions aren't cut short. Slow free-tier endpoints
      // (large reasoning models) can take several minutes.
      const ctrl = new AbortController();
      const abortTimer = setTimeout(() => ctrl.abort(), 300_000);

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
            stylePreset: stylePreset === 'auto' ? undefined : stylePreset,
            tonePreset: tonePreset === 'auto' ? undefined : tonePreset,
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
      // Pass `desc || text` so the first-turn project name comes from the user's
      // prompt instead of the empty stale `desc` state.
      saveToCloud({ 'index.html': html }, '', '', newHistory, desc || text);

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
    setTotalTokens(0);
    sessionStorage.removeItem('SITECRAFT_PROJECT');
    sessionStorage.removeItem('WEBCRAFT_PROJECT'); // legacy
  };

  return (
    <>
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>

        {/* Sidebar Header */}
        <div className="sb-top">
          <button className="sb-new-btn" onClick={startNew}>
            <Icon name="plus" size={14} />
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
              <div className="chat-empty-icon">S</div>
              <h3>What do you want to build?</h3>
              <p>Describe any website idea. Works best for landing pages, portfolios, and simple brochures. Keep refining with follow-up messages.</p>

              {/* Style + Tone presets */}
              <div className="preset-row">
                <PresetSelect label="Style" value={stylePreset} options={STYLE_PRESETS} onChange={setStylePreset} />
                <PresetSelect label="Tone" value={tonePreset} options={TONE_PRESETS} onChange={setTonePreset} />
              </div>

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
                    <div className="chat-msg-avatar">S</div>
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
                  <div className="chat-msg-avatar">S</div>
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
                  <button className="quick-action-chip primary" onClick={regenerateLast} title="Re-run the last prompt with the current model">
                    ↻ Regenerate
                  </button>
                  <button className="quick-action-chip primary" onClick={undoLastTurn} title="Drop the last turn and restore the previous version" disabled={history.length < 2}>
                    ↶ Undo
                  </button>
                  <button className="quick-action-chip" onClick={() => sendMessage('Add more imagery throughout the page; use a different image in each section.')}>
                    + Add images
                  </button>
                  <button className="quick-action-chip" onClick={() => sendMessage('Replace any broken or missing images with working images from the curated list.')}>
                    Fix images
                  </button>
                  <button className="quick-action-chip" onClick={() => sendMessage('Tighten the design — improve spacing rhythm, typographic hierarchy, and color consistency.')}>
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
          <div className="chat-features-bar" ref={featuresBarRef}>
            <button
              className="chat-features-toggle"
              onClick={() => setShowFeatures(!showFeatures)}
            >
              <Icon name="settings" size={14} />
              Features {features.length > 0 && <span className="feature-count">{features.length}</span>}
            </button>
            {showFeatures && (
              <div className="chat-features-dropdown">
                <div className="preset-row preset-row-compact">
                  <PresetSelect label="Style" value={stylePreset} options={STYLE_PRESETS} onChange={setStylePreset} />
                  <PresetSelect label="Tone" value={tonePreset} options={TONE_PRESETS} onChange={setTonePreset} />
                </div>
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
                <Icon name="image" size={16} />
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
                <Icon name="send" size={16} />
              )}
            </button>
          </div>

          {/* Model selector */}
          <div className="chat-bottom-bar">
            <div className="model-picker-wrap" ref={modelPickerRef}>
              <button
                className="model-select-btn"
                onClick={() => setModelOpen(!modelOpen)}
                title="Outputs are single-page HTML drafts. Don't expect pixel-perfect or backend-connected sites."
              >
                <span className="model-dot-sm" style={{ background: currentModel.color }}></span>
                <span>{currentModel.name}</span>
                <Icon name="chevron" size={12} stroke={2.5} className="chevron"
                  style={{ transform: modelOpen ? 'rotate(180deg)' : '', transition: 'transform .15s' }} />
              </button>
              {modelOpen && (
                <div className="model-dropdown-chat">
                  {MODELS.map(m => (
                    <button
                      key={m.id}
                      className={`model-dropdown-item ${selectedModel === m.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedModel(m.id);
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
            </div>
            <span className="token-count">{totalTokens > 0 ? `${(totalTokens / 1000).toFixed(1)}k tokens` : ''}</span>
          </div>
        </div>
      </div>
    </>
  );
}
