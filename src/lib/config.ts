// API keys baked in at build time from GitHub Actions secrets.
// Users never see or enter these. All AI costs borne centrally by LINUP.
export const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string ?? '';
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Groq base URL — OpenAI-compatible API
export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

// Model assignments — update here to change models for all users instantly
export const MODELS = {
  // Fast 8B — used for simple tasks: conversation, checklists, intake
  FAST:     'llama-3.1-8b-instant',
  // Capable 70B — used for all reasoning, writing, review, and gate tasks
  CAPABLE:  'llama-3.3-70b-versatile',
} as const;