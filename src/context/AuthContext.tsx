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

  const fetchUser = (id: string, email: string) => {
    // Set user immediately from session — never block on DB query
    setUser({ id, email, plan: 'free' });
    setLoading(false);
    // Sync to DB in background — fire and forget
    void supabase.from('users').upsert({ id, email, plan: 'free' }, { onConflict: 'id' });
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
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) fetchUser(session.user.id, session.user.email ?? '');
    } catch (e) {
      console.error('[AUTH] handleCallbackUrl error:', e);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUser(session.user.id, session.user.email ?? '');
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AUTH] state change:', event, session?.user?.email ?? 'null');
      if (session?.user) {
        fetchUser(session.user.id, session.user.email ?? '');
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      }
    });

    invoke<number>('start_auth_callback_server')
      .then(port => {
        console.log('[AUTH] callback server on port:', port);
        setCallbackPort(port);
      })
      .catch(e => console.error('[AUTH] server start error:', e));

    const unlistenPromise = listen<{ url: string }>('auth-callback', event => {
      console.log('[AUTH] callback event:', event.payload.url);
      void handleCallbackUrl(event.payload.url);
    });

    return () => {
      subscription.unsubscribe();
      unlistenPromise.then(fn => fn());
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
