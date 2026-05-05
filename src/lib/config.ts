export const GROQ_API_KEY    = import.meta.env.VITE_GROQ_API_KEY as string ?? '';
export const OPENROUTER_KEY  = import.meta.env.VITE_OPENROUTER_API_KEY as string ?? '';
export const SUPABASE_URL    = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const GROQ_BASE_URL = 'https://openrouter.ai/api/v1';

export const MODELS = {
  FAST:    'meta-llama/llama-3.1-8b-instruct',
  CAPABLE: 'meta-llama/llama-3.3-70b-instruct:free',
} as const;