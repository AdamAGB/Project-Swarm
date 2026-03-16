import { useState } from 'react';

interface Props {
  apiKey: string;
  onSave: (key: string) => void;
  onClear: () => void;
}

export function ApiKeyInput({ apiKey, onSave, onClear }: Props) {
  const [inputValue, setInputValue] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);

  const hasKey = apiKey.length > 0;

  if (hasKey) {
    return (
      <div className="api-key-bar">
        <span className="api-key-status">
          <span className="status-dot active" />
          API Key Connected
        </span>
        <button className="btn-text" onClick={onClear}>Change Key</button>
      </div>
    );
  }

  return (
    <div className="api-key-setup">
      <div className="api-key-header">
        <h3>Connect Your OpenAI API Key</h3>
        <p>Your key is stored locally and only used to make API calls.</p>
      </div>
      <div className="api-key-form">
        <div className="input-with-toggle">
          <input
            type={showKey ? 'text' : 'password'}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="sk-..."
            className="api-key-input"
          />
          <button
            className="btn-icon"
            onClick={() => setShowKey(!showKey)}
            title={showKey ? 'Hide' : 'Show'}
          >
            {showKey ? '🙈' : '👁'}
          </button>
        </div>
        <button
          className="btn-primary"
          onClick={() => onSave(inputValue)}
          disabled={!inputValue.startsWith('sk-')}
        >
          Save Key
        </button>
      </div>
    </div>
  );
}
