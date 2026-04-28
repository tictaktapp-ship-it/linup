import React, { useState } from 'react';

type DiffLine = { lineNum?: number; type: 'added' | 'removed' | 'context'; content: string };
type Artifact = { name: string; status: 'synced' | 'not_synced' };
type GateResult = { name: string; passed: boolean; description: string };

interface EvidencePackViewerProps {
  stageNumber: number; stageName: string; whatChanged: string; why: string;
  risk: 'low' | 'medium' | 'high'; gatesPassed: number; gatesFailed: number;
  snapshotName: string; diff?: DiffLine[]; artifacts?: Artifact[];
  gateResults?: GateResult[];
  stageState: 'awaiting_approval' | 'complete' | 'gate_failed' | 'running';
  onApprove?: () => void; onRequestChanges?: () => void; onRollBack?: () => void;
  defaultExpanded?: boolean;
}

const riskColor = { low: '#16A34A', medium: '#D97706', high: '#DC2626' };

const EvidencePackViewer: React.FC<EvidencePackViewerProps> = ({
  stageNumber, stageName, whatChanged, why, risk, gatesPassed, gatesFailed,
  snapshotName, diff, artifacts, gateResults, stageState,
  onApprove, onRequestChanges, onRollBack, defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const btn = (label: string, onClick?: () => void, style?: React.CSSProperties) => (
    <button onClick={onClick} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, ...style }}>{label}</button>
  );

  return (
    <div style={{ border: '1px solid var(--color-border-default, #E4E4E0)', borderRadius: 8, overflow: 'hidden', fontSize: 14 }}>
      {/* Summary — always visible */}
      <div style={{ padding: '12px 16px', background: 'var(--color-surface-default, #F9F9F8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 16 }}>👁</span>
          <strong style={{ flex: 1 }}>Evidence Pack — Stage {stageNumber} · {stageName}</strong>
          <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1D4ED8', fontSize: 13 }}>
            {expanded ? 'Hide details ←' : 'Show details →'}
          </button>
        </div>

        <div style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: '#6B6B66', textTransform: 'uppercase', letterSpacing: 0.5 }}>What changed</span>
          <p style={{ margin: '2px 0 8px' }}>{whatChanged}</p>
          <span style={{ fontSize: 11, color: '#6B6B66', textTransform: 'uppercase', letterSpacing: 0.5 }}>Why</span>
          <p style={{ margin: '2px 0 8px' }}>{why}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ background: riskColor[risk], color: '#fff', borderRadius: 12, padding: '1px 8px', fontSize: 12 }}>{risk} risk</span>
          <span style={{ fontSize: 13, color: '#6B6B66' }}>✓ {gatesPassed} passed · ✗ {gatesFailed} failed</span>
          <span style={{ fontSize: 11, color: '#6B6B66', marginLeft: 'auto' }}>Roll back restores: {snapshotName}</span>
        </div>

        {stageState === 'awaiting_approval' && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {btn('Approve and lock', onApprove, { background: '#1D4ED8', color: '#fff' })}
            {btn('Request changes', onRequestChanges, { background: 'transparent', color: '#1D4ED8' })}
            {btn('Roll back', onRollBack, { background: 'transparent', color: '#DC2626' })}
          </div>
        )}
      </div>

      {/* Detail — expanded */}
      {expanded && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid #E4E4E0' }}>
          {diff && diff.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <strong style={{ fontSize: 12, textTransform: 'uppercase', color: '#6B6B66' }}>Diff</strong>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, marginTop: 6 }}>
                {diff.map((line, i) => (
                  <div key={i} style={{
                    background: line.type === 'added' ? '#DCFCE7' : line.type === 'removed' ? '#FEE2E2' : 'transparent',
                    padding: '1px 6px', display: 'flex', gap: 8,
                  }}>
                    <span style={{ color: '#6B6B66', minWidth: 32, userSelect: 'none' }}>{line.lineNum ?? ''}</span>
                    <span>{line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '} {line.content}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {artifacts && artifacts.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <strong style={{ fontSize: 12, textTransform: 'uppercase', color: '#6B6B66' }}>Artifacts</strong>
              {artifacts.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid #F0F0EE' }}>
                  <span style={{ flex: 1, fontSize: 13 }}>{a.name}</span>
                  {a.status === 'not_synced' && <span style={{ color: '#D97706', fontSize: 12 }}>⚠ Reconnect to fetch</span>}
                  {a.status === 'synced' && <span style={{ color: '#16A34A', fontSize: 12 }}>✓ synced</span>}
                </div>
              ))}
            </div>
          )}

          {gateResults && gateResults.length > 0 && (
            <div>
              <strong style={{ fontSize: 12, textTransform: 'uppercase', color: '#6B6B66' }}>Gate Report</strong>
              {gateResults.map((g, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0' }}>
                  <span>{g.passed ? '✓' : '✗'}</span>
                  <span style={{ fontWeight: 500 }}>{g.name}</span>
                  <span style={{ color: '#6B6B66', fontSize: 12 }}>{g.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EvidencePackViewer;