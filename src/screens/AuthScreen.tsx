import { useAuth } from '../context/useAuth';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { LOGO_WORDMARK } from '../constants/logos';

export default function AuthScreen() {
  useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  const isValidEmail = (e: string) => e.includes('@') && e.includes('.');
  const showEmailError = emailTouched && email.length > 0 && !isValidEmail(email);

  const handleSend = async () => {
    setEmailTouched(true);
    if (!isValidEmail(email)) { setError('Please enter a valid email address.'); return; }
    setLoading(true); setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'linup://auth/callback' },
    });
    if (err) { setError(err.message); setLoading(false); return; }
    setSent(true); setLoading(false);
  };

  // Spinner style injected once
  if (typeof document !== 'undefined' && !document.getElementById('linup-spin')) {
    const s = document.createElement('style');
    s.id = 'linup-spin';
    s.textContent = '@keyframes linup-spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(s);
  }

  const leftPanel = (
    <div style={{ flexBasis: '60%', width: '60%', minWidth: 420, background: 'var(--color-bg-primary)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '40px 36px', flexShrink: 0 }}>
      <div>
        <img src={LOGO_WORDMARK} alt='LINUP' style={{ height: 28, marginBottom: 48, objectFit: 'contain', objectPosition: 'left', display: 'block' }} />
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.35, marginBottom: 12 }}>
          Build and ship internal tools without the overhead
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 32 }}>
          Turn any idea into a deployed, production-ready web app in 11 guided stages.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            'From idea to deployed app in 11 stages',
            'AI handles the architecture and code',
            'No coding required',
            'First app is always free',
          ].map(v => (
            <div key={v} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--color-text-secondary)' }}>
              <span style={{ color: 'var(--color-accent-primary)', fontSize: 15, flexShrink: 0, marginTop: 1 }}>&#10003;</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--color-border-primary)', paddingTop: 20, marginTop: 32 }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', lineHeight: 1.6, fontStyle: 'italic' }}>
          &ldquo;LINUP saved our team months of development time. We shipped our internal billing tool in a week.&rdquo;
        </div>
        <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 8, fontWeight: 500 }}>
          Early access team
        </div>
      </div>
    </div>
  );

  if (sent) {
    return (
      <div style={{ display: 'flex', height: '100vh', maxWidth: 1400, margin: '0 auto', background: 'var(--color-bg-primary)' }}>
        {leftPanel}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <div style={{ maxWidth: 380, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 64, height: 64, background: 'var(--color-bg-secondary)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>&#9993;</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>Check your inbox</div>
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
              We sent a secure sign-in link to <strong>{email}</strong>.
              Click it to access LINUP instantly. No password needed.
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', background: 'var(--color-bg-secondary)', padding: '10px 16px', borderRadius: 8, width: '100%', textAlign: 'left' }}>
              Can&apos;t find it? Check your spam folder. The link expires in 1 hour.
            </div>
            <button onClick={() => { setSent(false); setEmail(''); setEmailTouched(false); }} style={{ background: 'transparent', border: 'none', color: 'var(--color-accent-primary)', cursor: 'pointer', fontSize: 13 }}>
              Use a different email
            </button>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', maxWidth: 1400, margin: '0 auto', background: 'var(--color-bg-primary)' }}>
      {leftPanel}
      <div style={{ flexBasis: '40%', width: '40%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, background: 'var(--color-bg-secondary)' }}>
        <div style={{ maxWidth: 380, width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>

          <div>
            <div style={{ fontSize: 10, color: 'var(--color-accent-primary)', fontWeight: 600, marginBottom: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              The fastest way to build internal tools
            </div>
            <div style={{ fontSize: 30, fontWeight: 750, color: 'var(--color-text-primary)', marginBottom: 6 }}>
              Sign in to LINUP
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Enter your email and we&apos;ll send a secure sign-in link. No password needed.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type='email'
              value={email}
              onChange={e => { setEmail(e.target.value); setError(null); }}
              onFocus={() => setFocused(true)}
              onBlur={() => { setFocused(false); setEmailTouched(true); }}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder='you@company.com'
              aria-label='Email address'
              style={{
                width: '100%', padding: '11px 14px',
                border: (error || showEmailError) ? '1.5px solid #DC2626' : focused ? '2px solid var(--color-border-focus)' : '1px solid #CBD5E1',
                borderRadius: 8, fontSize: 14,
                background: '#fff', color: 'var(--color-text-primary)',
                outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
              }}
            />
            {(error || showEmailError) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#DC2626' }}>
                <span>&#9888;</span>
                <span>{error || 'Please enter a valid email address.'}</span>
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={loading}
              aria-label='Continue with email'
              style={{
                padding: '12px 16px', background: loading ? 'var(--color-accent-hover)' : 'var(--color-accent-primary)', color: '#fff', opacity: loading ? 0.9 : 1,
                border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background 0.15s',
              }}
            >
              {loading ? (
                <>
                  <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'linup-spin 0.7s linear infinite' }} aria-hidden='true' />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <span>Continue with email</span>
                  <span aria-hidden='true' style={{ fontSize: 12, opacity: 0.7 }}>&#9166;</span>
                </>
              )}
            </button>
          </div>

          <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', lineHeight: 1.7 }}>
            By continuing, you agree to our{' '}
            <a href='https://linup.io/terms' target='_blank' rel='noopener noreferrer' style={{ color: 'var(--color-accent-primary)', textDecoration: 'none' }}>Terms &amp; Conditions</a>
            {' '}and{' '}
            <a href='https://linup.io/privacy' target='_blank' rel='noopener noreferrer' style={{ color: 'var(--color-accent-primary)', textDecoration: 'none' }}>Privacy Policy</a>.
          </div>

          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 14, fontSize: 10, color: 'var(--color-text-tertiary)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--color-text-secondary)' }}>Free to build.</strong>
            {' '}Payment only at first export \u2014 to verify your identity, not to charge you.
            Your first app export is free. You only pay when starting a second project or upgrading your plan.
          </div>

        </div>

      </div>
    </div>
  );
}







