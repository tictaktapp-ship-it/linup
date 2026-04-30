import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface PreviewButtonProps {
  projectId: string;
  stageState: string;
}

export default function PreviewButton({ projectId, stageState }: PreviewButtonProps) {
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (stageState !== 'awaiting_approval' && stageState !== 'complete') return null;

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await invoke<{ url: string }>('start_preview_server', { projectId });
      setRunning(true);
      await invoke('open_preview_window', { url: status.url });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await invoke('stop_preview_server', { projectId });
      setRunning(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {loading ? (
        <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
          {running ? 'Stopping...' : 'Starting preview... (up to 30s)'}
        </span>
      ) : running ? (
        <button onClick={handleStop} style={{ background: 'var(--color-bg-danger)', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}>
          Stop preview
        </button>
      ) : (
        <button onClick={handleStart} style={{ background: 'var(--color-accent-primary)', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}>
          Preview app
        </button>
      )}
      {error && <span style={{ color: 'var(--color-text-danger)', fontSize: 12 }}>{error}</span>}
    </div>
  );
}