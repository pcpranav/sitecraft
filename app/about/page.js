"use client";
import React, { useState } from 'react';
import { PublicHeader, PublicFooter, GITHUB_URL } from '@/components/PublicChrome';
import Icon from '@/components/Icon';

// Gmail "+" alias — easy to filter or kill if it gets scraped.
const FEEDBACK_EMAIL = 'pcpranavchandra+sitecraft@gmail.com';

export default function AboutPage() {
  const [feedback, setFeedback] = useState('');

  const submitAsIssue = () => {
    const body = feedback.trim();
    if (!body) return;
    const url = `${GITHUB_URL}/issues/new?title=${encodeURIComponent('Feedback')}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const submitByEmail = () => {
    const body = feedback.trim();
    if (!body) return;
    const url = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Sitecraft feedback')}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  };

  return (
    <div className="landing-layout">
      <PublicHeader />

      <main className="about-main">
        <section className="about-section">
          <p className="hero-eyebrow">ABOUT</p>
          <h1 className="about-title">Sitecraft is built by a backend engineer who ships side projects.</h1>
          <p className="about-lead">
            Senior Software Engineer (Backend). Building scalable APIs, AI/LLM-powered
            products, and event-driven systems. Writing about backend, AI orchestration,
            and shipping side projects.
          </p>
          <div className="about-cta-row">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              <Icon name="github" size={14} />
              View on GitHub
            </a>
            <a
              href={`${GITHUB_URL}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className="hero-ghost-btn"
            >
              Browse issues →
            </a>
            <a
              href="https://pranavs-garage.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: 'var(--font-mono), ui-monospace, monospace',
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                padding: '8px 16px',
                background: '#F59E0B',
                color: '#0a0a0a',
                borderRadius: '2px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#fbbf24'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#F59E0B'; }}
            >
              Visit the Garage →
            </a>
          </div>
        </section>

        <section className="about-section about-feedback-section">
          <h2 className="about-section-title">Report a bug or share feedback</h2>
          <p className="about-section-desc">
            Sitecraft is open source. Tell me what's broken, what's missing,
            or what you'd want next — pick whichever channel is easier.
          </p>
          <textarea
            className="about-feedback"
            placeholder="What's on your mind? Describe the bug or the idea…"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={6}
          />
          <div className="about-feedback-actions">
            <button
              className="btn btn-primary"
              onClick={submitAsIssue}
              disabled={!feedback.trim()}
            >
              Open as GitHub issue
            </button>
            <button
              className="btn"
              onClick={submitByEmail}
              disabled={!feedback.trim()}
            >
              Or send by email
            </button>
            <span className="about-feedback-hint">
              GitHub issue opens in a new tab; email opens your mail client.
            </span>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
