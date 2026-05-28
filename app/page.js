"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useAppContext } from '@/context/AppContext';
import AuthModal from '@/components/AuthModal';
import Icon from '@/components/Icon';
import { PublicHeader, PublicFooter } from '@/components/PublicChrome';

const PROVIDERS = [
  { name: 'Cerebras', model: 'GPT-OSS 120B' },
  { name: 'Groq', model: 'Llama 4 Scout' },
  { name: 'OpenRouter', model: 'Free Auto' },
  { name: 'Cloudflare', model: 'Qwen3 30B' },
];

const FEATURES = [
  { title: 'Free models only',   desc: 'Four 70B-class open-source endpoints. No paid tiers, no surprise bills.' },
  { title: 'Switch mid-thread',  desc: 'Pick a different model at any turn — same conversation, different brain.' },
  { title: 'Tailwind-powered',   desc: 'Output uses Tailwind CSS via CDN — utility classes, mobile-first defaults, real desktop layouts out of the box.' },
  { title: 'Yours to export',    desc: 'Download a single-page HTML file. Host anywhere, edit anything.' },
  { title: 'Iterative by chat',  desc: 'Refine via follow-up prompts. Undo a turn, regenerate with a different style.' },
  { title: 'Live preview',       desc: 'Watch the page build in the iframe as the model writes it, not after.' },
];

// Root route. Auth-aware: signed-in users land on the projects home; everyone
// else sees the marketing page. The decision is based on NextAuth's resolved
// session status (not just `user`), so we don't flash marketing during the
// 'loading' phase on a reload while signed in.
export default function Page() {
  const { status } = useSession();
  const { user } = useAppContext();

  if (status === 'loading') {
    return <div className="page-loading" aria-hidden="true" />;
  }
  if (status === 'authenticated' && user) {
    return <ProjectsHome />;
  }
  return <Marketing />;
}

// ───────────────────────────────────────────────────────────────────────────
// PROJECTS HOME — what signed-in users see on /
// ───────────────────────────────────────────────────────────────────────────

function ProjectsHome() {
  const {
    user, setDesc, setHistory, setProjectId,
    setCurrentHtml, setChatMessages, setFeatures, setImageUrls,
  } = useAppContext();
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => { if (!cancelled) setProjects(data.projects || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const openProject = async (proj) => {
    setOpening(proj.id);
    try {
      const res = await fetch(`/api/projects/${proj.id}`);
      const data = await res.json();
      if (res.ok && data.project) {
        const p = data.project;
        setDesc(p.description || '');
        setHistory(p.history || []);
        setProjectId(p.id);
        setFeatures([]);
        setImageUrls([]);
        setCurrentHtml(p.pages?.['index.html'] || '');
        setChatMessages(p.chatMessages || [
          { id: 1, role: 'user', content: p.description || 'Loaded project', timestamp: Date.now() },
          { id: 2, role: 'assistant', content: 'Project loaded. Ask me to make changes.', timestamp: Date.now() },
        ]);
        router.push('/studio');
      }
    } finally {
      setOpening(null);
    }
  };

  const newProject = () => {
    setDesc('');
    setHistory([]);
    setProjectId(null);
    setCurrentHtml('');
    setChatMessages([]);
    setFeatures([]);
    setImageUrls([]);
    router.push('/studio');
  };

  const fmtDate = (s) => {
    if (!s) return '';
    try { return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
    catch { return ''; }
  };

  const firstName = (user?.name || '').split(' ')[0];

  return (
    <div className="landing-layout">
      <PublicHeader />
      <main className="home-main">
        <div className="home-head">
          <div>
            <p className="hero-eyebrow">YOUR PROJECTS</p>
            <h1 className="home-title">
              {firstName ? `Welcome back, ${firstName}.` : 'Welcome back.'}
            </h1>
            <p className="home-subtitle">
              Open one to continue refining, or start something new.
            </p>
          </div>
          <button className="btn btn-primary home-new-btn" onClick={newProject}>
            <Icon name="plus" size={14} />
            New project
          </button>
        </div>

        {loading ? (
          <div className="home-empty"><div className="gen-spinner" /></div>
        ) : projects.length === 0 ? (
          <div className="home-empty">
            <p>No projects yet.</p>
            <button className="btn btn-primary" onClick={newProject}>Create your first</button>
          </div>
        ) : (
          <div className="projects-grid">
            {projects.map(p => (
              <button
                key={p.id}
                className="project-card"
                onClick={() => openProject(p)}
                disabled={opening === p.id}
              >
                <div className="project-card-title">{p.name || 'Untitled'}</div>
                <div className="project-card-desc">{(p.description || '').slice(0, 140)}</div>
                <div className="project-card-meta">
                  <span>{fmtDate(p.updated_at || p.created_at)}</span>
                  {opening === p.id ? <span>Opening…</span> : <span className="project-card-arrow">→</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// MARKETING — what signed-out users see on /
// ───────────────────────────────────────────────────────────────────────────

function Marketing() {
  const { user, isAuthOpen, setIsAuthOpen } = useAppContext();

  // Bounced from a protected route (?login=1) → prompt to sign in.
  useEffect(() => {
    if (user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === '1') setIsAuthOpen(true);
  }, [user, setIsAuthOpen]);

  return (
    <div className="landing-layout">
      <PublicHeader showCTA />
      <main className="hero">
        <div className="hero-content">
          <p className="hero-eyebrow">FREE & OPEN-SOURCE · AI WEBSITE BUILDER</p>
          <h1>Free models.<br/>Real websites.</h1>
          <p className="hero-desc">
            Describe any website in plain language. Sitecraft routes your prompt
            to four free, open-source AI models and returns a complete single-page
            draft. Pick a different model anytime and iterate via chat.
          </p>
          <div className="hero-ctas">
            <button className="btn btn-primary hero-btn" onClick={() => setIsAuthOpen(true)}>
              Start Building
            </button>
            <button className="hero-ghost-btn" onClick={() => setIsAuthOpen(true)}>
              Sign in free →
            </button>
          </div>

          <div className="provider-strip">
            <span className="provider-strip-label">Powered by</span>
            <div className="provider-strip-pills">
              {PROVIDERS.map(p => (
                <div key={p.name} className="provider-pill">
                  <span className="provider-name">{p.name}</span>
                  <span className="provider-sep">·</span>
                  <span className="provider-model">{p.model}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="hero-mockup">
          <div className="mock-prompt-row">
            <span className="mock-prompt-tag">prompt</span>
            <span className="mock-prompt-text">
              A creative portfolio for a freelance designer, with project gallery and contact
            </span>
          </div>
          <div className="mock-window">
            <div className="mockup-header">
              <div className="traffic-lights">
                <div className="tl tl-r"></div>
                <div className="tl tl-y"></div>
                <div className="tl tl-g"></div>
              </div>
              <div className="mockup-url">elenavoss.design</div>
            </div>
            <div className="mock-site">
              <div className="mock-site-nav">
                <span className="mock-site-name">elena voss</span>
                <span className="mock-site-link">work</span>
                <span className="mock-site-link">about</span>
                <span className="mock-site-link active">contact</span>
              </div>
              <div className="mock-site-hero">
                <p className="mock-site-eyebrow">FREELANCE DESIGN · 2026</p>
                <h3 className="mock-site-headline">Brand systems<br/>for ambitious teams.</h3>
                <div className="mock-site-meta">
                  <span className="mock-site-meta-item">12 selected projects</span>
                  <span className="mock-site-meta-dot">·</span>
                  <span className="mock-site-meta-item">based in Lisbon</span>
                </div>
              </div>
              <div className="mock-site-grid">
                <div className="mock-site-tile" style={{ background: 'linear-gradient(135deg, #f59e0b, #f43f5e)' }}></div>
                <div className="mock-site-tile" style={{ background: 'linear-gradient(135deg, #06b6d4, #6366f1)' }}></div>
                <div className="mock-site-tile" style={{ background: 'linear-gradient(135deg, #10b981, #0891b2)' }}></div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <section className="features" id="features">
        <p className="features-eyebrow">WHY SITECRAFT</p>
        <h2 className="features-title">Built around the new free-tier frontier</h2>
        <div className="features-grid">
          {FEATURES.map(f => (
            <div className="feature-card" key={f.title}>
              <div className="feature-text">
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <PublicFooter />

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}

