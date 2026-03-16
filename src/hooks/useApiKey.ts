import { useState } from 'react';

const STORAGE_KEY = 'openai_api_key';

export function useApiKey() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '');

  const saveKey = (key: string) => {
    localStorage.setItem(STORAGE_KEY, key);
    setApiKey(key);
  };

  const clearKey = () => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKey('');
  };

  return { apiKey, saveKey, clearKey, hasKey: apiKey.length > 0 };
}
