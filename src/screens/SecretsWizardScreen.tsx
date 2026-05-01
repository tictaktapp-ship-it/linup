import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface SecretEntry {
  key: string;
  label: string;
  description: string;
  provider: string;
  setup_url: string | null;
  required: boolean;
  group: string | null;
  validated: boolean;
  saved: boolean;
}

interface WizardProgress {
  total: number;
  validated: number;
  required_complete: boolean;
  all_complete: boolean;
}

interface ValidationResult {
  valid: boolean;
  message: string;
}

interface Props { projectId: string; }

export default function SecretsWizardScreen({ projectId }: Props) {
  const [secrets, setSecrets] = useState<SecretEntry[]>([]);
  const [progress, setProgress] = useState<WizardProgress>({ total: 0, validated: 0, required_complete: false, all_complete: false });
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    invoke<SecretEntry[]>('load_secrets_manifest', { projectId })
      .then(s => { setSecrets(s); setValue(''); setValidation(null); })
      .catch(e => setError(String(e)));
    invoke<WizardProgress>('get_wizard_progress', { projectId })
      .then(setProgress)
      .catch(() => {});
  };

  useEffect(() => { loadData(); }, [projectId]);

  const handleTest = async () => {
    if (!secrets[index]) return;
    setTesting(true); setValidation(null);
    try {
      const result = await invoke<ValidationResult>('validate_secret', { key: secrets[index].key, value });
      setValidation(result);
    } catch (e) { setError(String(e)); }
    finally { setTesting(false); }
  };

  const handleSave = async () => {
    if (!secrets[index]) return;
    setSaving(true);
    try {
      await invoke('save_wizard_secret', { projectId, key: secrets[index].key, value });
      setIndex(i => i + 1);
      setValue(''); setValidation(null);
      loadData();
    } catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  };

  const handleSkip = () => { setIndex(i => i + 1); setValue(''); setValidation(null); };

  if (progress.all_complete || index >= secrets.length) {
    return (
      <div style={{ padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text-primary)' }}>All required secrets saved.</div>
        <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>You can now deploy.</div>
        <a href={'#/'} style={{ color: 'var(--color-accent-primary)', fontSize: 14 }}>Back to pipeline</a>
      </div>
    );
  }

  const secret = secrets[index];
  if (!secret) return null;

  return (
    <div style={{ padding: 32, maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ background: 'var(--color-border-tertiary)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
        <div style={{ background: 'var(--color-accent-primary)', height: '100%', width: (progress.validated / Math.max(progress.total, 1) * 100) + '%', transition: 'width 0.3s' }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{secret.group ?? 'General'}</div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8 }}>{secret.label}</div>
        <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{secret.description}</div>
      </div>
      {secret.setup_url && (
        <a href={secret.setup_url} target='_blank' rel='noopener noreferrer' style={{ fontSize: 13, color: 'var(--color-accent-primary)' }}>Get this key →</a>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => { setValue(e.target.value); setValidation(null); }}
          placeholder='Paste your key here'
          style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)', fontSize: 13, background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
        />
        <button onClick={() => setShow(s => !s)} style={{ padding: '8px 12px', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 6, background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
      {validation && (
        <div style={{ fontSize: 13, color: validation.valid ? 'var(--color-text-success)' : 'var(--color-text-danger)' }}>
          {validation.valid ? '✓ ' : '✗ '}{validation.message}
        </div>
      )}
      {error && <div style={{ fontSize: 13, color: 'var(--color-text-danger)' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleTest} disabled={testing || !value} style={{ padding: '8px 16px', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 6, background: 'transparent', cursor: 'pointer', fontSize: 13 }}>
          {testing ? 'Testing...' : 'Test connection'}
        </button>
        <button onClick={handleSave} disabled={saving || !validation?.valid} style={{ padding: '8px 16px', background: 'var(--color-accent-primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: saving || !validation?.valid ? 'not-allowed' : 'pointer', opacity: saving || !validation?.valid ? 0.6 : 1, fontSize: 13 }}>
          {saving ? 'Saving...' : 'Save & continue'}
        </button>
        {!secret.required && (
          <button onClick={handleSkip} style={{ padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--color-text-tertiary)' }}>Skip</button>
        )}
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{index + 1} of {secrets.length} secrets</div>
    </div>
  );
}
