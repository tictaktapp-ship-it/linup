import React from 'react';

interface StageStatusHeaderProps {
  stageName: string;
  stageIndex: number;
  stageTotal: number;
  state: 'running' | 'awaiting_approval' | 'gate_failed' | 'budget_exceeded' | 'stopped' | 'complete';
  gatesPassed?: number;
  gatesFailed?: number;
  budgetSpent?: number;
  budgetCap?: number;
  onApprove?: () => void;
  onRequestChanges?: () => void;
  onStop?: () => void;
  onChoosePath?: () => void;
  onRaiseCap?: () => void;
  onReduceScope?: () => void;
  onViewEvidence?: () => void;
  onRerun?: () => void;
}

const badge: Record<string, { bg: string; label: string }> = {
  running:            { bg: '#1D4ED8', label: 'Running' },
  awaiting_approval:  { bg: '#1D4ED8', label: 'Awaiting Approval' },
  gate_failed:        { bg: '#DC2626', label: 'Gate Failed' },
  budget_exceeded:    { bg: '#7C3AED', label: 'Cap Exceeded' },
  stopped:            { bg: '#7C3AED', label: 'Stopped' },
  complete:           { bg: '#16A34A', label: 'Complete' },
};

const btn = (label: string, onClick?: () => void, style?: React.CSSProperties) => (
  <button
    onClick={onClick}
    style={{
      padding: '6px 14px',
      borderRadius: 6,
      border: 'none',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 500,
      ...style,
    }}
  >
    {label}
  </button>
);

const StageStatusHeader: React.FC<StageStatusHeaderProps> = (props) => {
  const { stageName, stageIndex, stageTotal, state,
          gatesPassed, gatesFailed, budgetSpent, budgetCap,
          onApprove, onRequestChanges, onStop, onChoosePath,
          onRaiseCap, onReduceScope, onViewEvidence, onRerun } = props;

  const b = badge[state];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 16px', background: 'var(--color-surface-default, #F9F9F8)',
      borderBottom: '1px solid var(--color-border-default, #E4E4E0)',
    }}>
      {/* Badge */}
      <span style={{
        background: b.bg, color: '#fff', borderRadius: 4,
        padding: '2px 8px', fontSize: 12, fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {(state === 'running' || state === 'awaiting_approval') && (
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#fff', opacity: 0.8,
            animation: 'pulse 1.5s infinite',
            display: 'inline-block',
          }} />
        )}
        {b.label}
      </span>

      {/* Stage name + index */}
      <span style={{ fontWeight: 500, fontSize: 14, flex: 1 }}>
        {stageName} <span style={{ color: '#6B6B66', fontWeight: 400 }}>
          {stageIndex + 1}/{stageTotal}
        </span>
      </span>

      {/* Gate summary */}
      {(state === 'awaiting_approval' || state === 'gate_failed') && (
        <span style={{ fontSize: 13, color: '#6B6B66' }}>
          {gatesPassed ?? 0} passed · {gatesFailed ?? 0} failed
        </span>
      )}

      {/* Budget */}
      {state === 'budget_exceeded' && budgetSpent !== undefined && budgetCap !== undefined && (
        <span style={{ fontSize: 13, color: '#7C3AED', fontWeight: 500 }}>
          £{budgetSpent.toFixed(2)} / £{budgetCap.toFixed(2)}
        </span>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        {state === 'running' && btn('Stop', onStop, { background: '#FEE2E2', color: '#DC2626' })}

        {state === 'awaiting_approval' && <>
          {btn('Approve', onApprove, { background: '#1D4ED8', color: '#fff' })}
          {btn('Request changes', onRequestChanges, { background: 'transparent', color: '#1D4ED8' })}
        </>}

        {state === 'gate_failed' && <>
          {btn('View failed checks', onViewEvidence, { background: '#DC2626', color: '#fff' })}
          {btn('Retry repair', onRerun, { background: 'transparent', color: '#DC2626' })}
        </>}

        {state === 'budget_exceeded' && <>
          {btn('Raise cap', onRaiseCap, { background: '#7C3AED', color: '#fff' })}
          {btn('Reduce scope', onReduceScope, { background: 'transparent', color: '#7C3AED' })}
          {btn('Stop', onStop, { background: '#FEE2E2', color: '#DC2626' })}
        </>}

        {state === 'stopped' &&
          btn('Choose a path →', onChoosePath, { background: '#7C3AED', color: '#fff', width: '100%' })}

        {state === 'complete' && <>
          {btn('View evidence', onViewEvidence, { background: '#16A34A', color: '#fff' })}
          {btn('Re-run stage', onRerun, { background: 'transparent', color: '#16A34A' })}
        </>}
      </div>
    </div>
  );
};

export const StageStatusHeaderAllStates: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    {(['running','awaiting_approval','gate_failed','budget_exceeded','stopped','complete'] as const).map(s => (
      <StageStatusHeader key={s} stageName="Idea Intake" stageIndex={0} stageTotal={11} state={s}
        gatesPassed={3} gatesFailed={1} budgetSpent={7.50} budgetCap={10}
        onApprove={() => {}} onRequestChanges={() => {}} onStop={() => {}}
        onChoosePath={() => {}} onRaiseCap={() => {}} onReduceScope={() => {}}
        onViewEvidence={() => {}} onRerun={() => {}}
      />
    ))}
  </div>
);

export default StageStatusHeader;