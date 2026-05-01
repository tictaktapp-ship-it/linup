import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserPlan = 'free' | 'starter' | 'pro' | 'team';

export interface LinupUser {
  id: string;
  email: string;
  plan: UserPlan;
}
