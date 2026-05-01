import { LOGO_ICON } from '../constants/logos';
import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Project } from '../types/project';

const ProjectsScreen: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    invoke<Project[]>('get_projects')
      .then(data => { setProjects(data); setLoading(false); })
      .catch(() => { setIsOffline(false); setLoading(false); }); // backend not ready yet
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#6B6B66' }}>
      Loading projects...
    </div>
  );

  if (isOffline) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12 }}>
      <div style={{ fontSize: 32 }}>📡</div>
      <h2 style={{ margin: 0 }}>You're offline</h2>
      <p style={{ color: '#6B6B66', margin: 0 }}>Connect to the internet to sync your projects.</p>
      <button disabled style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#E4E4E0', color: '#9B9B96', cursor: 'not-allowed' }}>
        Refresh
      </button>
    </div>
  );

  if (!projects.length) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16 }}>
      <div style={{ fontSize: 48 }}></div>
      <h2 style={{ margin: 0 }}>No projects yet</h2>
      <p style={{ color: '#6B6B66', margin: 0 }}>Turn your idea into a production app in 11 stages.</p>
      <button
        onClick={() => window.location.hash = '/onboarding'}
        style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#1D4ED8', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
      >
        Create your first app
      </button>
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Your Apps</h1>
        <button
          onClick={() => window.location.hash = '/onboarding'}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1D4ED8', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
        >
          + New app
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {projects.map(p => {
          const pct = p.budgetCap > 0 ? Math.min((p.budgetUsed / p.budgetCap) * 100, 100) : 0;
          const barColor = pct >= 100 ? '#7C3AED' : pct >= 95 ? '#DC2626' : pct >= 80 ? '#D97706' : '#16A34A';
          return (
            <div key={p.id}
              onClick={() => window.location.hash = `/project/${p.id}/stage/0`}
              style={{ border: '1px solid #E4E4E0', borderRadius: 10, padding: 16, cursor: 'pointer', background: '#fff', transition: 'box-shadow 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{p.name}</h3>
                <span style={{ fontSize: 11, background: '#F0F0EE', borderRadius: 4, padding: '2px 6px', color: '#6B6B66' }}>
                  {p.lastStage}
                </span>
              </div>
              <div style={{ height: 6, background: '#E4E4E0', borderRadius: 3, marginBottom: 8 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B6B66' }}>
                <span style={{ fontFamily: 'monospace' }}>£{p.budgetUsed.toFixed(2)} / £{p.budgetCap.toFixed(2)}</span>
                <span>Synced {new Date(p.lastSynced).toLocaleDateString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProjectsScreen;