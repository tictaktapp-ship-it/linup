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
      <img src={LOGO_WORDMARK} alt='LINUP' style={{ height: 20 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', cursor: 'pointer' }}>
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