import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createMobileHtml, GAME_STORAGE_KEYS, parseStorageChange, StorageWriter } from '@/lib/storage-bridge';

const template: string = require('../lib/generated/web-game.js');
const domain = process.env.EXPO_PUBLIC_DOMAIN;
const apiOrigin = domain ? `https://${domain}` : null;

export function useWebGameShell() {
  const [html, setHtml] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const writer = useRef(new StorageWriter(AsyncStorage));
  useEffect(() => {
    let active = true;
    setLoadError(false);
    AsyncStorage.multiGet([...GAME_STORAGE_KEYS]).then((items) => {
      const content = createMobileHtml(template, Object.fromEntries(items), apiOrigin);
      if (active) setHtml(content);
    }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [attempt]);
  const persist = useCallback((data: unknown) => {
    const change = parseStorageChange(data);
    if (!change) return;
    void writer.current.write(change).then(() => setSaveError(false)).catch(() => setSaveError(true));
  }, []);
  const retrySave = () => {
    void writer.current.write().then(() => setSaveError(false)).catch(() => setSaveError(true));
  };
  return { html, loadError, saveError, persist, retrySave, retryLoad: () => setAttempt((value) => value + 1) };
}