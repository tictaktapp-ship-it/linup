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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUser(session.user.id, session.user.email ?? '');
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUser(session.user.id, session.user.email ?? '');
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Handle deep link callback from magic link email
    onOpenUrl(urls => {
      const url = urls[0];
      if (url?.includes('access_token') || url?.includes('code=')) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) fetchUser(session.user.id, session.user.email ?? '');
        });
      }
    }).catch(() => {});

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
