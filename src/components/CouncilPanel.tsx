import { useState } from 'react';
import AgentCard from './AgentCard';

export interface AgentResult {
  agent_id: string;
  role: string;
  tier: number;
  provider: string;
  model: string;
  verdict: string;
  output: string;
  findings: Array<{ severity: string; description: string }>;
}

export interface CouncilState {
  agents: AgentResult[];
  gate_verdict: string;
  gate_scorecard: string;
  approved: boolean;
  running: boolean;
}

interface CouncilPanelProps {
  council: CouncilState;
  onApprove: () => void;
  onRequestChanges: () => void;
  onReject: () => void;
  status: string;
}

const TIER_ORDER = [1, 2, 3, 4];
const TIER_LABEL: Record<number, string> = {
  1: 'TIER 1 — CORE COUNCIL',
  2: 'TIER 2 — SPECIALISTS',
  3: 'TIER 3 — INNOVATION',
  4: 'TIER 4 — STAGE EXPERTS',
};

export default function CouncilPanel({ council, onApprove, onRequestChanges, onReject, status }: CouncilPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showScorecard, setShowScorecard] = useState(false);

  const toggleExpand = (id: string) => setExpanded(prev => prev === id ? null : id);

  const agentsByTier = TIER_ORDER.map(tier => ({
    tier,
    agents: council.agents.filter(a => a.tier === tier),
  })).filter(g => g.agents.length > 0);

  const blockers = council.agents.filter(a => a.verdict === 'SOFT_BLOCK');
  const running = council.agents.filter(a => a.verdict === 'RUNNING');
  const done = council.agents.filter(a => !['RUNNING', 'PENDING'].includes(a.verdict));
  const total = council.agents.length;

  const canApprove = council.approved && !council.running && status !== 'approved';

  return (
    <div style={{
      width: 260, borderLeft: '0.5px solid var(--color-border-tertiary)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      background: '#FAFAFA', overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{ padding: '14px 14px 10px', borderBottom: '0.5px solid #E2E8F0', flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          AI Council
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {council.running ? (
            <>
              <span style={{ display: 'inline-block', width: 8, height: 8, background: '#0284C7', borderRadius: '50%', animation: 'linup-pulse 1.5s ease-in-out infinite' }} />
              <span style={{ fontSize: 12, color: '#0284C7' }}>{running.length} agent{running.length !== 1 ? 's' : ''} running...</span>
            </>
          ) : total === 0 ? (
            <span style={{ fontSize: 12, color: '#94A3B8' }}>Waiting to start</span>
          ) : (
            <>
              <span style={{ display: 'inline-block', width: 8, height: 8, background: council.approved ? '#16A34A' : '#DC2626', borderRadius: '50%' }} />
              <span style={{ fontSize: 12, color: council.approved ? '#16A34A' : '#DC2626', fontWeight: 600 }}>
                {council.gate_verdict || `${done.length}/${total} complete`}
              </span>
            </>
          )}
        </div>
        {total > 0 && (
          <div style={{ marginTop: 8, height: 3, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(done.length / total) * 100}%`, background: council.approved ? '#16A34A' : '#6366F1', transition: 'width 0.5s ease', borderRadius: 2 }} />
          </div>
        )}
      </div>

      {/* Blockers banner */}
      {blockers.length > 0 && (
        <div style={{ padding: '8px 14px', background: '#FEF3C7', borderBottom: '1px solid #FDE68A', fontSize: 12, color: '#92400E' }}>
          ⚠ {blockers.length} soft block{blockers.length !== 1 ? 's' : ''} — review before approving
        </div>
      )}

      {/* Agent list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
        {agentsByTier.map(({ tier, agents }) => (
          <div key={tier}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', padding: '8px 8px 4px', letterSpacing: '0.06em' }}>
              {TIER_LABEL[tier]}
            </div>
            {agents.map(agent => (
              <AgentCard
                key={agent.agent_id}
                agentId={agent.agent_id}
                role={agent.role}
                tier={agent.tier}
                provider={agent.provider}
                model={agent.model}
                verdict={agent.verdict}
                output={agent.output}
                onExpand={toggleExpand}
                expanded={expanded === agent.agent_id}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Gate scorecard + actions */}
      {total > 0 && !council.running && (
        <div style={{ padding: 12, borderTop: '0.5px solid #E2E8F0', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>

          {council.gate_scorecard && (
            <button onClick={() => setShowScorecard(s => !s)} style={{ padding: '7px 10px', background: '#F1F5F9', border: '0.5px solid #E2E8F0', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#475569', fontWeight: 500 }}>
              {showScorecard ? 'Hide' : 'View'} quality scorecard
            </button>
          )}

          {showScorecard && council.gate_scorecard && (
            <div style={{ padding: 10, background: '#fff', borderRadius: 6, border: '0.5px solid #E2E8F0', fontSize: 11, color: '#334155', whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', lineHeight: 1.6 }}>
              {council.gate_scorecard}
            </div>
          )}

          <button
            onClick={onApprove}
            disabled={!canApprove}
            style={{ padding: '9px', background: canApprove ? '#16A34A' : '#E4E4E0', color: canApprove ? '#fff' : '#9B9B94', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: canApprove ? 'pointer' : 'not-allowed' }}
          >
            {status === 'approved' ? '✓ Approved' : '✓ Approve & continue'}
          </button>

          <button
            onClick={onRequestChanges}
            style={{ padding: '9px', background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Request changes
          </button>

          <button
            onClick={onReject}
            style={{ padding: '9px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Reject & redo
          </button>
        </div>
      )}
    </div>
  );
}