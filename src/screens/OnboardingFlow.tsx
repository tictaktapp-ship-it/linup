import React, { useState } from 'react';
import Step1 from './onboarding/Step1';
import Step2 from './onboarding/Step2';
import Step3 from './onboarding/Step3';
import Step4 from './onboarding/Step4';
import Step5 from './onboarding/Step5';
import Step6 from './onboarding/Step6';

const TOTAL = 6;

const OnboardingFlow: React.FC = () => {
  const [step, setStep] = useState(1);
  const [, setData] = useState<Record<string, unknown>>();

  const onNext = (stepData?: Record<string, unknown>) => {
    if (stepData) setData(d => ({ ...d, ...stepData }));
    if (step < TOTAL) setStep(s => s + 1);
    else window.location.hash = '/';
  };

  const onBack = () => setStep(s => Math.max(1, s - 1));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 32px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          {Array.from({ length: TOTAL }, (_, i) => (
            <React.Fragment key={i}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600, flexShrink: 0,
                background: i + 1 < step ? '#16A34A' : i + 1 === step ? '#1D4ED8' : '#E4E4E0',
                color: i + 1 <= step ? '#fff' : '#9B9B96',
              }}>
                {i + 1 < step ? '✓' : i + 1}
              </div>
              {i < TOTAL - 1 && <div style={{ flex: 1, height: 2, background: i + 1 < step ? '#16A34A' : '#E4E4E0' }} />}
            </React.Fragment>
          ))}
          <span style={{ marginLeft: 8, fontSize: 13, color: '#6B6B66', flexShrink: 0 }}>Step {step} of {TOTAL}</span>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px 32px' }}>
        {step === 1 && <Step1 onNext={onNext} onBack={onBack} />}
        {step === 2 && <Step2 onNext={onNext} onBack={onBack} />}
        {step === 3 && <Step3 onNext={onNext} onBack={onBack} />}
        {step === 4 && <Step4 onNext={onNext} onBack={onBack} />}
        {step === 5 && <Step5 onNext={onNext} onBack={onBack} />}
        {step === 6 && <Step6 onNext={onNext} onBack={onBack} />}
      </div>
    </div>
  );
};

export default OnboardingFlow;
