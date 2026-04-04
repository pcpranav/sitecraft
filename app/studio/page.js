"use client";
import React from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import PreviewFrame from '@/components/PreviewFrame';

export default function Home() {
  return (
    <div className="studio-root">
      <Header />
      <div className="workspace">
        <Sidebar />
        <PreviewFrame />
      </div>
    </div>
  );
}
