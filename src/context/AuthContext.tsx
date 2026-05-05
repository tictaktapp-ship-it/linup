import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
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

  useEffect(() => {
    // IMMEDIATELY stop loading after 3 seconds no matter what
    const hardStop = setTimeout(() => setLoading(false), 3000);

    // Try to get existing session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        clearTimeout(hardStop);
        if (session?.user) {
          setUser({ id: session.user.id, email: session.user.email ?? '', plan: 'free' });
        }
        setLoading(false);
      })
      .catch(() => {
        clearTimeout(hardStop);
        setLoading(false);
      });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? '', plan: 'free' });
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      }
    });

    // Start callback server — completely optional, errors ignored
    try {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke<number>('start_auth_callback_server')
          .then(port => setCallbackPort(port))
          .catch(() => {});
      }).catch(() => {});
    } catch { /* ignore */ }

    // Listen for auth callback event — completely optional
    try {
      import('@tauri-apps/api/event').then(({ listen }) => {
        listen<{ url: string }>('auth-callback', async event => {
          try {
            const url = new URL(event.payload.url);
            const code = url.searchParams.get('code');
            if (code) {
              const { data, error } = await supabase.auth.exchangeCodeForSession(code);
              if (!error && data.session?.user) {
                setUser({ id: data.session.user.id, email: data.session.user.email ?? '', plan: 'free' });
                setLoading(false);
              }
            }
          } catch { /* ignore */ }
        });
      }).catch(() => {});
    } catch { /* ignore */ }

    return () => {
      clearTimeout(hardStop);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    setUser(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, callbackPort, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
