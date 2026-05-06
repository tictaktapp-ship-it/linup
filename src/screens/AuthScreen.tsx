import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { LOGO_WORDMARK } from '../constants/logos';

export default function AuthScreen() {
  const { callbackPort } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  const isValidEmail = (e: string) => e.includes('@') && e.includes('.');
  const showEmailError = emailTouched && email.length > 0 && !isValidEmail(email);

  if (typeof document !== 'undefined' && !document.getElementById('linup-spin')) {
    const s = document.createElement('style');
    s.id = 'linup-spin';
    s.textContent = '@keyframes linup-spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(s);
  }

  const handleSend = async () => {
    setEmailTouched(true);
    if (!isValidEmail(email)) { setError('Please enter a valid email address.'); return; }
    setLoading(true); setError(null);
    // Use localhost callback URL with the dynamic port
    const redirectTo = callbackPort
      ? 'http://127.0.0.1:' + callbackPort + '/callback'
      : 'http://localhost:9999/callback';
    console.log('[AUTH] using redirect:', redirectTo);
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true,
      },
    });
    if (err) { setError(err.message); setLoading(false); return; }
    setSent(true); setLoading(false);
  };

  const leftPanel = (
    <div style={{ width: 320, minWidth: 320, background: '#0F172A', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '40px 36px', flexShrink: 0 }}>
      <div>
        <img src={LOGO_WORDMARK} alt='LINUP' style={{ height: 28, marginBottom: 48, filter: 'brightness(0) invert(1)', objectFit: 'contain', objectPosition: 'left', display: 'block' }} />
        <div style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', lineHeight: 1.35, marginBottom: 12 }}>
          Build and ship internal tools without the overhead
        </div>
        <div style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.7, marginBottom: 32 }}>
          Turn any idea into a deployed, production-ready web app in 11 guided stages.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {['From idea to deployed app in 11 stages', 'AI handles the architecture and code', 'No coding required', 'First app is always free'].map(v => (
            <div key={v} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#94A3B8' }}>
              <span style={{ color: 'var(--color-brand)', fontSize: 15, flexShrink: 0, marginTop: 1 }}>&#10003;</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ borderTop: '1px solid #1E293B', paddingTop: 20, marginTop: 32 }}>
        <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6, fontStyle: 'italic' }}>
          &ldquo;LINUP saved our team months of development time. We shipped our internal billing tool in a week.&rdquo;
        </div>
        <div style={{ fontSize: 11, color: '#334155', marginTop: 8, fontWeight: 500 }}>Early access team</div>
      </div>
    </div>
  );

  if (sent) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100%', background: 'var(--color-bg-primary)' }}>
        {leftPanel}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <div style={{ maxWidth: 380, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 64, height: 64, background: '#EEF2FF', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>&#9993;</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>Check your inbox</div>
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
              We sent a secure sign-in link to <strong>{email}</strong>. Click it to access LINUP instantly.
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', background: 'var(--color-bg-secondary)', padding: '10px 16px', borderRadius: 8, width: '100%', textAlign: 'left' }}>
              Can&apos;t find it? Check your spam folder. The link expires in 1 hour.
            </div>
            <button onClick={() => { setSent(false); setEmail(''); setEmailTouched(false); }} style={{ background: 'transparent', border: 'none', color: 'var(--color-brand)', cursor: 'pointer', fontSize: 13 }}>
              Use a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', background: 'var(--color-bg-primary)' }}>
      {leftPanel}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, background: '#F8FAFC' }}>
        <div style={{ maxWidth: 380, width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-brand)', fontWeight: 600, marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>The fastest way to build internal tools</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6 }}>Sign in to LINUP</div>
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>Enter your email and we&apos;ll send a secure sign-in link. No password needed.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input type='email' value={email}
              onChange={e => { setEmail(e.target.value); setError(null); }}
              onFocus={() => setFocused(true)}
              onBlur={() => { setFocused(false); setEmailTouched(true); }}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder='you@company.com'
              style={{ width: '100%', padding: '11px 14px', border: (error || showEmailError) ? '1.5px solid #DC2626' : focused ? '1.5px solid #6366F1' : '1px solid #CBD5E1', borderRadius: 8, fontSize: 14, background: '#fff', color: 'var(--color-text-primary)', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
            />
            {(error || showEmailError) && (<div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#DC2626' }}><span>&#9888;</span><span>{error || 'Please enter a valid email address.'}</span></div>)}
            <button onClick={handleSend} disabled={loading}
              style={{ padding: '12px 16px', background: loading ? '#818CF8' : 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.15s' }}
            >
              {loading ? (<><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'linup-spin 0.7s linear infinite' }} /><span>Sending...</span></>) : (<><span>Continue with email</span><span aria-hidden='true' style={{ fontSize: 12, opacity: 0.7 }}>&#9166;</span></>)}
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', lineHeight: 1.7 }}>
            By continuing, you agree to our{' '}<a href='https://linup.io/terms' target='_blank' rel='noopener noreferrer' style={{ color: 'var(--color-brand)', textDecoration: 'none' }}>Terms &amp; Conditions</a>{' '}and{' '}<a href='https://linup.io/privacy' target='_blank' rel='noopener noreferrer' style={{ color: 'var(--color-brand)', textDecoration: 'none' }}>Privacy Policy</a>.
          </div>
          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 16, fontSize: 12, color: 'var(--color-text-tertiary)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--color-text-secondary)' }}>Free to build.</strong>{' '}
            Payment only at first export \u2014 to verify your identity, not to charge you. Your first app export is free.
          </div>
        </div>
      </div>
    </div>
  );
}
