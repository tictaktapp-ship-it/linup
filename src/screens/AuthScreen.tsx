import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { LOGO_WORDMARK } from '../constants/logos';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const handleSend = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true); setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'linup://auth/callback' },
    });
    if (err) { setError(err.message); setLoading(false); return; }
    setSent(true); setLoading(false);
  };

  if (sent) {
    return (
      <div style={{ display: 'flex', height: '100vh', background: 'var(--color-bg-primary)' }}>
        <div style={{ width: 320, background: '#0F172A', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 40px' }}>
          <img src={LOGO_WORDMARK} alt='LINUP' style={{ height: 20, marginBottom: 48, filter: 'brightness(0) invert(1)', objectFit: 'contain', objectPosition: 'left' }} />
          <div style={{ color: '#fff' }}>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, lineHeight: 1.3 }}>Build and ship internal tools without the overhead</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 32 }}>
              {['11 guided stages from idea to deployed app', 'No coding required', 'AI handles the heavy lifting', 'Free to build your first app'].map(v => (
                <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#94A3B8' }}>
                  <span style={{ color: '#6366F1', fontSize: 16 }}>&#10003;</span> {v}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <div style={{ maxWidth: 380, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 64, height: 64, background: '#EEF2FF', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>&#9993;</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>Check your inbox</div>
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
              We sent a secure sign-in link to <strong>{email}</strong>.
              Click it to access LINUP instantly. No password needed.
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', background: 'var(--color-bg-secondary)', padding: '10px 16px', borderRadius: 8, width: '100%' }}>
              Can't find it? Check your spam folder. The link expires in 1 hour.
            </div>
            <button onClick={() => { setSent(false); setEmail(''); }} style={{ background: 'transparent', border: 'none', color: 'var(--color-accent-primary)', cursor: 'pointer', fontSize: 13 }}>
              Use a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--color-bg-primary)' }}>

      {/* Left panel — brand & value props */}
      <div style={{ width: 320, background: '#0F172A', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 40px', flexShrink: 0 }}>
        <img src={LOGO_WORDMARK} alt='LINUP' style={{ height: 20, marginBottom: 48, filter: 'brightness(0) invert(1)', objectFit: 'contain', objectPosition: 'left' }} />
        <div style={{ color: '#fff' }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, lineHeight: 1.3 }}>Build and ship internal tools without the overhead</div>
          <div style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.7, marginBottom: 32 }}>
            Turn any idea into a deployed, production-ready app in 11 guided stages. No coding required.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              'From idea to deployed app in 11 stages',
              'AI handles architecture and code',
              'No coding required',
              'Free to build your first app',
            ].map(v => (
              <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#94A3B8' }}>
                <span style={{ color: '#6366F1', fontSize: 15, flexShrink: 0 }}>&#10003;</span> {v}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — sign in form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ maxWidth: 380, width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>

          <div>
            <div style={{ fontSize: 13, color: '#6366F1', fontWeight: 500, marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              The fastest way to build internal tools
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8 }}>
              Sign in to LINUP
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Enter your email and we will send a secure sign-in link. No password needed.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <input
                type='email'
                value={email}
                onChange={e => { setEmail(e.target.value); setError(null); }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder='you@company.com'
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  border: error ? '1.5px solid #DC2626' : focused ? '1.5px solid #6366F1' : '1px solid var(--color-border-tertiary)',
                  borderRadius: 8,
                  fontSize: 14,
                  background: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
              />
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#DC2626' }}>
                <span>&#9888;</span> {error}
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={loading}
              style={{
                padding: '12px 16px',
                background: loading ? '#818CF8' : '#6366F1',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'background 0.15s',
              }}
            >
              {loading ? (
                <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Sending...</>
              ) : (
                <><span>Continue with email</span><span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>&#9166;</span></>
              )}
            </button>
          </div>

          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', lineHeight: 1.7 }}>
            By continuing, you agree to our{' '}
            <a href='https://linup.io/terms' target='_blank' rel='noopener noreferrer' style={{ color: 'var(--color-accent-primary)', textDecoration: 'none' }}>Terms & Conditions</a>
            {' '}and{' '}
            <a href='https://linup.io/privacy' target='_blank' rel='noopener noreferrer' style={{ color: 'var(--color-accent-primary)', textDecoration: 'none' }}>Privacy Policy</a>.
          </div>

          <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)', paddingTop: 16, fontSize: 12, color: 'var(--color-text-tertiary)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--color-text-secondary)' }}>Free to build.</strong>{' '}
            Payment only at first export \u2014 to verify your identity, not to charge you.
            Your first app is free. You only pay when starting a second project or upgrading.
          </div>

        </div>
      </div>
    </div>
  );
}

// Add spin animation to global styles
const style = document.createElement('style');
style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(style);
