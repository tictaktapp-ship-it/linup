import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface Props {
  onNext: (stepData?: Record<string, unknown>) => void;
  onBack: () => void;
}

export default function Step6({ onNext, onBack }: Props) {
  const [loading] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: '48px 32px', maxWidth: 560, margin: '0 auto' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8 }}>
          Your first approval gate
        </div>
        <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
          Review the AI-generated product spec. If it looks right, approve it and LINUP will move to architecture.
        </div>
      </div>
      <div style={{
        width: '100%', background: '#F0FDF4', border: '1px solid #BBF7D0',
        borderRadius: 8, padding: 20, fontSize: 13,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 10, color: '#16A34A' }}>&check; All gates passed</div>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9, color: 'var(--color-text-secondary)' }}>
          <li>User stories defined</li>
          <li>Acceptance criteria complete</li>
          <li>Technical constraints captured</li>
        </ul>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
          The full product specification will be available to review inside the Stage Workspace after completing setup.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, width: '100%' }}>
        <button onClick={onBack} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '0.5px solid var(--color-border-tertiary)', background: 'transparent', cursor: 'pointer', fontSize: 14 }}>
          &larr; Back
        </button>
        <button
          onClick={() => onNext()}
          disabled={loading}
          style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: '#16A34A', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
        >
          Approve and continue &rarr;
        </button>
      </div>
    </div>
  );
}
