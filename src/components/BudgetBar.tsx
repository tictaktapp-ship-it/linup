import React, { useState } from 'react';

interface StageSpend { stageName: string; spent: number }
interface BudgetBarProps {
  spent: number;
  cap: number;
  width?: string;
  showViewSpend?: boolean;
  stageBreakdown?: StageSpend[];
}

function getState(spent: number, cap: number) {
  if (cap <= 0) return { color: '#7C3AED', exceeded: true };
  const pct = spent / cap;
  if (pct >= 1)    return { color: '#7C3AED', exceeded: true };
  if (pct >= 0.95) return { color: '#DC2626', exceeded: false };
  if (pct >= 0.80) return { color: '#D97706', exceeded: false };
  return           { color: '#16A34A', exceeded: false };
}

const BudgetBar: React.FC<BudgetBarProps> = ({
  spent, cap, width = '100%', showViewSpend = true, stageBreakdown = [],
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { color, exceeded } = getState(spent, cap);
  const fillPct = Math.min((spent / cap) * 100, 100);

  return (
    <div style={{ width, position: 'relative' }}>
      {/* Bar */}
      <div style={{ height: 10, background: '#E4E4E0', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${fillPct}%`, background: color, borderRadius: 5, transition: 'width 0.3s' }} />
      </div>

      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: exceeded ? color : 'inherit' }}>
          {exceeded ? 'Cap exceeded' : `£${spent.toFixed(2)} / £${cap.toFixed(2)}`}
        </span>
        {showViewSpend && (
          <button onClick={() => setDrawerOpen(o => !o)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#1D4ED8', padding: 0 }}>
            View spend
          </button>
        )}
      </div>

      {/* Drawer */}
      {drawerOpen && (
        <>
          <div onClick={() => setDrawerOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{
            position: 'fixed', right: 0, top: 0, bottom: 0, width: 320, zIndex: 50,
            background: '#fff', boxShadow: '-4px 0 16px rgba(0,0,0,0.12)',
            padding: '20px 16px', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <strong>Budget Breakdown</strong>
              <button onClick={() => setDrawerOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
            {stageBreakdown.length === 0 && (
              <p style={{ color: '#6B6B66', fontSize: 13 }}>No stage data yet.</p>
            )}
            {stageBreakdown.map((s, i) => {
              const pct = cap > 0 ? Math.min((s.spent / cap) * 100, 100) : 0;
              return (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                    <span>{s.stageName}</span>
                    <span style={{ fontFamily: 'monospace' }}>£{s.spent.toFixed(2)}</span>
                  </div>
                  <div style={{ height: 6, background: '#E4E4E0', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
            <div style={{ borderTop: '1px solid #E4E4E0', marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
              <span>Total</span>
              <span style={{ fontFamily: 'monospace' }}>£{spent.toFixed(2)} / £{cap.toFixed(2)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BudgetBar;