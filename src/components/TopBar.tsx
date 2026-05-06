import { useNavigate } from 'react-router-dom';

export default function TopBar() {
  const navigate = useNavigate();
  return (
    <div style={{
      height: 48, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 20px',
      borderBottom: '0.5px solid var(--color-border-tertiary)',
      background: '#FAFAFA', flexShrink: 0, width: '100%',
    }}>
      <div
        onClick={() => navigate('/')}
        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
      >
        <img
          src="/assets/linup-icon.png"
          alt=""
          style={{ width: 32, height: 32, objectFit: 'contain' }}
        />
        <span style={{
          fontSize: 20,
          fontWeight: 800,
          color: 'var(--color-brand)',
          letterSpacing: '-0.04em',
          fontFamily: 'var(--font-sans)',
          lineHeight: 1,
        }}>
          LINUP
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', cursor: 'pointer' }}>
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