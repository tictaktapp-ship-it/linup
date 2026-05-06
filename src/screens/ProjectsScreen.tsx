import { listProjects } from '../lib/supabaseService';

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// invoke not needed for Supabase reads
interface Project { id: string; name: string; description: string; stage_index: number; status: string; created_at: string; updated_at: string; }








const FEATURES = [
  { icon: '🤖', title: 'AI Council', desc: '13 specialist agents review your brief simultaneously — security, ethics, market research, legal, and more.' },
  { icon: '📋', title: 'Locked Specification', desc: '28-section technical spec produced by a 22-member engineering team. Becomes the law for every build stage.' },
  { icon: '⚡', title: '11 Build Stages', desc: 'From product spec through architecture, database, frontend, testing, and deployment — fully guided.' },
];

export default function ProjectsScreen() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listProjects().then(p => { setProjects(p ?? []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-tertiary)', fontSize: 14 }}>Loading...</div>;

  // ── Empty state — first visit ────────────────────────────────────────────────
  if (projects.length === 0) {
    return (
      <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--color-surface-0)' }}>

        {/* Hero */}
        <div style={{ width: '100%', maxWidth: 720, padding: '64px 32px 48px', textAlign: 'center' }}>
          <img src="/assets/linup-icon.png" alt="LINUP" style={{ width: 96, height: 96, objectFit: 'contain', marginBottom: 24 }} />
          <h1 style={{ fontSize: 36, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.03em', margin: '0 0 16px', lineHeight: 1.1 }}>
            Turn your idea into a<br />
            <span style={{ color: 'var(--color-brand)' }}>production-ready app</span>
          </h1>
          <p style={{ fontSize: 16, color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: '0 0 40px', maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
            LINUP's AI council reviews your brief, a 22-member engineering team writes your specification, and your app is built through 11 guided stages.
          </p>
          <button
            onClick={() => navigate('/onboarding')}
            style={{ padding: '14px 36px', background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.01em', boxShadow: '0 4px 24px rgba(140,0,180,0.30)' }}>
            Start building →
          </button>
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            No code required. No credit card.
          </div>
        </div>

        {/* Feature highlights */}
        <div style={{ width: '100%', maxWidth: 720, padding: '0 32px 32px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ background: '#fff', border: '0.5px solid var(--color-border)', borderRadius: 12, padding: '20px 18px' }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Pipeline preview */}
        <div style={{ width: '100%', maxWidth: 720, padding: '0 32px 64px' }}>
          <div style={{ background: '#fff', border: '0.5px solid var(--color-border)', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>The 11-stage pipeline</div>
            <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
              {['Product Spec','Architecture','Database','Backend','Frontend','Tests','CI/CD','Security','Performance','Deployment','Handover'].map((stage, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: i === 0 ? 'var(--color-brand)' : 'var(--color-text-secondary)', fontWeight: i === 0 ? 700 : 400, padding: '3px 8px', background: i === 0 ? 'rgba(140,0,180,0.08)' : 'transparent', borderRadius: 4 }}>{i + 1}. {stage}</span>
                  {i < 10 && <span style={{ color: 'var(--color-border)', fontSize: 10 }}>›</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Projects list ─────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '32px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>Your projects</h1>
            <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => navigate('/onboarding')}
            style={{ padding: '10px 20px', background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 12px rgba(140,0,180,0.25)' }}>
            + New project
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {projects.map(p => (
            <div key={p.id}
              onClick={() => navigate(`/project/${p.id}/stage/0`)}
              style={{ background: '#fff', border: '0.5px solid var(--color-border)', borderRadius: 10, padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'border-color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-brand)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{p.description || 'No description'}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-brand)' }}>Stage {(p.stage_index ?? 0) + 1}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>In progress</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}