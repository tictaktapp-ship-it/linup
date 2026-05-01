import React, { useState } from 'react';

interface OnboardingStepProps { onNext: (data?: Record<string, unknown>) => void; onBack: () => void }

const Step3: React.FC<OnboardingStepProps> = ({ onNext, onBack }) => {
  const [cap, setCap] = useState('10');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 480, margin: '0 auto', width: '100%' }}>
      <h2 style={{ margin: 0 }}>AI cost transparency</h2>
      <p style={{ color: '#6B6B66', margin: 0, fontSize: 14 }}>Set an alert threshold to monitor how much AI your build uses. This is shown as an equivalent market cost and does not affect your build or add any charge to your subscription.</p>
      <label style={{ fontSize: 13, fontWeight: 500 }}>Alert me when equivalent AI cost reaches (GBP)
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 18 }}>£</span>
          <input type="number" min="1" style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #E4E4E0', fontSize: 20, fontFamily: 'monospace' }}
            value={cap} onChange={e => setCap(e.target.value)} />
        </div>
      </label>
      <p style={{ fontSize: 12, color: '#9B9B96', margin: 0 }}>For reference: a typical app build uses £4–£12 of AI processing. On alternatives like Lovable or Cursor, you would pay this directly. With LINUP, it is included in your subscription.</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={onBack} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #E4E4E0', background: '#fff', cursor: 'pointer' }}>← Back</button>
        <button onClick={() => onNext({ budgetCap: parseFloat(cap) })}
          style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: '#1D4ED8', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
          Continue →
        </button>
      </div>
    </div>
  );
};

export default Step3;