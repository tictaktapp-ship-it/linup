import { createContext, useContext, useEffect, useState }
import type { ReactNode } from 'react';
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

  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUser(session.user.id, session.user.email ?? '');
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUser(session.user.id, session.user.email ?? '');
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
        // First sign-in — create user record
        await supabase.from('users').insert({ id, email, plan: 'free' });
        setUser({ id, email, plan: 'free' });
      }
    } catch {
      setUser({ id, email, plan: 'free' });
    }
    setLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
