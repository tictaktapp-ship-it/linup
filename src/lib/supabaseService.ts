import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string;
  stage_index: number;
  status: string;
  brand_primary_colour?: string;
  brand_secondary_colour?: string;
  brand_tone?: string;
  brand_font_preference?: string;
  brand_has_logo?: number;
  brand_notes?: string;
  created_at: string;
  updated_at: string;
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
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
    .throwOnError();
  if (error) throw error;
  return data ?? [];
}

export async function createProject(name: string, description: string): Promise<Project> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('projects')
    .insert({ name, description, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}

export async function updateProjectStage(id: string, stageIndex: number): Promise<void> {
  await supabase.from('projects').update({ stage_index: stageIndex }).eq('id', id);
}

export async function updateProjectBrand(id: string, brand: {
  primary_colour?: string;
  tone?: string;
  font_preference?: string;
  has_logo?: boolean;
  notes?: string;
}): Promise<void> {
  await supabase.from('projects').update({
    brand_primary_colour: brand.primary_colour,
    brand_tone: brand.tone,
    brand_font_preference: brand.font_preference,
    brand_has_logo: brand.has_logo ? 1 : 0,
    brand_notes: brand.notes,
    updated_at: new Date().toISOString(),
  }).eq('id', id);
}

// ── Council artifacts ─────────────────────────────────────────────────────────

export async function saveCouncilArtifact(artifact: CouncilArtifact): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('council_artifacts').insert({
    ...artifact,
    user_id: user.id,
  });
  if (error) throw error;
}

export async function getCouncilArtifacts(projectId: string, stageIndex: number): Promise<CouncilArtifact[]> {
  const { data, error } = await supabase
    .from('council_artifacts')
    .select('*')
    .eq('project_id', projectId)
    .eq('stage_index', stageIndex)
    .order('created_at', { ascending: false });
  if (error) throw error;
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  await supabase.from('stage_runs').upsert({
    project_id: projectId,
    user_id: user.id,
    stage_index: stageIndex,
    status,
    started_at: new Date().toISOString(),
  }, { onConflict: 'project_id,stage_index' });
}

// ── Spec artifacts ────────────────────────────────────────────────────────────

export async function saveSpecArtifact(projectId: string, content: string, gaps: string[], questions: string[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  await supabase.from('spec_artifacts').insert({
    project_id: projectId,
    user_id: user.id,
    content,
    all_gaps: gaps,
    all_questions: questions,
    version: '0.1.0',
  });
}
// Store and restore Supabase session for the JS client
// Called after Rust auth completes and passes the token to the frontend
export async function restoreSession(accessToken: string, refreshToken: string): Promise<void> {
  await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
}

export async function getStoredSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}