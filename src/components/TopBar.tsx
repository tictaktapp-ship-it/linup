import { useNavigate, useLocation } from 'react-router-dom';

export default function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const inProject = location.pathname.includes('/project/');

  return (
    <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', background: '#FAFAFA', flexShrink: 0, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {inProject && (
          <button onClick={() => navigate('/')}
            style={{ padding: '4px 8px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, color: 'var(--color-text-tertiary)', lineHeight: 1, borderRadius: 6 }}
            title="Back to projects">
            ←
          </button>
        )}
        <div onClick={() => navigate('/')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <img src="/assets/linup-wordmark-transparent.png" alt="LINUP"
            style={{ height: 20, objectFit: 'contain', display: 'block' }} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', cursor: 'pointer' }}>Settings</span>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-brand-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>E</div>
      </div>
    </div>
  );
}