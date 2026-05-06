import { useState, useEffect } from 'react';
import { parseMockupBlocks, generateMockupSVG } from '../lib/mockupGenerator';
import type { MockupSpec } from '../lib/mockupGenerator';
import Questionnaire from './Questionnaire';

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
  questions?: Array<{ id: string; text: string }>;
  onQuestionnaireSubmit?: (answers: Record<string, string>) => void;
  activeTab?: 'progress' | 'review';
  onTabChange?: (tab: 'progress' | 'review') => void;
}

const ACTIVITY_LABELS: Record<string, string> = {
  clarifier:          'Understanding your requirements',
  spec_writer:        'Writing your product specification',
  devils_advocate:    'Checking for gaps and issues',
  realist:            'Reviewing scope and feasibility',
  security:           'Running security review',
  accessibility:      'Checking accessibility',
  gdpr:               'Reviewing privacy compliance',
  innovator:          'Exploring better approaches',
  business_analyst:   'Validating the business case',
  market_researcher:  'Researching the market and competitors',
  ethics_officer:     'Reviewing ethical considerations',
  financial_advisor:  'Assessing financial viability',
  debugging_engineer: 'Checking for technical risks',
  quality_gate:       'Running final quality checks',
};

const DONE_LABELS: Record<string, string> = {
  clarifier:          'Requirements understood',
  spec_writer:        'Specification written',
  devils_advocate:    'Gap analysis complete',
  realist:            'Scope review complete',
  security:           'Security review complete',
  accessibility:      'Accessibility checked',
  gdpr:               'Privacy review complete',
  innovator:          'Alternatives explored',
  business_analyst:   'Business case validated',
  market_researcher:  'Market research complete',
  ethics_officer:     'Ethics review complete',
  financial_advisor:  'Financial assessment complete',
  debugging_engineer: 'Technical risk review complete',
  quality_gate:       'Quality checks complete',
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
      <button
        onClick={() => expanded ? setExpanded(false) : (svg ? setExpanded(true) : generate())}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A18' }}>{spec.screen}</div>
          <div style={{ fontSize: 10, color: '#8A8A82', marginTop: 2 }}>{spec.type} · {spec.sections.length} sections</div>
        </div>
        <span style={{ fontSize: 11, color: '#8C00B4', fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>
          {loading ? 'Generating...' : expanded ? 'Hide ▲' : svg ? 'Show ▼' : '✦ Generate'}
        </span>
      </button>
      {loading && (
        <div style={{ padding: '16px', textAlign: 'center', color: '#8A8A82', fontSize: 12 }}>
          AI generating wireframe...
        </div>
      )}
      {expanded && svg && (
        <div style={{ padding: '0 12px 12px' }}>
          <div
            style={{ borderRadius: 6, overflow: 'hidden', border: '0.5px solid #E0E0DE', background: '#F4F4F2' }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <button
            onClick={() => {
              const blob = new Blob([svg], { type: 'image/svg+xml' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${spec.screen.replace(/\s+/g, '-')}.svg`;
              a.click();
            }}
            style={{ marginTop: 8, width: '100%', padding: '6px', fontSize: 11, background: '#F4F4F2', border: '0.5px solid #E0E0DE', borderRadius: 6, cursor: 'pointer', color: '#4A4A46' }}
          >
            ↓ Download SVG
          </button>
        </div>
      )}
    </div>
  );
}

export default function CouncilPanel({
  council,
  onApprove,
  onRequestChanges,
  onReject,
  
  questions = [],
  onQuestionnaireSubmit,
  activeTab,
  onTabChange,
}: CouncilPanelProps) {
  const [tabInternal, setTabInternal] = useState<'progress' | 'review'>(questions.length > 0 ? 'review' : 'progress');
  const tab = activeTab ?? tabInternal;
  const setTab = (t: 'progress' | 'review') => { setTabInternal(t); onTabChange?.(t); };
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
  const running = council.agents.find(a => a.verdict === 'RUNNING');
  const allDone = done.length === council.agents.length && council.agents.length > 0;
  const canApprove = allDone && council.approved;

  const hasIssues = council.agents.some(a =>
    a.findings?.some(f => ['CRITICAL', 'HIGH', 'MEDIUM'].includes(f.severity))
  );

  const panelW = 480;

  return (
    <div style={{ width: panelW, borderLeft: '0.5px solid var(--color-border-tertiary)', display: 'flex', flexDirection: 'column', flexShrink: 0, background: '#FAFAFA', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 0', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A18', marginBottom: 2 }}>AI Council</div>
        {allDone && (
          <div style={{ fontSize: 11, color: hasIssues ? 'var(--color-warning)' : 'var(--color-success)', fontWeight: 600 }}>
            {hasIssues ? '⚠ Some issues need attention. Switch to Review table to see details.' : '✓ All checks passed'}
          </div>
        )}
        {running && (
          <div style={{ fontSize: 11, color: '#0284C7' }}>
            ◉ {ACTIVITY_LABELS[running.agent_id] ?? 'Running...'}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid var(--color-border-tertiary)', padding: '8px 16px 0', flexShrink: 0 }}>
        {(['progress', 'review'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '6px 12px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 12, fontWeight: tab === t ? 700 : 400,
              color: tab === t ? 'var(--color-brand)' : 'var(--color-text-tertiary)',
              borderBottom: tab === t ? '2px solid var(--color-brand)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t === 'progress' ? 'Status' : 'Review table'}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>

        {/* PROGRESS VIEW */}
        {tab === 'progress' && (
          <div>
            {council.agents
              .filter((a, i, arr) => arr.findIndex(x => x.agent_id === a.agent_id) === i)
              .map(agent => {
                const isDone = !['RUNNING', 'PENDING'].includes(agent.verdict);
                const isRunning = agent.verdict === 'RUNNING';
                const label = isDone
                  ? (DONE_LABELS[agent.agent_id] ?? agent.role)
                  : (isRunning ? (ACTIVITY_LABELS[agent.agent_id] ?? agent.role) : agent.role);
                const color = VERDICT_COLOR[agent.verdict] ?? '#CBD5E1';
                const icon = VERDICT_ICON[agent.verdict] ?? '○';

                return (
                  <div
                    key={agent.agent_id}
                    style={{
                      padding: '7px 6px',
                      borderRadius: 6,
                      background: isRunning ? 'rgba(2,132,199,0.06)' : 'transparent',
                      opacity: agent.verdict === 'PENDING' ? 0.35 : 1,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      marginBottom: 2,
                    }}
                  >
                    <span style={{ color, fontSize: 12, flexShrink: 0, marginTop: 1, fontWeight: 700 }}>{icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: isDone ? '#1A1A18' : '#4A4A46', fontWeight: isDone ? 500 : 400, lineHeight: 1.4 }}>
                        {label}
                      </div>
                      {isDone && agent.findings && agent.findings.length > 0 && (
                        <div style={{ marginTop: 3 }}>
                          {agent.findings.slice(0, 2).map((f, fi) => (
                            <div key={fi} style={{ fontSize: 10, color: '#8A8A82', lineHeight: 1.4 }}>
                              {f.description.substring(0, 80)}{f.description.length > 80 ? '...' : ''}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {isDone && agent.verdict !== 'PASS' && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4,
                        background: VERDICT_COLOR[agent.verdict] + '22',
                        color: VERDICT_COLOR[agent.verdict],
                        flexShrink: 0,
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.04em',
                      }}>
                        {agent.verdict === 'SOFT_BLOCK' ? 'REVIEW' : agent.verdict}
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {/* REVIEW TABLE VIEW */}
        {tab === 'review' && (
          <div>
            {/* Questionnaire — shown when council has questions for the user */}
            {questions.length > 0 && onQuestionnaireSubmit && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-brand)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 8 }}>
                  Council questions for you
                </div>
                <Questionnaire
                  questions={questions}
                  passNumber={1}
                  onSubmit={onQuestionnaireSubmit}
                  onSkip={() => {}}
                />
              </div>
            )}

            {/* Agent findings */}
            {council.agents
              .filter((a, i, arr) => arr.findIndex(x => x.agent_id === a.agent_id) === i)
              .filter(a => a.findings && a.findings.length > 0)
              .map(agent => (
                <div key={agent.agent_id} style={{ marginBottom: 10 }}>
                  <button
                    onClick={() => setExpandedAgent(expandedAgent === agent.agent_id ? null : agent.agent_id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 10px', border: '0.5px solid #E0E0DE', borderRadius: 8,
                      background: '#fff', cursor: 'pointer', textAlign: 'left' as const,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A18' }}>
                        {DONE_LABELS[agent.agent_id] ?? agent.role}
                      </div>
                      <div style={{ fontSize: 10, color: '#8A8A82', marginTop: 2 }}>
                        {agent.findings.length} finding{agent.findings.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: 12, color: VERDICT_COLOR[agent.verdict] ?? '#8A8A82', fontWeight: 700 }}>
                      {expandedAgent === agent.agent_id ? '▲' : '▼'}
                    </span>
                  </button>
                  {expandedAgent === agent.agent_id && (
                    <div style={{ padding: '8px 10px', background: '#F9F9F8', border: '0.5px solid #E0E0DE', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                      {agent.findings.map((f, fi) => (
                        <div key={fi} style={{ marginBottom: 6, fontSize: 12, color: '#1A1A18', lineHeight: 1.6 }}>
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                            background: f.severity === 'CRITICAL' ? '#FEF2F2' : f.severity === 'HIGH' ? '#FFF7ED' : '#FFFBEB',
                            color: f.severity === 'CRITICAL' ? '#DC2626' : f.severity === 'HIGH' ? '#EA580C' : '#B45309',
                            marginRight: 6,
                            textTransform: 'uppercase' as const,
                          }}>
                            {f.severity}
                          </span>
                          {f.description}
                        </div>
                      ))}
                      {agent.output && (
                        <div style={{ marginTop: 8, fontSize: 11, color: '#4A4A46', lineHeight: 1.6, borderTop: '0.5px solid #E0E0DE', paddingTop: 8 }}>
                          {agent.output.substring(0, 300)}{agent.output.length > 300 ? '...' : ''}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

            {/* Mockups */}
            {mockups.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#4A4A46', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                  Screen Wireframes ({mockups.length})
                </div>
                {mockups.map((m, i) => <MockupCard key={i} spec={m} />)}
              </div>
            )}

            {/* Feedback input */}
            {allDone && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#4A4A46', marginBottom: 6 }}>Send feedback to re-run council</div>
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="Describe what to reconsider or add more detail about..."
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #E0E0DE', borderRadius: 8, fontSize: 12, resize: 'vertical' as const, minHeight: 72, fontFamily: 'var(--font-sans)', boxSizing: 'border-box' as const, outline: 'none' }}
                />
                <button
                  onClick={() => { onRequestChanges(feedback); setFeedback(''); }}
                  disabled={!feedback.trim()}
                  style={{ marginTop: 6, width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #E0E0DE', background: '#fff', fontSize: 12, cursor: feedback.trim() ? 'pointer' : 'default', color: feedback.trim() ? '#1A1A18' : '#BEBEB8' }}
                >
                  ↺ Re-run with feedback
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer — Approve / Reject */}
      {allDone && (
        <div style={{ padding: '12px 14px', borderTop: '0.5px solid var(--color-border-tertiary)', flexShrink: 0, background: '#FAFAFA' }}>
          <button
            onClick={onApprove}
            disabled={!canApprove}
            style={{
              width: '100%', padding: '11px', borderRadius: 8, border: 'none',
              background: canApprove ? 'var(--color-success)' : '#E0E0DE',
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: canApprove ? 'pointer' : 'default',
              marginBottom: 6,
            }}
          >
            ✓ Approve and continue
          </button>
          <button
            onClick={onReject}
            style={{ width: '100%', padding: '8px', borderRadius: 8, border: 'none', background: 'transparent', fontSize: 12, cursor: 'pointer', color: 'var(--color-error)' }}
          >
            Reject and restart
          </button>
        </div>
      )}
    </div>
  );
}
