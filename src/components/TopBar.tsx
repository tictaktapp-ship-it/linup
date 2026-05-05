import { LOGO_WORDMARK } from '../constants/logos';

export default function TopBar() {
  return (
    <div style={{
      height: 48,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      borderBottom: '0.5px solid var(--color-border-tertiary)',
      background: 'var(--color-bg-primary)',
      flexShrink: 0,
      width: '100%',
    }}>
      {/* Logo — mix-blend-mode multiply removes the black background from the PNG */}
      <img
        src={LOGO_WORDMARK}
        alt='LINUP'
        style={{
          height: 22,
          mixBlendMode: 'multiply',
          filter: 'brightness(0) saturate(100%) invert(12%) sepia(80%) saturate(5000%) hue-rotate(270deg) brightness(70%)',
          objectFit: 'contain',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{
          fontSize: 12,
          color: 'var(--color-text-tertiary)',
          cursor: 'pointer',
          letterSpacing: '0.02em',
        }}>
          Settings
        </span>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'var(--color-brand-gradient)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: '#fff', fontWeight: 700, cursor: 'pointer',
          flexShrink: 0,
        }}>E</div>
      </div>
    </div>
  );
}