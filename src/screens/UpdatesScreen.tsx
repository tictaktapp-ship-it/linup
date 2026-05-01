import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface UpdateHistoryEntry {
  id: string;
  version: string;
  channel: string;
  applied_at: string;
  status: string;
}

export default function UpdatesScreen() {
  const [version, setVersion] = useState('');
  const [channel, setChannel] = useState('stable');
  const [history, setHistory] = useState<UpdateHistoryEntry[]>([]);
  const [checking, setChecking] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);

  useEffect(() => {
    invoke<string>('get_current_version').then(setVersion).catch(() => {});
    invoke<string>('get_update_channel').then(setChannel).catch(() => {});
    invoke<UpdateHistoryEntry[]>('get_update_history').then(setHistory).catch(() => {});
  }, []);

  const handleCheckNow = async () => {
    setChecking(true); setUpdateStatus(null);
    try {
      const status = await invoke<string>('check_for_update');
      setUpdateStatus(status === 'no_update' ? 'You are on the latest version.' : status);
    } catch (e) { setUpdateStatus(String(e)); }
    finally { setChecking(false); }
  };

  const handleChannelChange = async (newChannel: string) => {
    await invoke('set_update_channel', { channel: newChannel }).catch(() => {});
    setChannel(newChannel);
  };

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 560 }}>
      <div>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Current version</div>
        <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>{version || '...'}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Update channel</div>
          <select
            value={channel}
            onChange={e => handleChannelChange(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', fontSize: 13 }}
          >
            <option value='stable'>Stable</option>
            <option value='beta'>Beta</option>
            <option value='canary'>Canary</option>
          </select>
        </div>
        <button
          onClick={handleCheckNow}
          disabled={checking}
          style={{ marginTop: 18, padding: '8px 16px', background: 'var(--color-accent-primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: checking ? 'not-allowed' : 'pointer', opacity: checking ? 0.6 : 1, fontSize: 13 }}
        >
          {checking ? 'Checking...' : 'Check now'}
        </button>
      </div>
      {updateStatus && <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{updateStatus}</div>}
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 12 }}>Update history</div>
        {history.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>No updates applied yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.filter(h => h.id !== 'channel').map(h => (
              <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--color-bg-secondary)', borderRadius: 6, fontSize: 13 }}>
                <span style={{ fontFamily: 'monospace' }}>{h.version}</span>
                <span style={{ color: 'var(--color-text-tertiary)' }}>{h.channel}</span>
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>{new Date(h.applied_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
