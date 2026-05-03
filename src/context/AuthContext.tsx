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

  useEffect(() => {
    // Check existing session on startup
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUser(session.user.id, session.user.email ?? '');
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes (handles session refresh etc)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUser(session.user.id, session.user.email ?? '');
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Handle deep link callback from magic link email
    // URL format: linup://auth/callback?token=XXX&type=signup
    // or: linup://auth/callback#access_token=XXX&refresh_token=XXX
    onOpenUrl(async (urls: string[]) => {
      const url = urls[0];
      if (!url) return;
      console.log('Deep link received:', url);

      try {
        // Parse the URL to extract auth params
        const urlObj = new URL(url);
        const params = urlObj.searchParams;
        const hash = urlObj.hash.substring(1);
        const hashParams = new URLSearchParams(hash);

        // Case 1: OTP token in query params (magic link style)
        const token = params.get('token');
        const type = params.get('type') as 'signup' | 'magiclink' | 'recovery' | null;

        // Case 2: PKCE code exchange
        const code = params.get('code');

        // Case 3: Access token in hash fragment (implicit flow)
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (token && type) {
          // OTP verification
          const email = params.get('email') ?? '';
          const { error } = await supabase.auth.verifyOtp({
            token,
            type,
            email,
          });
          if (error) console.error('OTP verify error:', error.message);
        } else if (code) {
          // PKCE code exchange
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) console.error('Code exchange error:', error.message);
        } else if (accessToken && refreshToken) {
          // Implicit flow — set session directly
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) console.error('Set session error:', error.message);
        } else {
          // Fallback — just refresh the session, Supabase may have handled it
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            fetchUser(session.user.id, session.user.email ?? '');
          }
        }
      } catch (e) {
        console.error('Deep link handling error:', e);
      }
    }).catch(e => console.error('onOpenUrl registration error:', e));

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
