interface AgentCardProps {
  agentId: string;
  role: string;
  tier: number;
  provider: string;
  model: string;
  verdict: string;
  output: string;
  onExpand: (agentId: string) => void;
  expanded: boolean;
}

const VERDICT_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  PASS:       { bg: '#F0FDF4', color: '#16A34A', label: 'PASS' },
  SOFT_BLOCK: { bg: '#FEF3C7', color: '#D97706', label: 'SOFT BLOCK' },
  ADVISORY:   { bg: '#EEF2FF', color: 'var(--color-brand)', label: 'ADVISORY' },
  RUNNING:    { bg: '#F0F9FF', color: '#0284C7', label: 'RUNNING' },
  PENDING:    { bg: '#F8FAFC', color: '#94A3B8', label: 'PENDING' },
  FAILED:     { bg: '#FEF2F2', color: '#DC2626', label: 'FAILED' },
};

const PROVIDER_ICON: Record<string, string> = {
  anthropic: '🟣',
  openai: '🟢',
  google: '🔵',
};

const TIER_LABEL: Record<number, string> = {
  1: 'Core',
  2: 'Specialist',
  3: 'Innovation',
  4: 'Stage Expert',
};

export default function AgentCard({ agentId, role, tier, provider, model, verdict, output, onExpand, expanded }: AgentCardProps) {
  const style = VERDICT_STYLE[verdict] ?? VERDICT_STYLE.PENDING;
  const isRunning = verdict === 'RUNNING';

  const spinStyle = {
    display: 'inline-block', width: 10, height: 10,
    border: '2px solid rgba(2,132,199,0.3)', borderTopColor: '#0284C7',
    borderRadius: '50%', animation: 'linup-spin 0.7s linear infinite',
    marginRight: 4,
  } as React.CSSProperties;

  return (
    <div style={{ marginBottom: 4 }}>
      <button
        onClick={() => output && onExpand(agentId)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 10px', border: 'none', background: 'transparent',
          cursor: output ? 'pointer' : 'default', textAlign: 'left',
          borderRadius: 6,
          ...(expanded ? { background: '#F1F5F9' } : {}),
        }}
      >
        <span style={{ fontSize: 12, flexShrink: 0 }}>{PROVIDER_ICON[provider] ?? '⚪'}</span>
        <span style={{ flex: 1, fontSize: 12, color: '#1E293B', fontWeight: 500, lineHeight: 1.3 }}>
          {role}
        </span>
        {isRunning ? (
          <span style={spinStyle} />
        ) : (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
            background: style.bg, color: style.color, flexShrink: 0,
          }}>
            {style.label}
          </span>
        )}
      </button>

      {expanded && output && (
        <div style={{
          margin: '0 8px 8px', padding: '10px 12px',
          background: '#F8FAFC', borderRadius: 6,
          border: '0.5px solid #E2E8F0',
          fontSize: 12, color: '#334155', lineHeight: 1.7,
          whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto',
        }}>
          <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 6, fontWeight: 600 }}>
            {TIER_LABEL[tier]} · {provider} · {model}
          </div>
          {output}
        </div>
      )}
    </div>
  );
}