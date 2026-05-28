"use client";
// components/PublicChrome.jsx
// Header + footer used outside the studio: marketing page, projects-home,
// and the about page. Kept here (not in app/page.js) so other routes can
// import without dragging the marketing page along.

import React from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useAppContext } from '@/context/AppContext';
import BrandMark from '@/components/BrandMark';
import Icon from '@/components/Icon';

export const GITHUB_URL = 'https://github.com/pcpranav/sitecraft';

export function PublicHeader({ showCTA = false, onSignInClick }) {
  const { user, setIsAuthOpen } = useAppContext();
  const openSignIn = onSignInClick || (() => setIsAuthOpen(true));

  return (
    <header className="landing-header">
      <Link href="/" className="landing-logo">
        <BrandMark size={32} className="landing-logo-icon" />
        <div className="landing-logo-name">Sitecraft</div>
      </Link>
      <nav className="landing-nav">
        <Link href="/about" className="landing-login-btn">About</Link>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="landing-login-btn icon-only"
          title="GitHub"
          aria-label="GitHub"
        >
          <Icon name="github" size={18} />
        </a>
        {user ? (
          <>
            <Link href="/studio" className="landing-login-btn">Studio →</Link>
            <button
              className="landing-login-btn"
              onClick={() => signOut({ callbackUrl: '/' })}
              title="Sign out"
            >
              Sign out
            </button>
          </>
        ) : showCTA ? (
          <>
            <button className="landing-login-btn" onClick={openSignIn}>Log in</button>
            <button className="btn btn-primary landing-cta-btn" onClick={openSignIn}>
              Get Started
            </button>
          </>
        ) : (
          <button className="landing-login-btn" onClick={openSignIn}>Sign in</button>
        )}
      </nav>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="landing-footer">
      <span>© {new Date().getFullYear()} Sitecraft</span>
      <span className="landing-footer-links">
        <Link href="/about">About</Link>
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
      </span>
    </footer>
  );
}
