"use client";
import React from 'react';
import Link from 'next/link';
import { useAppContext } from '@/context/AppContext';
import AuthModal from '@/components/AuthModal';

export default function LandingPage() {
  const { user, isAuthOpen, setIsAuthOpen } = useAppContext();

  return (
    <div className="landing-layout">
      {/* Sticky Glassmorphic Header */}
      <header className="landing-header">
        <Link href="/" className="landing-logo">
          <div className="landing-logo-icon">W</div>
          <div className="landing-logo-name">Webcraft<span className="landing-logo-sub">STUDIO</span></div>
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

      {/* Hero */}
      <main className="hero">
        <div className="hero-content">
          <p className="hero-eyebrow">AI-POWERED WEBSITE BUILDER</p>
          <h1>From prompt to<br/>production.</h1>
          <p className="hero-desc">
            Describe any website in plain language. Webcraft Studio instantly generates
            a fully styled, interactive, production-ready codebase—no guesswork required.
          </p>
          <div className="hero-ctas">
            <Link href="/studio" className="btn btn-primary hero-btn">
              Start Building
            </Link>
            <button className="hero-ghost-btn" onClick={() => setIsAuthOpen(true)}>
              Sign in free →
            </button>
          </div>
        </div>

        {/* Mockup window */}
        <div className="hero-mockup">
          <div className="mockup-header">
            <div className="traffic-lights">
              <div className="tl tl-r"></div>
              <div className="tl tl-y"></div>
              <div className="tl tl-g"></div>
            </div>
            <div className="mockup-url">webcraft.studio / studio</div>
          </div>
          <div className="mockup-body">
            {/* Sidebar mockup */}
            <div className="mockup-sidebar">
              <div className="mock-sidebar-label"></div>
              <div className="mock-sb-item active"></div>
              <div className="mock-sb-item"></div>
              <div className="mock-sb-item"></div>
              <div className="mock-sb-label2"></div>
              <div className="mock-prompt"></div>
              <div className="mock-btn"></div>
            </div>
            {/* Preview mockup */}
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

      {/* Features section */}
      <section className="features" id="features">
        <div className="features-grid">
          {[
            { icon: '⚡', title: 'Instant generation', desc: 'Get a complete website in under 10 seconds using best-in-class AI models.' },
            { icon: '🎨', title: 'Fully styled', desc: 'Generated sites include responsive CSS and are mobile-ready out of the box.' },
            { icon: '☁️', title: 'Cloud sync', desc: 'Save projects to the cloud, access them anywhere, anytime.' },
            { icon: '📦', title: 'Export & deploy', desc: 'Download your source code as a zip or deploy directly to a live URL.' },
          ].map(f => (
            <div className="feature-card" key={f.title}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} Webcraft Studio</span>
        <button className="landing-login-btn" onClick={() => setIsAuthOpen(true)}>
          Get Started for free →
        </button>
      </footer>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}
