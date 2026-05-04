import { createContext } from 'react';
import type { LinupUser } from '../lib/supabase';

export type AuthContextType = {
  user: LinupUser | null;
  loading: boolean;
  debugLog: string[];
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  debugLog: [],
  signOut: async () => {},
});
