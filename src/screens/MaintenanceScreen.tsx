import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface MaintenanceRun {
  id: string;
  project_id: string;
  run_type: string;
  status: string;
  packages_checked: number;
  vulnerabilities_found: number;
  packages_updated: number;
  artifact_id: string | null;
  created_at: string;
  completed_at: string | null;
}

interface Props { projectId: string; }

export default function MaintenanceScreen({ projectId }: Props) {
  const [history, setHistory] = useState<MaintenanceRun[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = () =>
    invoke<MaintenanceRun[]>('get_maintenance_history', { projectId })
      .then(setHistory)
      .catch(e => setError(String(e)));

  useEffect(() => { loadHistory(); }, [projectId]);

  const handleRunCheck = async () => {
    setRunning(true); setError(null);
    try {
      await invoke('run_maintenance_check', { projectId });
      await loadHistory();
    } catch (e) { setError(String(e)); }
    finally { setRunning(false); }
  };

  const handleApply = async (maintenanceId: string) => {
    try {
      await invoke('apply_maintenance_patch', { projectId, maintenanceId });
      await loadHistory();
    } catch (e) { setError(String(e)); }
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Maintenance</h2>
        <button
          onClick={handleRunCheck}
          disabled={running}
          style={{ background: 'var(--color-accent-primary)', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: running ? 'not-allowed' : 'pointer', opacity: running ? 0.6 : 1 }}
        >
          {running ? 'Running check...' : 'Run check now'}
        </button>
      </div>

      {error && <div style={{ color: 'var(--color-text-danger)', fontSize: 13 }}>{error}</div>}

      {history.length === 0 ? (
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>No maintenance runs yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {history.map(run => (
            <div key={run.id} style={{ background: 'var(--color-bg-secondary)', borderRadius: 8, padding: 16, border: '0.5px solid var(--color-border-tertiary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{new Date(run.created_at).toLocaleDateString()}</span>
                <span style={{ fontSize: 12, color: run.status === 'complete' ? 'var(--color-text-success)' : 'var(--color-text-secondary)' }}>{run.status}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: run.status === 'pending' ? 12 : 0 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Packages checked<br /><strong style={{ fontSize: 16 }}>{run.packages_checked}</strong></div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Vulnerabilities<br /><strong style={{ fontSize: 16, color: run.vulnerabilities_found > 0 ? 'var(--color-text-danger)' : 'inherit' }}>{run.vulnerabilities_found}</strong></div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Updated<br /><strong style={{ fontSize: 16 }}>{run.packages_updated}</strong></div>
              </div>
              {run.status === 'pending' && (
                <button
                  onClick={() => handleApply(run.id)}
                  style={{ background: 'var(--color-accent-primary)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer' }}
                >
                  Approve and apply
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
