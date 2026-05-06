import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { flowType: 'pkce', detectSessionInUrl: false }
});

// ── User ID management ────────────────────────────────────────────────────────
// Auth is handled by Rust. We store the user_id here after login.
let _currentUserId: string | null = null;

export function setCurrentUserId(id: string) {
  _currentUserId = id;
  try { localStorage.setItem('linup_user_id', id); } catch {}
}

export function getCurrentUserId(): string | null {
  if (_currentUserId) return _currentUserId;
  try { return localStorage.getItem('linup_user_id'); } catch { return null; }
}

export function clearCurrentUserId() {
  _currentUserId = null;
  try { localStorage.removeItem('linup_user_id'); } catch {}
}

// ── Project interface ─────────────────────────────────────────────────────────
export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string;
  stage_index: number;
  status: string;
  brand_primary_colour?: string;
  brand_tone?: string;
  brand_font_preference?: string;
  brand_has_logo?: number;
  brand_notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface CouncilArtifact {
  id?: string;
  project_id: string;
  user_id: string;
  stage_index: number;
  artifact_type: string;
  content: string;
  created_at?: string;
}

// ── Projects ──────────────────────────────────────────────────────────────────
export async function listProjects(): Promise<Project[]> {
  const userId = getCurrentUserId();
  let query = supabase.from('projects').select('*').order('created_at', { ascending: false });
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) {
    console.warn('[Supabase] listProjects error:', error.message);
    return [];
  }
  return data ?? [];
}

export async function createProject(name: string, description: string): Promise<Project | null> {
  const userId = getCurrentUserId();
  if (!userId) {
    console.warn('[Supabase] createProject: no user_id set');
    return null;
  }
  const { data, error } = await supabase
    .from('projects')
    .insert({ name, description, user_id: userId })
    .select()
    .single();
  if (error) { console.warn('[Supabase] createProject error:', error.message); return null; }
  return data;
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
  if (error) return null;
  return data;
}

export async function updateProjectStage(id: string, stageIndex: number): Promise<void> {
  const { error } = await supabase.from('projects').update({ stage_index: stageIndex }).eq('id', id);
  if (error) console.warn('[Supabase] updateProjectStage error:', error.message);
}

export async function updateProjectBrand(id: string, brand: {
  primary_colour?: string; tone?: string; font_preference?: string;
  has_logo?: boolean; notes?: string;
}): Promise<void> {
  const { error } = await supabase.from('projects').update({
    brand_primary_colour: brand.primary_colour,
    brand_tone: brand.tone,
    brand_font_preference: brand.font_preference,
    brand_has_logo: brand.has_logo ? 1 : 0,
    brand_notes: brand.notes,
  }).eq('id', id);
  if (error) console.warn('[Supabase] updateProjectBrand error:', error.message);
}

// ── Council artifacts ─────────────────────────────────────────────────────────
export async function saveCouncilArtifact(artifact: CouncilArtifact): Promise<void> {
  const userId = getCurrentUserId() || artifact.user_id || 'anonymous';
  const { error } = await supabase.from('council_artifacts').insert({
    ...artifact,
    user_id: userId,
  });
  if (error) console.warn('[Supabase] saveCouncilArtifact error:', error.message);
}

export async function getCouncilArtifacts(projectId: string, stageIndex: number): Promise<CouncilArtifact[]> {
  const { data, error } = await supabase
    .from('council_artifacts')
    .select('*')
    .eq('project_id', projectId)
    .eq('stage_index', stageIndex)
    .order('created_at', { ascending: false });
  if (error) { console.warn('[Supabase] getCouncilArtifacts error:', error.message); return []; }
  return data ?? [];
}

export async function getLatestArtifact(projectId: string, stageIndex: number, type: string): Promise<CouncilArtifact | null> {
  const { data, error } = await supabase
    .from('council_artifacts')
    .select('*')
    .eq('project_id', projectId)
    .eq('stage_index', stageIndex)
    .eq('artifact_type', type)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data;
}

// ── Stage runs ────────────────────────────────────────────────────────────────
export async function upsertStageRun(projectId: string, stageIndex: number, status: string): Promise<void> {
  const userId = getCurrentUserId() || 'anonymous';
  const { error } = await supabase.from('stage_runs').upsert({
    project_id: projectId,
    user_id: userId,
    stage_index: stageIndex,
    status,
    started_at: new Date().toISOString(),
  }, { onConflict: 'project_id,stage_index' });
  if (error) console.warn('[Supabase] upsertStageRun error:', error.message);
}

// ── Spec artifacts ────────────────────────────────────────────────────────────
export async function saveSpecArtifact(projectId: string, content: string, gaps: string[], questions: string[]): Promise<void> {
  const userId = getCurrentUserId() || 'anonymous';
  const { error } = await supabase.from('spec_artifacts').insert({
    project_id: projectId,
    user_id: userId,
    content,
    all_gaps: gaps,
    all_questions: questions,
    version: '0.1.0',
  });
  if (error) console.warn('[Supabase] saveSpecArtifact error:', error.message);
}

export async function restoreSession(accessToken: string, refreshToken: string): Promise<void> {
  await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
}

export async function getStoredSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}