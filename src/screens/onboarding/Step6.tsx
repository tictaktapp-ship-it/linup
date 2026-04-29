import React from 'react';

interface OnboardingStepProps { onNext: () => void; onBack: () => void }

const Step6: React.FC<OnboardingStepProps> = ({ onNext }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 480, margin: '0 auto', width: '100%' }}>
    <h2 style={{ margin: 0 }}>Your first approval gate</h2>
    <p style={{ color: '#6B6B66', margin: 0, fontSize: 14 }}>
      Review the AI-generated product spec. If it looks right, approve it and LINUP will move to architecture.
    </p>
    <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: 16, fontSize: 13 }}>
      <strong>✓ All gates passed</strong>
      <ul style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.8 }}>
        <li>User stories defined</li>
        <li>Acceptance criteria complete</li>
        <li>Technical constraints captured</li>
      </ul>
    </div>
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      <button onClick={onNext} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#16A34A', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
        Approve and continue →
      </button>
    </div>
  </div>
);

export default Step6;