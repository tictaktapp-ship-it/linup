import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import StageStatusHeader from '../components/StageStatusHeader';
import EvidencePackViewer from '../components/EvidencePackViewer';
import BudgetBar from '../components/BudgetBar';

type WorkspaceState =
  | 'ready_to_run'
  | 'running'
  | 'awaiting_approval'
  | 'gate_failed'
  | 'budget_exceeded'
  | 'stopped'
  | 'complete'
  | 'offline_readonly';

const STAGE_NAMES = [
  'Idea Intake', 'Clarify', 'Constraints', 'Product Spec',
  'Architecture', 'Scaffold', 'Implementation', 'Hardening',
  'Tests', 'Build', 'Deploy',
];

const StageWorkspaceScreen: React.FC = () => {
  const { projectId, stageIndex } = useParams<{ projectId: string; stageIndex: string }>();
  const idx = parseInt(stageIndex ?? '0', 10);
  const stageName = STAGE_NAMES[idx] ?? `Stage ${idx + 1}`;

  const [wsState, setWsState] = useState<WorkspaceState>('ready_to_run');
  const [budgetSpent, setBudgetSpent] = useState(0);
  const [budgetCap, setBudgetCap] = useState(10);
  const [gatesPassed, setGatesPassed] = useState(0);
  const [gatesFailed, setGatesFailed] = useState(0);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    invoke<{ status: string }>('get_stage_model', { projectId })
      .then(model => {
        const stages = (model as any).stages as { stage_index: number; status: string }[];
        const stage = stages?.find(s => s.stage_index === idx);
        if (stage) setWsState(stage.status as WorkspaceState);
      })
      .catch(() => setOffline(true));

    invoke<{ spent: number; cap: number }>('check_budget', { projectId })
      .then(b => { setBudgetSpent(b.spent); setBudgetCap(b.cap); })
      .catch(() => {});
  }, [projectId, idx]);

  if (offline) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12 }}>
      <div style={{ fontSize: 32 }}>📡</div>
      <h2 style={{ margin: 0 }}>Offline — read only</h2>
      <p style={{ color: '#6B6B66' }}>Your work is saved locally. Reconnect to continue.</p>
    </div>
  );

  const headerState = wsState === 'ready_to_run' ? 'running' : wsState as any;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top bar */}
      <StageStatusHeader
        stageName={stageName}
        stageIndex={idx}
        stageTotal={11}
        state={headerState}
        gatesPassed={gatesPassed}
        gatesFailed={gatesFailed}
        budgetSpent={budgetSpent}
        budgetCap={budgetCap}
        onApprove={() => {
          invoke('set_stage_approved', { projectId, stageIndex: idx })
            .then(() => setWsState('complete'))
            .catch(console.error);
        }}
        onRequestChanges={() => setWsState('gate_failed')}
        onStop={() => setWsState('stopped')}
        onChoosePath={() => setWsState('ready_to_run')}
        onRaiseCap={() => setBudgetCap(c => c * 1.5)}
        onReduceScope={() => {}}
        onViewEvidence={() => {}}
        onRerun={() => setWsState('running')}
      />

      {/* Budget bar */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #E4E4E0' }}>
        <BudgetBar spent={budgetSpent} cap={budgetCap} showViewSpend />
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {wsState === 'ready_to_run' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
            <div style={{ fontSize: 48 }}>⚡</div>
            <h2 style={{ margin: 0 }}>Ready to run {stageName}</h2>
            <p style={{ color: '#6B6B66', margin: 0 }}>This stage will use AI to complete the work, then ask for your approval.</p>
            <button
              onClick={() => { setWsState('running'); invoke('set_stage_status', { projectId, stageIndex: idx, status: 'running' }).catch(console.error); }}
              style={{ padding: '12px 32px', borderRadius: 8, border: 'none', background: '#1D4ED8', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
              Run {stageName} →
            </button>
          </div>
        )}

        {wsState === 'running' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
            <div style={{ fontSize: 48, animation: 'spin 2s linear infinite' }}>⚙️</div>
            <h2 style={{ margin: 0 }}>Running {stageName}...</h2>
            <p style={{ color: '#6B6B66' }}>AI is working. This takes 2–5 minutes.</p>
          </div>
        )}

        {(wsState === 'awaiting_approval' || wsState === 'complete' || wsState === 'gate_failed') && (
          <EvidencePackViewer
            stageNumber={idx + 1}
            stageName={stageName}
            whatChanged="AI completed this stage and produced artifacts for review."
            why="Each stage must be approved before the next begins."
            risk="low"
            gatesPassed={gatesPassed}
            gatesFailed={gatesFailed}
            snapshotName={`snapshot_${projectId}_stage${idx}`}
            stageState={wsState === 'complete' ? 'complete' : wsState === 'gate_failed' ? 'gate_failed' : 'awaiting_approval'}
            defaultExpanded={wsState === 'awaiting_approval'}
            onApprove={() => {
              invoke('set_stage_approved', { projectId, stageIndex: idx })
                .then(() => { setWsState('complete'); setGatesPassed(p => p + 1); })
                .catch(console.error);
            }}
            onRequestChanges={() => setWsState('gate_failed')}
            onRollBack={() => setWsState('ready_to_run')}
          />
        )}

        {wsState === 'stopped' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
            <div style={{ fontSize: 48 }}>🛑</div>
            <h2 style={{ margin: 0 }}>Stage stopped</h2>
            <p style={{ color: '#6B6B66' }}>Choose how to proceed.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StageWorkspaceScreen;