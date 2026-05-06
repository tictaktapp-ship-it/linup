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
        style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', height: 32, overflow: 'hidden' }}
      >
        {/* Wordmark PNG — mix-blend-mode:multiply makes black background transparent on white */}
        <img
          src="/assets/linup-wordmark.png"
          alt="LINUP"
          style={{
            height: 28,
            objectFit: 'contain',
            mixBlendMode: 'multiply',
            display: 'block',
          }}
        />
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