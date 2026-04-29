import React, { useState } from 'react';

interface OnboardingStepProps { onNext: (data?: Record<string, unknown>) => void; onBack: () => void }

const Step2: React.FC<OnboardingStepProps> = ({ onNext, onBack }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [stack, setStack] = useState('Next.js + Supabase');
  const [folder, setFolder] = useState('');

  const inp = (style?: React.CSSProperties): React.CSSProperties => ({
    width: '100%', padding: '8px 12px', borderRadius: 6,
    border: '1px solid #E4E4E0', fontSize: 14, boxSizing: 'border-box', ...style,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 480, margin: '0 auto', width: '100%' }}>
      <h2 style={{ margin: 0 }}>Create your app</h2>
      <label style={{ fontSize: 13, fontWeight: 500 }}>App name
        <input style={inp({ marginTop: 4 })} value={name} onChange={e => setName(e.target.value)} placeholder="My SaaS App" />
      </label>
      <label style={{ fontSize: 13, fontWeight: 500 }}>What does it do?
        <textarea style={{ ...inp({ marginTop: 4 }), height: 80, resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the problem it solves..." />
      </label>
      <label style={{ fontSize: 13, fontWeight: 500 }}>Stack
        <select style={inp({ marginTop: 4 })} value={stack} onChange={e => setStack(e.target.value)}>
          <option>Next.js + Supabase</option>
          <option>Remix + PlanetScale</option>
          <option>SvelteKit + Supabase</option>
        </select>
      </label>
      <label style={{ fontSize: 13, fontWeight: 500 }}>Project folder
        <input style={inp({ marginTop: 4 })} value={folder} onChange={e => setFolder(e.target.value)} placeholder="C:\Projects\my-app" />
      </label>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={onBack} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #E4E4E0', background: '#fff', cursor: 'pointer' }}>← Back</button>
        <button onClick={() => onNext({ name, description, stack, folder })} disabled={!name || !folder}
          style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: !name || !folder ? '#E4E4E0' : '#1D4ED8', color: !name || !folder ? '#9B9B96' : '#fff', fontWeight: 600, cursor: !name || !folder ? 'not-allowed' : 'pointer' }}>
          Continue →
        </button>
      </div>
    </div>
  );
};

export default Step2;