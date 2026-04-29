import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface OnboardingStepProps { onNext: (data?: Record<string, unknown>) => void; onBack: () => void }

const Step4: React.FC<OnboardingStepProps> = ({ onNext, onBack }) => {
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    setTesting(true); setError('');
    try {
      await invoke('set_secret', { key: 'anthropic', value: apiKey });
      onNext();
    } catch (e) {
      setError(String(e));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 480, margin: '0 auto', width: '100%' }}>
      <h2 style={{ margin: 0 }}>Connect Anthropic</h2>
      <p style={{ color: '#6B6B66', margin: 0, fontSize: 14 }}>Your API key is stored securely in your OS keychain and never leaves your machine.</p>
      <label style={{ fontSize: 13, fontWeight: 500 }}>Anthropic API Key
        <input type="password" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #E4E4E0', fontSize: 14, marginTop: 4, boxSizing: 'border-box' }}
          value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-ant-..." />
      </label>
      {error && <p style={{ color: '#DC2626', fontSize: 13, margin: 0 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={onBack} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #E4E4E0', background: '#fff', cursor: 'pointer' }}>← Back</button>
        <button onClick={handleConnect} disabled={!apiKey || testing}
          style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: !apiKey || testing ? '#E4E4E0' : '#1D4ED8', color: !apiKey || testing ? '#9B9B96' : '#fff', fontWeight: 600, cursor: !apiKey || testing ? 'not-allowed' : 'pointer' }}>
          {testing ? 'Saving...' : 'Connect →'}
        </button>
      </div>
    </div>
  );
};

export default Step4;