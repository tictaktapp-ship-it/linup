import React from 'react';

interface OnboardingStepProps { onNext: () => void; onBack: () => void }

const Step5: React.FC<OnboardingStepProps> = ({ onNext, onBack }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 480, margin: '0 auto', width: '100%' }}>
    <h2 style={{ margin: 0 }}>Ready to run Stage 1</h2>
    <p style={{ color: '#6B6B66', margin: 0, fontSize: 14 }}>
      LINUP will use your idea to generate a full product specification. This takes 2–4 minutes and costs roughly £0.50.
    </p>
    <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 8, padding: 16, fontSize: 13 }}>
      <strong>What happens next:</strong>
      <ul style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.8 }}>
        <li>AI generates product spec from your idea</li>
        <li>Gates check for completeness</li>
        <li>You review and approve before anything is built</li>
      </ul>
    </div>
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      <button onClick={onBack} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #E4E4E0', background: '#fff', cursor: 'pointer' }}>← Back</button>
      <button onClick={onNext} style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: '#1D4ED8', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
        Run Stage 1 →
      </button>
    </div>
  </div>
);

export default Step5;