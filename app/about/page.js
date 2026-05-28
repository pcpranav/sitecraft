"use client";
import React, { useState } from 'react';
import { PublicHeader, PublicFooter, GITHUB_URL } from '@/components/PublicChrome';
import Icon from '@/components/Icon';

export default function AboutPage() {
  const [feedback, setFeedback] = useState('');

  const submitFeedback = () => {
    const body = feedback.trim();
    if (!body) return;
    // Open a prefilled GitHub issue. The user already has the OSS repo set
    // up; this avoids us needing a feedback inbox / email infra.
    const url = `${GITHUB_URL}/issues/new?title=${encodeURIComponent('Feedback')}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
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
          </div>
        </section>

        <section className="about-section about-feedback-section">
          <h2 className="about-section-title">Report a bug or share feedback</h2>
          <p className="about-section-desc">
            Sitecraft is open source. Tell me what's broken, what's missing,
            or what you'd want next — I'll see it as a GitHub issue.
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
              onClick={submitFeedback}
              disabled={!feedback.trim()}
            >
              Open as GitHub issue
            </button>
            <span className="about-feedback-hint">
              Opens a prefilled GitHub issue in a new tab.
            </span>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
