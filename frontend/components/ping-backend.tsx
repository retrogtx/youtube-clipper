'use client';

import { useEffect } from 'react';

export default function PingBackend() {
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/ping').catch(() => { /* ignore errors */ });
    }, 5000); // 5 seconds
    return () => clearInterval(interval);
  }, []);

  return null;
} 