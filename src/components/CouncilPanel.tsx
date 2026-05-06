import { useState, useEffect } from 'react';
import { parseMockupBlocks, generateMockupSVG } from '../lib/mockupGenerator';
import type { MockupSpec } from '../lib/mockupGenerator';


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
  onRequestChanges: (feedback: string) => void;
  onReject: () => void;
  status: string;
}

const ACTIVITY_LABELS: Record<string, string> = {
  clarifier:        'Understanding your requirements',
  spec_writer:      'Writing your product specification',
  devils_advocate:  'Checking for gaps and issues',
  realist:          'Reviewing scope and feasibility',
  security:         'Running security review',
  accessibility:    'Checking accessibility',
  gdpr:             'Reviewing privacy compliance',
  innovator:        'Exploring better approaches',
  business_analyst: 'Validating the business case',
  market_researcher: 'Researching the market and competitors',
  ethics_officer:   'Reviewing ethical considerations',
  financial_advisor: 'Assessing financial viability',
  debugging_engineer: 'Checking for technical risks',
  quality_gate:     'Running final quality checks',
};

const DONE_LABELS: Record<string, string> = {
  clarifier:        'Requirements understood',
  spec_writer:      'Specification written',
  devils_advocate:  'Gap analysis complete',
  realist:          'Scope review complete',
  security:         'Security review complete',
  accessibility:    'Accessibility checked',
  gdpr:             'Privacy review complete',
  innovator:        'Alternatives explored',
  business_analyst: 'Business case validated',
  market_researcher: 'Market research complete',
  ethics_officer:   'Ethics review complete',
  financial_advisor: 'Financial assessment complete',
  debugging_engineer: 'Technical risk review complete',
  quality_gate:     'Quality checks complete',
};

const VERDICT_COLOR: Record<string, string> = {
  PASS:       'var(--color-success)',
  SOFT_BLOCK: 'var(--color-warning)',
  ADVISORY:   'var(--color-advisory)',
  RUNNING:    '#0284C7',
  PENDING:    '#CBD5E1',
  FAILED:     '#DC2626',
};

const VERDICT_ICON: Record<string, string> = {
  PASS:       '✓',
  SOFT_BLOCK: '⚠',
  ADVISORY:   '💡',
  RUNNING:    '◉',
  PENDING:    '○',
  FAILED:     '✗',
};


// ── Mockup viewer component ───────────────────────────────────────────────────
function MockupCard({ spec }: { spec: MockupSpec }) {
  const [svg, setSvg] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const generate = async () => {
    setLoading(true);
    const result = await generateMockupSVG(spec);
    setSvg(result);
    setLoading(false);
    setExpanded(true);
  };

  return (
    <div style={{ border: '0.5px solid #E0E0DE', borderRadius: 8, overflow: 'hidden', background: '#fff', marginBottom: 8 }}>
      <button onClick={() => expanded ? setExpanded(false) : (svg ? setExpanded(true) : generate())}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A18' }}>{spec.screen}</div>
          <div style={{ fontSize: 10, color: '#8A8A82', marginTop: 2 }}>{spec.type} screen · {spec.sections.length} sections</div>
        </div>
        <span style={{ fontSize: 11, color: '#8C00B4', fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>
          {loading ? 'Generating...' : expanded ? 'Hide ▲' : svg ? 'Show ▼' : '✦ Generate'}
        </span>
      </button>
      {loading && (
        <div style={{ padding: '20px', textAlign: 'center', color: '#8A8A82', fontSize: 12 }}>
          <div style={{ display: 'inline-block', width: 20, height: 20, border: '2px solid #E0E0DE', borderTopColor: '#8C00B4', borderRadius: '50%', animation: 'linup-spin 0.7s linear infinite', marginBottom: 8 }} />
          <div>AI generating wireframe...</div>
        </div>
      )}
      {expanded && svg && (
        <div style={{ padding: '0 12px 12px' }}>
          <div style={{ borderRadius: 6, overflow: 'hidden', border: '0.5px solid #E0E0DE', background: '#F4F4F2' }}
            dangerouslySetInnerHTML={{ __html: svg }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => {
              const blob = new Blob([svg], { type: 'image/svg+xml' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `${spec.screen.replace(/\s+/g, '-')}.svg`; a.click();
            }} style={{ flex: 1, padding: '6px', fontSize: 11, background: '#F4F4F2', border: '0.5px solid #E0E0DE', borderRadius: 6, cursor: 'pointer', color: '#4A4A46' }}>
              ↓ Download SVG
            </button>
            <button onClick={generate} style={{ padding: '6px 10px', fontSize: 11, background: '#F4F4F2', border: '0.5px solid #E0E0DE', borderRadius: 6, cursor: 'pointer', color: '#4A4A46' }}>
              ↺ Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export default function CouncilPanel({ council, onApprove, onRequestChanges, onReject, status }: CouncilPanelProps) {
  const [view, setView] = useState<'progress' | 'review'>('progress');
  const [feedback, setFeedback] = useState('');
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [mockups, setMockups] = useState<MockupSpec[]>([]);

  useEffect(() => {
    if (council.gate_scorecard) {
      const parsed = parseMockupBlocks(council.gate_scorecard);
      if (parsed.length > 0) setMockups(parsed);
    }
  }, [council.gate_scorecard]);

  const done = council.agents.filter(a => !['RUNNING', 'PENDING'].includes(a.verdict));
  const running = council.agents.filter(a => a.verdict === 'RUNNING');
  const total = council.agents.length;
  const hasBlocks = council.agents.some(a => a.verdict === 'SOFT_BLOCK');
  const canApprove = council.approved && !council.running && status !== 'approved';

  const spin = {
    display: 'inline-block', width: 8, height: 8,
    border: '1.5px solid rgba(2,132,199,0.3)', borderTopColor: '#0284C7',
    borderRadius: '50%', animation: 'linup-spin 0.7s linear infinite', flexShrink: 0,
  } as React.CSSProperties;

  // Extract key findings from agent outputs for the review table
  const getKeyFindings = (agent: AgentResult): string[] => {
    const lines = agent.output.split('\n').filter(l => l.trim());
    // Find numbered items or bullet points
    const findings = lines.filter(l =>
      /^\d+\./.test(l.trim()) || l.trim().startsWith('- ') || l.trim().startsWith('* ')
    ).slice(0, 4);
    if (findings.length > 0) return findings.map(f => f.replace(/^[\d\.\-\*\s]+/, '').trim());
    // Fallback: first 3 non-empty sentences
    return lines.slice(0, 3).map(l => l.trim()).filter(l => l.length > 10);
  };

  return (
    <div style={{
      width: 380, borderLeft: '0.5px solid var(--color-border-tertiary)',
      display: 'flex', flexDirection: 'column', background: '#FAFAFA',
    }}>

      {/* Header with tab switcher */}
      <div style={{ padding: '12px 14px 0', borderBottom: '0.5px solid #E2E8F0', flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', marginBottom: 10 }}>
          AI Council
        </div>

        {/* Progress summary */}
        {council.running ? (
          <div style={{ fontSize: 11, color: '#0284C7', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
            <span style={spin} />
            {running.length > 0 ? (ACTIVITY_LABELS[running[0].agent_id] ?? 'Working...') : 'Starting...'}
          </div>
        ) : total > 0 ? (
          <div style={{ fontSize: 11, fontWeight: 600, color: council.approved ? 'var(--color-success)' : '#DC2626', marginBottom: 8 }}>
            {council.approved ? '✓ All checks passed' : '⚠ Issues found — review before approving'}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>Waiting to start</div>
        )}

        {/* Progress bar */}
        {total > 0 && (
          <div style={{ height: 3, background: '#E2E8F0', borderRadius: 2, marginBottom: 10 }}>
            <div style={{ height: '100%', borderRadius: 2, transition: 'width 0.4s', width: `${(done.length / total) * 100}%`, background: council.approved ? 'var(--color-success)' : council.running ? 'var(--color-advisory)' : '#DC2626' }} />
          </div>
        )}

        {/* Tab switcher — only show when council has run */}
        {total > 0 && !council.running && (
          <div style={{ display: 'flex', gap: 0, marginBottom: -1 }}>
            {['progress', 'review'].map(tab => (
              <button key={tab} onClick={() => setView(tab as 'progress' | 'review')}
                style={{ flex: 1, padding: '6px 0', border: 'none', borderBottom: view === tab ? '2px solid #6366F1' : '2px solid transparent', background: 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: view === tab ? 'var(--color-advisory)' : '#94A3B8' }}>
                {tab === 'progress' ? 'Status' : 'Review table'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* PROGRESS VIEW */}
        {view === 'progress' && (
          <div style={{ padding: '8px 10px' }}>
            {hasBlocks && !council.running && (
              <div style={{ padding: '8px 10px', background: '#FFFBEB', borderRadius: 6, fontSize: 11, color: '#92400E', marginBottom: 8 }}>
                ⚠ Some issues need attention. Switch to Review table to see details.
              </div>
            )}
            {council.agents.filter((a, i, arr) => arr.findIndex(x => x.agent_id === a.agent_id) === i).map(agent => {
              const isRunning = agent.verdict === 'RUNNING';
              const isDone = !['RUNNING', 'PENDING'].includes(agent.verdict);
              const color = VERDICT_COLOR[agent.verdict] ?? '#CBD5E1';
              const icon = VERDICT_ICON[agent.verdict] ?? '○';
              const label = isDone ? (DONE_LABELS[agent.agent_id] ?? agent.role) : (ACTIVITY_LABELS[agent.agent_id] ?? 'Working...');
              return (
                <div key={agent.agent_id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 6px', borderRadius: 6, background: isRunning ? 'rgba(2,132,199,0.06)' : 'transparent', opacity: agent.verdict === 'PENDING' ? 0.35 : 1 }}>
                  {isRunning ? <span style={spin} /> : <span style={{ color, fontSize: 10, fontWeight: 700, width: 10, flexShrink: 0 }}>{icon}</span>}
                  <span style={{ flex: 1, fontSize: 11, color: isRunning ? '#0284C7' : isDone ? '#334155' : '#94A3B8', lineHeight: 1.4 }}>{label}</span>
                  {isDone && agent.verdict !== 'PASS' && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: agent.verdict === 'SOFT_BLOCK' ? '#FEF3C7' : '#EEF2FF', color }}>
                      {agent.verdict === 'SOFT_BLOCK' ? 'REVIEW' : 'NOTE'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* REVIEW TABLE VIEW */}
        {view === 'review' && total > 0 && !council.running && (
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {council.agents.filter(a => a.verdict !== 'PENDING').map(agent => {
              const findings = getKeyFindings(agent);
              const isExpanded = expandedAgent === agent.agent_id;
              const color = VERDICT_COLOR[agent.verdict] ?? '#CBD5E1';
              return (
                <div key={agent.agent_id} style={{ border: `0.5px solid ${agent.verdict === 'SOFT_BLOCK' ? '#FDE68A' : '#E2E8F0'}`, borderRadius: 8, overflow: 'hidden', background: agent.verdict === 'SOFT_BLOCK' ? '#FFFBEB' : '#fff' }}>
                  {/* Agent header */}
                  <button onClick={() => setExpandedAgent(isExpanded ? null : agent.agent_id)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color }}>{VERDICT_ICON[agent.verdict]}</span>
                    <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: '#1E293B' }}>{DONE_LABELS[agent.agent_id] ?? agent.role}</span>
                    <span style={{ fontSize: 10, color: '#94A3B8' }}>{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {/* Key findings summary — always visible */}
                  {findings.length > 0 && (
                    <div style={{ padding: '0 10px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {findings.map((f, i) => (
                        <div key={i} style={{ display: 'flex', gap: 5, alignItems: 'flex-start', fontSize: 10, color: '#475569', lineHeight: 1.5 }}>
                          <span style={{ color: '#94A3B8', flexShrink: 0, marginTop: 1 }}>·</span>
                          <span>{f.length > 80 ? f.substring(0, 80) + '...' : f}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Full output when expanded */}
                  {isExpanded && (
                    <div style={{ padding: '8px 10px', borderTop: '0.5px solid #E2E8F0', background: '#F8FAFC', fontSize: 10, color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.6, maxHeight: 200, overflowY: 'auto' }}>
                      {agent.output}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Mockups section */}
            {mockups.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#4A4A46', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Screen Wireframes ({mockups.length})
                </div>
                {mockups.map((m, i) => <MockupCard key={i} spec={m} />)}
              </div>
            )}

            {/* Feedback input */}
            <div style={{ paddingTop: 4 }}>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 6, fontWeight: 500 }}>
                Your response to the council:
              </div>
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder="Address any issues raised, clarify requirements, or ask for a specific revision..."
                rows={4}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 11, resize: 'vertical', fontFamily: 'system-ui', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }}
              />
              <button
                onClick={() => { if (feedback.trim()) { onRequestChanges(feedback); setFeedback(''); } }}
                disabled={!feedback.trim()}
                style={{ width: '100%', marginTop: 6, padding: '8px', background: feedback.trim() ? 'var(--color-advisory)' : '#E4E4E0', color: feedback.trim() ? '#fff' : '#9B9B94', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: feedback.trim() ? 'pointer' : 'not-allowed' }}>
                Submit feedback for revision
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {total > 0 && !council.running && (
        <div style={{ padding: '10px 12px', borderTop: '0.5px solid #E2E8F0', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={onApprove} disabled={!canApprove}
            style={{ padding: '9px', fontWeight: 700, fontSize: 12, border: 'none', borderRadius: 8, cursor: canApprove ? 'pointer' : 'not-allowed', background: canApprove ? 'var(--color-success)' : '#E4E4E0', color: canApprove ? '#fff' : '#9B9B94' }}>
            {status === 'approved' ? '✓ Approved' : '✓ Approve and continue'}
          </button>
          <button onClick={onReject}
            style={{ padding: '7px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            Reject and restart
          </button>
        </div>
      )}
    </div>
  );
}