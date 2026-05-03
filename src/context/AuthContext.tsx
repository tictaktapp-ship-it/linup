import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { supabase } from '../lib/supabase';
import type { LinupUser } from '../lib/supabase';

interface AuthContextType {
  user: LinupUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LinupUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async (id: string, email: string) => {
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
    } catch {
      setUser({ id, email, plan: 'free' });
    }
    setLoading(false);
  };

  const handleAuthUrl = async (url: string) => {
    console.log('Auth URL received:', url);
    try {
      // Parse all possible parameter locations
      const urlObj = new URL(url);
      const params = urlObj.searchParams;
      // Also check hash fragment
      const hash = urlObj.hash.startsWith('#') ? urlObj.hash.substring(1) : urlObj.hash;
      const hashParams = new URLSearchParams(hash);

      // Priority 1: PKCE code (most common in Supabase v2)
      const code = params.get('code') || hashParams.get('code');
      if (code) {
        console.log('Exchanging PKCE code...');
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) console.error('Code exchange error:', error.message);
        return;
      }

      // Priority 2: token_hash (Supabase v2 OTP/magic link)
      const tokenHash = params.get('token_hash') || hashParams.get('token_hash');
      const type = (params.get('type') || hashParams.get('type') || 'magiclink') as 'signup' | 'magiclink' | 'recovery' | 'invite';
      if (tokenHash) {
        console.log('Verifying token hash, type:', type);
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        });
        if (error) console.error('Token hash verify error:', error.message);
        return;
      }

      // Priority 3: Legacy token + email
      const token = params.get('token') || hashParams.get('token');
      const email = params.get('email') || hashParams.get('email') || '';
      if (token) {
        console.log('Verifying OTP token...');
        const { error } = await supabase.auth.verifyOtp({
          token,
          type: type as 'signup' | 'magiclink',
          email,
        });
        if (error) console.error('OTP verify error:', error.message);
        return;
      }

      // Priority 4: Implicit flow — access_token in hash
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      if (accessToken && refreshToken) {
        console.log('Setting implicit flow session...');
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) console.error('Set session error:', error.message);
        return;
      }

      // Fallback: refresh session in case Supabase already handled it
      console.log('Fallback: refreshing session...');
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchUser(session.user.id, session.user.email ?? '');
      }
    } catch (e) {
      console.error('handleAuthUrl error:', e);
    }
  };

  useEffect(() => {
    // Check existing session on startup
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUser(session.user.id, session.user.email ?? '');
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUser(session.user.id, session.user.email ?? '');
      } else if (_event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      }
    });

    // Register deep link handler
    onOpenUrl((urls: string[]) => {
      const url = urls[0];
      if (url) handleAuthUrl(url);
    }).catch(e => console.error('onOpenUrl error:', e));

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
