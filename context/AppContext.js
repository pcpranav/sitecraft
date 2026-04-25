"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const { data: session } = useSession();
  const user = session?.user || null;

  // Projects State
  const [projectId, setProjectId] = useState(null);
  const [projectsList, setProjectsList] = useState([]);

  // Chat / Conversation State
  const [chatMessages, setChatMessages] = useState([]);

  // Current website HTML (latest generated)
  const [currentHtml, setCurrentHtml] = useState('');

  // Feature toggles
  const [features, setFeatures] = useState([]);

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
      return localStorage.getItem('WEBCRAFT_MODEL') || 'qwen-3-235b-a22b-instruct-2507';
    }
    return 'qwen-3-235b-a22b-instruct-2507';
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem('WEBCRAFT_THEME');
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }

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
    try {
      sessionStorage.setItem('WEBCRAFT_PROJECT', JSON.stringify({
        pages, css, js, desc, totalTokens, currentHtml, features
      }));
    } catch(e) {}
  }, [pages, css, js, desc, totalTokens, currentHtml, features]);

  useEffect(() => {
    if (!user) {
      setChatMessages([]);
      setImageUrls([]);
    }
  }, [user]);

  const value = {
    user,
    projectId, setProjectId, projectsList, setProjectsList,
    pages, setPages, css, setCss, js, setJs, desc, setDesc, history, setHistory,
    currentFile, setCurrentFile, view, setView, theme, setTheme, totalTokens, setTotalTokens,
    isAuthOpen, setIsAuthOpen,
    sidebarOpen, setSidebarOpen,
    selectedModel, setSelectedModel,
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
