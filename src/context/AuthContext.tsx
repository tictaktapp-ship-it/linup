import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { supabase } from '../lib/supabase';
import type { LinupUser } from '../lib/supabase';

interface AuthContextType {
  user: LinupUser | null;
  loading: boolean;
  callbackPort: number | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  callbackPort: null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LinupUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [callbackPort, setCallbackPort] = useState<number | null>(null);

  const fetchUser = async (id: string, email: string) => {
    // Always set a fallback immediately so we never hang on Loading...
    const fallback: LinupUser = { id, email, plan: 'free' };

    try {
      // Race against a 5 second timeout
      const result = await Promise.race([
        supabase.from('users').select('id, email, plan').eq('id', id).single(),
        new Promise<{ data: null; error: Error }>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 5000)
        ),
      ]);

      const { data, error } = result as { data: LinupUser | null; error: unknown };

      if (data) {
        setUser(data);
      } else {
        // Try to insert — if it fails (e.g. already exists) that is fine
        await supabase.from('users').upsert({ id, email, plan: 'free' }, { onConflict: 'id' });
        setUser(fallback);
      }
    } catch {
      // On any error or timeout, let the user in with free plan
      setUser(fallback);
    }
    setLoading(false);
  };

  const handleCallbackUrl = async (url: string) => {
    console.log('[AUTH] callback URL:', url);
    try {
      const urlObj = new URL(url);
      const code = urlObj.searchParams.get('code');
      if (code) {
        console.log('[AUTH] exchanging PKCE code...');
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) console.error('[AUTH] exchange error:', error.message);
        return;
      }
      // Fallback: check session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        fetchUser(session.user.id, session.user.email ?? '');
      }
    } catch (e) {
      console.error('[AUTH] handleCallbackUrl error:', e);
    }
  };

  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUser(session.user.id, session.user.email ?? '');
      } else {
        setLoading(false);
      }
    });

    // Auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AUTH] state change:', event, session?.user?.email);
      if (session?.user) {
        fetchUser(session.user.id, session.user.email ?? '');
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      }
    });

    // Start local HTTP callback server
    invoke<number>('start_auth_callback_server')
      .then(port => {
        console.log('[AUTH] callback server on port:', port);
        setCallbackPort(port);
      })
      .catch(e => console.error('[AUTH] server start error:', e));

    // Listen for auth-callback event from Rust
    const unlisten = listen<{ url: string }>('auth-callback', (event) => {
      console.log('[AUTH] callback event received:', event.payload.url);
      handleCallbackUrl(event.payload.url);
    });

    return () => {
      subscription.unsubscribe();
      unlisten.then(fn => fn());
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, callbackPort, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
