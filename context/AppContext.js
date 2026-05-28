"use client";
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { DEFAULT_MODEL_ID, DEPRECATED_MODEL_IDS } from '@/lib/models';

const AppContext = createContext();

// Storage keys. The legacy WEBCRAFT_* keys predate the Sitecraft rename;
// readStorage falls back to them once, then writes under the new key so
// returning users don't lose their settings.
const STORAGE = {
  model:   { current: 'SITECRAFT_MODEL',   legacy: 'WEBCRAFT_MODEL' },
  theme:   { current: 'SITECRAFT_THEME',   legacy: 'WEBCRAFT_THEME' },
  project: { current: 'SITECRAFT_PROJECT', legacy: 'WEBCRAFT_PROJECT' },
};

function readStorage(store, key) {
  if (typeof window === 'undefined') return null;
  const fromCurrent = store.getItem(key.current);
  if (fromCurrent != null) return fromCurrent;
  const fromLegacy = store.getItem(key.legacy);
  if (fromLegacy != null) {
    store.setItem(key.current, fromLegacy);
    store.removeItem(key.legacy);
  }
  return fromLegacy;
}

export function AppProvider({ children }) {
  const { data: session, status: sessionStatus } = useSession();
  const user = session?.user || null;

  // Projects State
  const [projectId, setProjectId] = useState(null);
  const [projectsList, setProjectsList] = useState([]);

  // Chat / Conversation State
  const [chatMessages, setChatMessages] = useState([]);

  // Current website HTML (latest generated)
  const [currentHtml, setCurrentHtml] = useState('');

  // In-flight partial HTML while a generation is streaming. PreviewFrame
  // uses this in place of currentHtml so the iframe fills in as the model
  // writes. Cleared when the stream completes (or fails).
  const [streamingHtml, setStreamingHtml] = useState('');

  // Feature toggles
  const [features, setFeatures] = useState([]);

  // Uploaded image URLs
  const [imageUrls, setImageUrls] = useState([]);

  const [desc, setDesc] = useState('');
  const [history, setHistory] = useState([]);

  // UI State
  const [view, setView] = useState('preview');
  const [theme, setTheme] = useState('dark');
  const [totalTokens, setTotalTokens] = useState(0);

  // Auth Modal State
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Model selection. DEPRECATED_MODEL_IDS (in @/lib/models) catches slugs that
  // vanished from their provider — returning users with one cached in
  // localStorage would otherwise keep hitting 404 forever.
  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = readStorage(localStorage, STORAGE.model);
      if (saved && !DEPRECATED_MODEL_IDS.has(saved)) return saved;
    }
    return DEFAULT_MODEL_ID;
  });

  // Persist model selection whenever it changes. Avoids the duplicate
  // localStorage.setItem call that used to live inside the picker onClick.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE.model.current, selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    const savedTheme = readStorage(localStorage, STORAGE.theme);
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    try {
      const raw = readStorage(sessionStorage, STORAGE.project);
      if (raw) {
        const data = JSON.parse(raw);
        // currentHtml is the single source of truth now; legacy snapshots may
        // have stored it under data.pages['index.html'] instead.
        const html = data.currentHtml || data.pages?.['index.html'] || '';
        setCurrentHtml(html);
        setDesc(data.desc || '');
        setTotalTokens(data.totalTokens || 0);
        setFeatures(data.features || []);
      }
    } catch(e) {}
  }, []);

  // Debounce sessionStorage writes — without this we serialize project state
  // on every keystroke / state tick, which gets heavy on long conversations.
  const projectSaveTimer = useRef(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    clearTimeout(projectSaveTimer.current);
    projectSaveTimer.current = setTimeout(() => {
      try {
        sessionStorage.setItem(STORAGE.project.current, JSON.stringify({
          currentHtml, desc, totalTokens, features
        }));
      } catch(e) {}
    }, 300);
    return () => clearTimeout(projectSaveTimer.current);
  }, [desc, totalTokens, currentHtml, features]);

  // Wipe per-session state ONLY when NextAuth has definitively resolved to
  // unauthenticated. Without the status check this fires during the initial
  // 'loading' phase too, which can clobber in-progress chat the user just
  // started before next-auth's session call completes.
  useEffect(() => {
    if (sessionStatus !== 'unauthenticated') return;
    setChatMessages([]);
    setImageUrls([]);
  }, [sessionStatus]);

  const value = {
    user,
    projectId, setProjectId, projectsList, setProjectsList,
    desc, setDesc, history, setHistory,
    view, setView, theme, setTheme, totalTokens, setTotalTokens,
    isAuthOpen, setIsAuthOpen,
    sidebarOpen, setSidebarOpen,
    selectedModel, setSelectedModel,
    chatMessages, setChatMessages,
    currentHtml, setCurrentHtml,
    streamingHtml, setStreamingHtml,
    features, setFeatures,
    imageUrls, setImageUrls,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  return useContext(AppContext);
}
