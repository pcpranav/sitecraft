"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [supabaseClient, setSupabaseClient] = useState(null);
  const [user, setUser] = useState(null);

  // Projects State
  const [projectId, setProjectId] = useState(null);
  const [projectsList, setProjectsList] = useState([]);

  // Chat / Conversation State
  const [chatMessages, setChatMessages] = useState([]);
  // Each message: { id, role: 'user'|'assistant', content: string, timestamp: number, model?: string }

  // Current website HTML (latest generated)
  const [currentHtml, setCurrentHtml] = useState('');

  // Feature toggles
  const [features, setFeatures] = useState([]);
  // Possible: 'auth', 'contact-form', 'image-gallery', 'multi-page'

  // Uploaded image URLs
  const [imageUrls, setImageUrls] = useState([]);

  // Legacy state for backward compat with cloud save
  const [pages, setPages] = useState({});
  const [css, setCss] = useState('');
  const [js, setJs] = useState('');
  const [desc, setDesc] = useState('');
  const [history, setHistory] = useState([]);

  // UI State
  const [currentFile, setCurrentFile] = useState('index.html');
  const [view, setView] = useState('preview');
  const [theme, setTheme] = useState('dark');
  const [totalTokens, setTotalTokens] = useState(0);

  // Auth Modal State
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Model selection
  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('WEBCRAFT_MODEL') || 'gemini-2.5-flash';
    }
    return 'gemini-2.5-flash';
  });

  useEffect(() => {
    // Load config and init Supabase
    fetch('/api/config').then(res => res.json()).then(conf => {
      if (conf.SUPABASE_URL && conf.SUPABASE_ANON_KEY) {
        const client = createClient(conf.SUPABASE_URL, conf.SUPABASE_ANON_KEY);
        setSupabaseClient(client);
      }
    }).catch(e => console.warn('Config fetch failed:', e));

    const savedTheme = localStorage.getItem('WEBCRAFT_THEME');
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    // Restore minimal project state on reload — but NOT chat history or
    // uploaded image data URLs (kept in-memory only for privacy).
    try {
      const raw = sessionStorage.getItem('WEBCRAFT_PROJECT');
      if (raw) {
        const data = JSON.parse(raw);
        setPages(data.pages || {});
        setCss(data.css || '');
        setJs(data.js || '');
        setDesc(data.desc || '');
        setTotalTokens(data.totalTokens || 0);
        setCurrentHtml(data.currentHtml || '');
        setFeatures(data.features || []);
      }
    } catch(e) {}
  }, []);

  useEffect(() => {
    if (!supabaseClient) return;

    const { data: authListener } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [supabaseClient]);

  // Save minimal project state on change. Chat messages, full history, and
  // uploaded base64 images are intentionally NOT persisted to sessionStorage.
  useEffect(() => {
    try {
      sessionStorage.setItem('WEBCRAFT_PROJECT', JSON.stringify({
        pages, css, js, desc, totalTokens, currentHtml, features
      }));
    } catch(e) {}
  }, [pages, css, js, desc, totalTokens, currentHtml, features]);

  // Clear in-memory chat + images on sign-out.
  useEffect(() => {
    if (!user) {
      setChatMessages([]);
      setImageUrls([]);
    }
  }, [user]);

  const value = {
    supabaseClient, user, setUser,
    projectId, setProjectId, projectsList, setProjectsList,
    pages, setPages, css, setCss, js, setJs, desc, setDesc, history, setHistory,
    currentFile, setCurrentFile, view, setView, theme, setTheme, totalTokens, setTotalTokens,
    isAuthOpen, setIsAuthOpen,
    sidebarOpen, setSidebarOpen,
    selectedModel, setSelectedModel,
    // New chat state
    chatMessages, setChatMessages,
    currentHtml, setCurrentHtml,
    features, setFeatures,
    imageUrls, setImageUrls,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  return useContext(AppContext);
}
