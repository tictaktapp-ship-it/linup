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
    }}>
      <img src={LOGO_WORDMARK} alt='LINUP' style={{ height: 18 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Settings</span>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'var(--color-accent-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: '#fff', fontWeight: 600, cursor: 'pointer',
        }}>E</div>
      </div>
    </div>
  );
}
