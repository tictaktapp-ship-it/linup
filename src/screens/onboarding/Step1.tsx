import React, { useState } from 'react';

interface OnboardingStepProps { onNext: () => void; onBack: () => void }

const Step1: React.FC<OnboardingStepProps> = ({ onNext }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
    <div style={{ fontSize: 48 }}>🚀</div>
    <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Welcome to LINUP</h1>
    <p style={{ color: '#6B6B66', textAlign: 'center', maxWidth: 420, margin: 0 }}>
      Turn your idea into a production-ready app in 11 guided stages. No coding required.
    </p>
    <button onClick={onNext} style={{ marginTop: 8, padding: '12px 32px', borderRadius: 8, border: 'none', background: '#1D4ED8', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
      Get started →
    </button>
  </div>
);

export default Step1;