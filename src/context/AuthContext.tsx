import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { supabase } from '../lib/supabase';
import type { LinupUser } from '../lib/supabase';
import { AuthContext } from './authContextInstance';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LinupUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const log = (msg: string) => {
    console.log('[AUTH]', msg);
    setDebugLog(prev => [...prev.slice(-20), msg]);
  };

  const fetchUser = async (id: string, email: string) => {
    log('fetchUser: ' + id + ' ' + email);
    try {
      const { data } = await supabase
        .from('users')
        .select('id, email, plan')
        .eq('id', id)
        .single();
      if (data) {
        setUser(data as LinupUser);
      } else {
        await supabase.from('users').insert({ id, email, plan: 'free' });
        setUser({ id, email, plan: 'free' });
      }
    } catch (e) {
      log('fetchUser error: ' + String(e));
      setUser({ id, email, plan: 'free' });
    }
    setLoading(false);
  };

  const handleAuthUrl = async (url: string) => {
    log('URL received: ' + url);
const finalizeAuth = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  log('finalizeAuth session: ' + (session ? 'user=' + session.user.email : 'null'));
  if (session?.user) {
    await fetchUser(session.user.id, session.user.email ?? '');
  } else {
    setLoading(false);
  }
};
    try {
      const urlObj = new URL(url);
      const qp = urlObj.searchParams;
      const hash = urlObj.hash.startsWith('#') ? urlObj.hash.slice(1) : '';
      const hp = new URLSearchParams(hash);

      log('query keys: ' + [...qp.keys()].join(', '));
      log('hash keys: ' + [...hp.keys()].join(', '));

      // Supabase v2 server-side verify redirects with access_token in query params
      const accessToken = qp.get('access_token') || hp.get('access_token');
      const refreshToken = qp.get('refresh_token') || hp.get('refresh_token');
      if (accessToken && refreshToken) {
        log('setSession with access_token...');
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) log('setSession error: ' + error.message);
        else log('setSession success');
        await finalizeAuth();
        return;
      }

      // PKCE code
      const code = qp.get('code') || hp.get('code');
      if (code) {
        log('exchangeCodeForSession: ' + code.substring(0, 10) + '...');
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) log('exchangeCode error: ' + error.message);
        else log('exchangeCode success');
        await finalizeAuth();
        return;
      }

      // token_hash
      const tokenHash = qp.get('token_hash') || hp.get('token_hash');
      const type = (qp.get('type') || hp.get('type') || 'magiclink') as 'signup' | 'magiclink' | 'recovery' | 'invite';
      if (tokenHash) {
        log('verifyOtp token_hash type=' + type);
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) log('verifyOtp error: ' + error.message);
        else log('verifyOtp success');
        await finalizeAuth();
        return;
      }

      // legacy token
      const token = qp.get('token') || hp.get('token');
      const email = qp.get('email') || hp.get('email') || '';
      if (token) {
        log('verifyOtp legacy token type=' + type);
        const { error } = await supabase.auth.verifyOtp({ token, type: type as 'signup' | 'magiclink', email });
        if (error) log('verifyOtp legacy error: ' + error.message);
        else log('verifyOtp legacy success');
        await finalizeAuth();
        return;
      }

      log('NO token found in URL - checking session anyway');
      const { data: { session } } = await supabase.auth.getSession();
      log('session after fallback: ' + (session ? 'EXISTS user=' + session.user.email : 'null'));
      if (session?.user) {
        await fetchUser(session.user.id, session.user.email ?? '');
      }
    } catch (e) {
      log('handleAuthUrl exception: ' + String(e));
    }
  };

  useEffect(() => {
  console.log('[AUTH] AuthProvider mounted');
    supabase.auth.getSession().then(({ data: { session } }) => {
      log('initial session: ' + (session ? 'user=' + session.user.email : 'null'));
      if (session?.user) {
        fetchUser(session.user.id, session.user.email ?? '');
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      log('authStateChange event=' + event + ' session=' + (session ? session.user.email : 'null'));
      if (session?.user) {
        fetchUser(session.user.id, session.user.email ?? '');
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      }
    });

    onOpenUrl((urls: string[]) => {
      log('onOpenUrl called with ' + urls.length + ' URLs');
      const url = urls[0];
      if (url) handleAuthUrl(url);
    }).catch(e => log('onOpenUrl registration failed: ' + String(e)));

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, debugLog, signOut }}>{children}</AuthContext.Provider>;
}









