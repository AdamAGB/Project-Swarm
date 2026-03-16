import { useState, useEffect } from 'react';

interface ApiKeyInputProps {
  onApiKeyChange: (apiKey: string) => void;
}

export function ApiKeyInput({ onApiKeyChange }: ApiKeyInputProps) {
  const [apiKey, setApiKey] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('openai_api_key');
    if (savedKey) {
      setApiKey(savedKey);
      onApiKeyChange(savedKey);
    }
  }, [onApiKeyChange]);

  const handleSave = () => {
    localStorage.setItem('openai_api_key', apiKey);
    onApiKeyChange(apiKey);
    alert('API key saved!');
  };

  const handleClear = () => {
    setApiKey('');
    localStorage.removeItem('openai_api_key');
    onApiKeyChange('');
  };

  return (
    <div className="api-key-input">
      <h3>OpenAI API Key</h3>
      <div className="input-group">
        <input
          type={isVisible ? 'text' : 'password'}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          className="api-key-field"
        />
        <button onClick={() => setIsVisible(!isVisible)} className="btn-secondary">
          {isVisible ? 'Hide' : 'Show'}
        </button>
        <button onClick={handleSave} disabled={!apiKey} className="btn-primary">
          Save
        </button>
        <button onClick={handleClear} className="btn-secondary">
          Clear
        </button>
      </div>
      <p className="help-text">
        Get your API key from{' '}
        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
          platform.openai.com/api-keys
        </a>
      </p>
    </div>
  );
}
