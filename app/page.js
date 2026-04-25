"use client";
import React from 'react';
import Link from 'next/link';
import { useAppContext } from '@/context/AppContext';
import AuthModal from '@/components/AuthModal';

const PROVIDERS = [
  { name: 'Cerebras', model: 'Qwen 3 235B' },
  { name: 'Groq', model: 'Llama 4 Scout' },
  { name: 'OpenRouter', model: 'Ling-2.6 Flash' },
  { name: 'Cloudflare', model: 'GPT-OSS 120B' },
];

const FEATURES = [
  { title: 'Free models only',  desc: 'Four 70B-class open-source endpoints. No paid tiers, no surprise bills.' },
  { title: 'Switch mid-thread', desc: 'Pick a different model at any turn — same conversation, different brain.' },
  { title: 'Yours to export',   desc: 'Download a ZIP of single-page HTML. Host anywhere, edit anything.' },
  { title: 'Iterative by chat', desc: 'Refine via follow-up prompts. Undo a turn, regenerate with a different style.' },
];

export default function LandingPage() {
  const { user, isAuthOpen, setIsAuthOpen } = useAppContext();

  return (
    <div className="landing-layout">
      <header className="landing-header">
        <Link href="/" className="landing-logo">
          <div className="landing-logo-icon">S</div>
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
            <Link href="/studio" className="btn btn-primary hero-btn">
              Start Building
            </Link>
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
          <div className="mockup-header">
            <div className="traffic-lights">
              <div className="tl tl-r"></div>
              <div className="tl tl-y"></div>
              <div className="tl tl-g"></div>
            </div>
            <div className="mockup-url">sitecraft / studio</div>
          </div>
          <div className="mockup-body">
            <div className="mockup-sidebar">
              <div className="mock-sidebar-label"></div>
              <div className="mock-sb-item active"></div>
              <div className="mock-sb-item"></div>
              <div className="mock-sb-item"></div>
              <div className="mock-sb-label2"></div>
              <div className="mock-prompt"></div>
              <div className="mock-btn"></div>
            </div>
            <div className="mockup-preview">
              <div className="mock-h1"></div>
              <div className="mock-line"></div>
              <div className="mock-line short"></div>
              <div className="mock-cards">
                <div className="mock-card"></div>
                <div className="mock-card"></div>
                <div className="mock-card"></div>
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
