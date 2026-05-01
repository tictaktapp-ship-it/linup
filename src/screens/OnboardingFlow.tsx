import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Step1 from './onboarding/Step1';
import Step2 from './onboarding/Step2';
import Step3 from './onboarding/Step3';
import Step4 from './onboarding/Step4';
import Step5 from './onboarding/Step5';
import Step6 from './onboarding/Step6';

const TOTAL = 6;

const OnboardingFlow: React.FC = () => {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onNext = async (stepData?: Record<string, unknown>) => {
    const merged = { ...data, ...stepData };
    if (stepData) setData(merged);

    if (step < TOTAL) {
      setStep(s => s + 1);
      return;
    }

    // Final step — save project to DB then navigate to stage workspace
    setSaving(true);
    setError(null);
    try {
      const projectId = await invoke<string>('create_project', {
        name: (merged.name as string) || 'My App',
        description: (merged.description as string) || '',
        folderPath: (merged.folder as string) || 'C:\\Projects\\my-app',
        stack: (merged.stack as string) || 'web',
        budgetCap: (merged.budgetCap as number) || 10.0,
      });
      window.location.hash = '/project/' + projectId + '/stage/0';
    } catch (e) {
      setError('Failed to create project: ' + String(e));
      setSaving(false);
    }
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
                {i + 1 < step ? String.fromCharCode(10003) : i + 1}
              </div>
              {i < TOTAL - 1 && <div style={{ flex: 1, height: 2, background: i + 1 < step ? '#16A34A' : '#E4E4E0' }} />}
            </React.Fragment>
          ))}
          <span style={{ marginLeft: 8, fontSize: 13, color: '#6B6B66', flexShrink: 0 }}>Step {step} of {TOTAL}</span>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px 32px' }}>
        {error && <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</div>}
        {saving && <div style={{ color: '#6B6B66', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>Creating your project...</div>}
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
