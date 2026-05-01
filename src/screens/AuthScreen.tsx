import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { LOGO_WORDMARK } from '../constants/logos';

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

  if (sent) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--color-bg-primary)', padding: 32 }}>
        <div style={{ maxWidth: 400, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <img src={LOGO_WORDMARK} alt='LINUP' style={{ height: 24, marginBottom: 8 }} />
          <div style={{ fontSize: 40 }}>&#9993;</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)' }}>Check your email</div>
          <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
            We sent a sign-in link to <strong>{email}</strong>.
            Click it and you will be taken straight back into LINUP &mdash; no further steps needed.
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            Link expires in 1 hour. Check your spam folder if you do not see it.
          </div>
          <button onClick={() => setSent(false)} style={{ background: 'transparent', border: 'none', color: 'var(--color-accent-primary)', cursor: 'pointer', fontSize: 13 }}>
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--color-bg-primary)', padding: 32 }}>
      <div style={{ maxWidth: 400, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>

        <img src={LOGO_WORDMARK} alt='LINUP' style={{ height: 24 }} />

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8 }}>
            Sign in to LINUP
          </div>
          <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
            Enter your email and we will send you a sign-in link.
          </div>
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type='email'
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder='you@example.com'
            style={{ width: '100%', padding: '10px 14px', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, fontSize: 14, background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', boxSizing: 'border-box' }}
          />

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--color-text-secondary)', cursor: 'pointer', lineHeight: 1.5 }}>
            <input type='checkbox' checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>
              I agree to the{' '}
              <a href='https://linup.io/terms' target='_blank' rel='noopener noreferrer' style={{ color: 'var(--color-accent-primary)' }}>Terms & Conditions</a>
              {' '}and{' '}
              <a href='https://linup.io/privacy' target='_blank' rel='noopener noreferrer' style={{ color: 'var(--color-accent-primary)' }}>Privacy Policy</a>
            </span>
          </label>

          {error && <div style={{ fontSize: 13, color: 'var(--color-text-danger)' }}>{error}</div>}

          <button onClick={handleSend} disabled={loading} style={{ padding: '11px', background: 'var(--color-accent-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Sending...' : 'Send sign-in link'}
          </button>
        </div>

        <div style={{ width: '100%', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#16A34A' }}>&#10003; Completely free to build</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
            Sign up and build your first app at no cost. No credit card required to get started.
            Your first app export is also free. A payment method is only requested at the point of
            export &mdash; purely to verify your identity and prevent abuse, not to charge you.
            You only pay if you choose to start a second project or upgrade your plan.
          </div>
        </div>

      </div>
    </div>
  );
}
