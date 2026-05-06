import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { createProject } from '../lib/supabaseService';

export default function OnboardingFlow() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [folder, setFolder] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const pickFolder = async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === 'string') setFolder(selected);
    } catch { /* ignore */ }
  };

  const handleCreate = async () => {
    setCreating(true); setError(null);
    try {
      const project = await createProject(name, description);
      if (!project) throw new Error('Project creation returned null — are you logged in?');
      window.location.hash = '/project/' + project.id + '/stage/0';
    } catch (e) {
      setError('Failed to create project: ' + String(e));
      setCreating(false);
    }
  };

  const card: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 20, padding: '48px 40px', maxWidth: 520, margin: '40px auto 0', width: '100%' };
  const label: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6, display: 'block' };
  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid var(--color-border-tertiary)', borderRadius: 8, fontSize: 14, background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', boxSizing: 'border-box' };
  const btn = (accent = false): React.CSSProperties => ({ flex: accent ? 2 : 1, padding: '11px', borderRadius: 8, border: accent ? 'none' : '0.5px solid var(--color-border-tertiary)', background: accent ? 'var(--color-brand)' : 'transparent', color: accent ? '#fff' : 'var(--color-text-primary)', fontWeight: 600, cursor: 'pointer', fontSize: 14 });

  if (step === 1) return (
    <div style={card}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8 }}>What are you building?</div>
        <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>Give LINUP a brief description and it will ask you the right questions to build a complete spec.</div>
      </div>
      <div>
        <label style={label}>App name</label>
        <input style={input} placeholder='e.g. Internal leave tracker' value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div>
        <label style={label}>Describe your app in a few sentences</label>
        <textarea style={{ ...input, resize: 'vertical', minHeight: 100, fontFamily: 'system-ui' }} placeholder='e.g. A web app for our team to request and approve annual leave...' value={description} onChange={e => setDescription(e.target.value)} />
      </div>
      <button disabled={!name.trim() || !description.trim()} onClick={() => setStep(2)} style={btn(true)}>
        Continue &rarr;
      </button>
    </div>
  );

  return (
    <div style={card}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8 }}>Where should we save your project?</div>
        <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>LINUP saves all generated code and artifacts to a local folder on your machine. This step is optional — you can set it later.</div>
      </div>
      <div>
        <label style={label}>Project folder <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...input, flex: 1 }} placeholder='No folder selected' value={folder} readOnly />
          <button onClick={pickFolder} style={{ padding: '10px 16px', border: '1px solid var(--color-border-tertiary)', borderRadius: 8, background: 'var(--color-bg-secondary)', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>Browse...</button>
        </div>
      </div>
      {error && <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', padding: '10px 14px', borderRadius: 6 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => setStep(1)} style={btn()}>&#8592; Back</button>
        <button onClick={handleCreate} disabled={creating} style={btn(true)}>
          {creating ? 'Creating...' : 'Create project \u2192'}
        </button>
      </div>
    </div>
  );
}