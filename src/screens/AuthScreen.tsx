import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { LOGO_FULL } from '../constants/logos';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  const handleSend = async () => {
    if (!agreed) { setError('Please accept the Terms & Conditions to continue.'); return; }
    if (!email || !email.includes('@')) { setError('Please enter a valid email address.'); return; }
    setLoading(true); setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'linup://auth/callback' },
    });
    if (err) { setError(err.message); setLoading(false); return; }
    setSent(true); setLoading(false);
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh',
      background: 'var(--color-bg-primary)', padding: 32,
    }}>
      <div style={{ maxWidth: 400, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
        <img src={LOGO_FULL} alt='LINUP' style={{ height: 32 }} />

        {!sent ? (
          <>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8 }}>
                Sign in to LINUP
              </div>
              <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                LINUP is free to use. No credit card required.
                Enter your email and we will send you a magic link.
              </div>
            </div>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type='email'
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder='you@example.com'
                style={{
                  width: '100%', padding: '10px 14px',
                  border: '0.5px solid var(--color-border-tertiary)',
                  borderRadius: 8, fontSize: 14,
                  background: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                }}
              />

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                <input type='checkbox' checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>
                  I agree to the{' '}
                  <a href='https://linup.io/terms' target='_blank' rel='noopener noreferrer' style={{ color: 'var(--color-accent-primary)' }}>Terms & Conditions</a>
                  {' '}and{' '}
                  <a href='https://linup.io/privacy' target='_blank' rel='noopener noreferrer' style={{ color: 'var(--color-accent-primary)' }}>Privacy Policy</a>
                </span>
              </label>

              {error && <div style={{ fontSize: 13, color: 'var(--color-text-danger)' }}>{error}</div>}

              <button
                onClick={handleSend}
                disabled={loading}
                style={{
                  padding: '11px', background: 'var(--color-accent-primary)', color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Sending...' : 'Send magic link'}
              </button>
            </div>

            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', textAlign: 'center', lineHeight: 1.6 }}>
              LINUP is free to build with. You only pay if you choose to upgrade.
              No charge until you are ready to export your app.
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 40 }}>&#9993;</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Check your email
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
              We sent a magic link to <strong>{email}</strong>.
              Click the link in the email to sign in.
            </div>
            <button
              onClick={() => setSent(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--color-accent-primary)', cursor: 'pointer', fontSize: 13 }}
            >
              Use a different email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
