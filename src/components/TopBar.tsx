import { useNavigate } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';

export default function TopBar() {
  const navigate = useNavigate();
  const win = getCurrentWindow();
  return (
    <div data-tauri-drag-region style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px 0 20px', borderBottom: '0.5px solid var(--color-border-tertiary)', background: '#FAFAFA', flexShrink: 0, width: '100%', userSelect: 'none' }}>
      <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <img src='/assets/linup-icon.png' alt='' style={{ width: 28, height: 28, objectFit: 'contain' }} />
        <img src='/assets/linup-wordmark-transparent.png' alt='LINUP' style={{ height: 22, objectFit: 'contain', display: 'block' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', cursor: 'pointer', padding: '0 8px' }}>Settings</span>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-brand-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 700, cursor: 'pointer', marginRight: 12 }}>E</div>
        {[
          { label: 'x', title: 'Close', color: '#EF4444', fn: () => win.close() },
          { label: 'o', title: 'Maximise', color: '#10B981', fn: () => win.toggleMaximize() },
          { label: '-', title: 'Minimise', color: '#F59E0B', fn: () => win.minimize() },
        ].map(btn => (
          <button key={btn.title} title={btn.title} onClick={e => { e.stopPropagation(); btn.fn(); }}
            style={{ width: 14, height: 14, borderRadius: '50%', border: 'none', background: btn.color, cursor: 'pointer', flexShrink: 0, marginLeft: 2 }} />
        ))}
      </div>
    </div>
  );
}