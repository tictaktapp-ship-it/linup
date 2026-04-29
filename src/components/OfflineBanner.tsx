import React, { useEffect, useState } from 'react';

interface OfflineBannerProps {
  state: 'offline' | 'reconnecting' | 'reconnected';
}

const colours = {
  offline:      { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
  reconnecting: { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
  reconnected:  { bg: '#DCFCE7', text: '#166534', border: '#86EFAC' },
};

const messages = {
  offline:      '📡  You are offline. Changes are saved locally.',
  reconnecting: '🔄  Reconnecting...',
  reconnected:  '✓  Back online.',
};

const OfflineBanner: React.FC<OfflineBannerProps> = ({ state }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    if (state === 'reconnected') {
      const t = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [state]);

  if (!visible) return null;

  const c = colours[state];

  return (
    <div style={{
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      padding: '8px 16px', fontSize: 13, fontWeight: 500,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {messages[state]}
    </div>
  );
};

export default OfflineBanner;