import { useNavigate } from 'react-router-dom';

export default function TopBar() {
  const navigate = useNavigate();
  return (
    <div style={{
      height: 48, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 20px',
      borderBottom: '0.5px solid var(--color-border-tertiary)',
      background: 'var(--color-bg-primary)', flexShrink: 0, width: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate('/')}>
        <img src="/assets/linup-icon.png" alt="LINUP icon" style={{ width: 28, height: 28, objectFit: 'contain' }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-brand)', letterSpacing: '-0.02em', fontFamily: 'var(--font-sans)' }}>
          LINUP
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', cursor: 'pointer', letterSpacing: '0.02em' }}>
          Settings
        </span>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'var(--color-brand-gradient)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: '#fff', fontWeight: 700, cursor: 'pointer',
        }}>E</div>
      </div>
    </div>
  );
}