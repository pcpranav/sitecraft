"use client";
import React, { useEffect } from 'react';
import Link from 'next/link';
import { useAppContext } from '@/context/AppContext';
import AuthModal from '@/components/AuthModal';
import BrandMark from '@/components/BrandMark';

const PROVIDERS = [
  { name: 'Cerebras', model: 'GPT-OSS 120B' },
  { name: 'Groq', model: 'Llama 4 Scout' },
  { name: 'OpenRouter', model: 'Free Auto' },
  { name: 'Cloudflare', model: 'Qwen3 30B' },
];

const FEATURES = [
  { title: 'Free models only',  desc: 'Four 70B-class open-source endpoints. No paid tiers, no surprise bills.' },
  { title: 'Switch mid-thread', desc: 'Pick a different model at any turn — same conversation, different brain.' },
  { title: 'Yours to export',   desc: 'Download a ZIP of single-page HTML. Host anywhere, edit anything.' },
  { title: 'Iterative by chat', desc: 'Refine via follow-up prompts. Undo a turn, regenerate with a different style.' },
];

export default function LandingPage() {
  const { user, isAuthOpen, setIsAuthOpen } = useAppContext();

  // Bounced from a protected route (?login=1) → prompt to sign in.
  useEffect(() => {
    if (user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === '1') setIsAuthOpen(true);
  }, [user, setIsAuthOpen]);

  return (
    <div className="landing-layout">
      <header className="landing-header">
        <Link href="/" className="landing-logo">
          <BrandMark size={32} className="landing-logo-icon" />
          <div className="landing-logo-name">Sitecraft</div>
        </Link>
        <nav className="landing-nav">
          {user ? (
            <Link href="/studio" className="btn btn-primary">Open Studio →</Link>
          ) : (
            <>
              <button className="landing-login-btn" onClick={() => setIsAuthOpen(true)}>
                Log in
              </button>
              <button className="btn btn-primary landing-cta-btn" onClick={() => setIsAuthOpen(true)}>
                Get Started
              </button>
            </>
          )}
        </nav>
      </header>

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
            {user ? (
              <Link href="/studio" className="btn btn-primary hero-btn">
                Start Building
              </Link>
            ) : (
              <button className="btn btn-primary hero-btn" onClick={() => setIsAuthOpen(true)}>
                Start Building
              </button>
            )}
            {!user && (
              <button className="hero-ghost-btn" onClick={() => setIsAuthOpen(true)}>
                Sign in free →
              </button>
            )}
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
          {/* Prompt → output. Doesn't pretend to be the studio chrome; shows
              the value prop instead: a sentence in, a real-looking page out. */}
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

      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} Sitecraft</span>
        {user ? (
          <Link href="/studio" className="landing-login-btn">Open Studio →</Link>
        ) : (
          <button className="landing-login-btn" onClick={() => setIsAuthOpen(true)}>
            Get Started for free →
          </button>
        )}
      </footer>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}
