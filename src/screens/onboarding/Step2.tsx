import { open } from '@tauri-apps/plugin-dialog';
import React, { useState } from 'react';

interface OnboardingStepProps {
  onNext: (data?: Record<string, unknown>) => void;
  onBack: () => void;
}

type Stack = 'nextjs-supabase' | 'expo-supabase';

const stacks = [
  {
    id: 'nextjs-supabase' as Stack,
    label: 'Web app',
    sublabel: 'Next.js + Supabase',
    description: 'Responsive web app that works on all devices. Can be installed as an app on mobile. Deploys to Vercel.',
    badge: 'Available now',
    badgeColor: '#16A34A',
    badgeBg: '#DCFCE7',
    available: true,
  },
  {
    id: 'expo-supabase' as Stack,
    label: 'Mobile app',
    sublabel: 'Expo + Supabase',
    description: 'Native iOS and Android app. Preview on your real device via Expo Go. Deploys to App Store and Google Play.',
    badge: 'Coming in v1.5',
    badgeColor: '#92400E',
    badgeBg: '#FEF3C7',
    available: false,
  },
];

const Step2: React.FC<OnboardingStepProps> = ({ onNext, onBack }) => {
  const [selectedStack, setSelectedStack] = useState<Stack>('nextjs-supabase');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [folder, setFolder] = useState('');
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const [showWaitlist, setShowWaitlist] = useState(false);

  const inp = (style?: React.CSSProperties): React.CSSProperties => ({
    width: '100%', padding: '8px 12px', borderRadius: 6,
    border: '1px solid #E4E4E0', fontSize: 14,
    boxSizing: 'border-box', fontFamily: 'inherit', ...style,
  });

  const handleStackClick = (stack: typeof stacks[0]) => {
    if (!stack.available) {
      setShowWaitlist(true);
      return;
    }
    setSelectedStack(stack.id);
    setShowWaitlist(false);
  };

  const handleWaitlist = () => {
    if (waitlistEmail) {
      setWaitlistSubmitted(true);
    }
  };

  const canProceed = name.trim() && folder.trim() && selectedStack === 'nextjs-supabase';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 500, margin: '0 auto', width: '100%' }}>
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600 }}>Create your app</h2>
        <p style={{ margin: 0, color: '#6B6B66', fontSize: 14 }}>Tell us what you want to build and where.</p>
      </div>

      {/* Stack selector */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 8 }}>App type</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {stacks.map(stack => (
            <div
              key={stack.id}
              onClick={() => handleStackClick(stack)}
              style={{
                border: `2px solid ${selectedStack === stack.id ? '#1D4ED8' : '#E4E4E0'}`,
                borderRadius: 10, padding: 14, cursor: stack.available ? 'pointer' : 'default',
                background: selectedStack === stack.id ? '#EFF6FF' : '#fff',
                opacity: stack.available ? 1 : 0.85,
                transition: 'border-color 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{stack.label}</div>
                  <div style={{ fontSize: 11, color: '#6B6B66', marginTop: 1 }}>{stack.sublabel}</div>
                </div>
                <span style={{
                  background: stack.badgeBg, color: stack.badgeColor,
                  fontSize: 10, fontWeight: 500, padding: '2px 6px',
                  borderRadius: 4, whiteSpace: 'nowrap', marginLeft: 6,
                }}>
                  {stack.badge}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#6B6B66', lineHeight: 1.5 }}>{stack.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Waitlist capture */}
      {showWaitlist && (
        <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: 14 }}>
          {waitlistSubmitted ? (
            <p style={{ margin: 0, fontSize: 13, color: '#92400E', fontWeight: 500 }}>
              ✓ You're on the list. We'll email you when Expo support launches.
            </p>
          ) : (
            <>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: '#92400E', fontWeight: 500 }}>
                Expo support is coming in v1.5. Want to be first to know?
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ ...inp({ margin: 0, flex: 1 }), fontSize: 13 }}
                  type="email"
                  placeholder="your@email.com"
                  value={waitlistEmail}
                  onChange={e => setWaitlistEmail(e.target.value)}
                />
                <button
                  onClick={handleWaitlist}
                  style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#D97706', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Notify me
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* App details */}
      <label style={{ fontSize: 13, fontWeight: 500, display: 'flex', flexDirection: 'column', gap: 4 }}>
        App name <span style={{ color: '#DC2626', fontSize: 11 }}>required</span>
        <input style={inp()} placeholder="e.g. Invoice tracker" value={name} onChange={e => setName(e.target.value)} />
      </label>

      <label style={{ fontSize: 13, fontWeight: 500, display: 'flex', flexDirection: 'column', gap: 4 }}>
        What does it do?
        <textarea
          style={{ ...inp(), height: 72, resize: 'vertical' }}
          placeholder="Describe the problem it solves..."
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </label>

      <label style={{ fontSize: 13, fontWeight: 500, display: 'flex', flexDirection: 'column', gap: 4 }}>
        Project folder <span style={{ color: '#DC2626', fontSize: 11 }}>required</span>
        <div style={{ display: "flex", gap: 8 }}><input style={inp()} placeholder="C:\Projects\my-app" value={folder} onChange={e =><button type="button" onClick={async () => { const selected = await open({ directory: true, multiple: false }); if (selected) setFolderPath(selected as string); }} style={{ padding: "6px 14px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 6, background: "transparent", cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" }}>Browse...</button></div> setFolder(e.target.value)} />
        <span style={{ fontSize: 11, color: '#6B6B66' }}>LINUP will create your app files here.</span>
      </label>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={onBack} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #E4E4E0', background: '#fff', cursor: 'pointer', fontSize: 14 }}>
          ← Back
        </button>
        <button
          onClick={() => onNext({ name, description, stack: selectedStack, folder })}
          disabled={!canProceed}
          style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: canProceed ? '#1D4ED8' : '#E4E4E0', color: canProceed ? '#fff' : '#9B9B96', fontWeight: 600, cursor: canProceed ? 'pointer' : 'not-allowed', fontSize: 14 }}>
          Continue →
        </button>
      </div>
    </div>
  );
};

export default Step2;