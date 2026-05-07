import { useEffect, useState } from 'react';

interface SpecAgent {
  id: string;
  role: string;
  done: boolean;
}

interface SpecBuildingPanelProps {
  agents: SpecAgent[];
  onComplete?: () => void;
}

const AGENT_ICONS: Record<string, string> = {
  'domain': '🌐', 'metadata': '📋', 'requirements': '📝', 'user_stories': '👤',
  'journey': '🗺️', 'screen': '🖥️', 'voice': '🎙️', 'error': '⚠️',
  'notification': '🔔', 'microcopy': '✍️', 'technical': '⚙️', 'architecture': '🏗️',
  'auth': '🔐', 'api': '🔌', 'database': '🗄️', 'security': '🛡️',
  'performance': '⚡', 'testing': '🧪', 'deployment': '🚀', 'analytics': '📊',
  'accessibility': '♿', 'lead': '👑', 'editor': '📖', 'milestone': '🏁',
};

function getIcon(role: string): string {
  const lower = role.toLowerCase();
  for (const [key, icon] of Object.entries(AGENT_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return '🤖';
}

function AgentCard({ agent, index }: { agent: SpecAgent; index: number }) {
  const [elapsed, setElapsed] = useState(0);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    if (agent.done) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(t);
  }, [agent.done, startTime]);

  const icon = getIcon(agent.role);
  const isDone = agent.done;

  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: 10,
      border: `1px solid ${isDone ? '#22C55E33' : '#8C00B422'}`,
      background: isDone ? 'linear-gradient(135deg, #052e1611 0%, #14532d11 100%)' : 'linear-gradient(135deg, #3D006B11 0%, #8C00B411 100%)',
      display: 'flex', alignItems: 'center', gap: 10,
      transition: 'all 0.4s ease',
      animationDelay: `${index * 0.05}s`,
      opacity: 1,
    }}>
      {/* Icon */}
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: isDone ? '#22C55E22' : '#8C00B422',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16,
      }}>{icon}</div>

      {/* Role */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: isDone ? '#4ADE80' : '#C084FC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {agent.role}
        </div>
        <div style={{ fontSize: 10, color: isDone ? '#86EFAC' : '#A855F7', marginTop: 1 }}>
          {isDone ? 'Section complete' : `Working... ${elapsed}s`}
        </div>
      </div>

      {/* Status */}
      <div style={{ flexShrink: 0 }}>
        {isDone ? (
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 700 }}>✓</div>
        ) : (
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            border: '2px solid #8C00B4',
            borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite',
          }} />
        )}
      </div>
    </div>
  );
}

export default function SpecBuildingPanel({ agents }: SpecBuildingPanelProps) {
  const done = agents.filter(a => a.done).length;
  const total = agents.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const [elapsed, setElapsed] = useState(0);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startTime]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: 'linear-gradient(135deg, #0C0C0E 0%, #1A0030 50%, #0C0C0E 100%)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      `}</style>

      {/* Header */}
      <div style={{ padding: '24px 28px 16px', borderBottom: '0.5px solid #8C00B433', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #8C00B4, #C400FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, animation: 'float 3s ease-in-out infinite' }}>⚙️</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.02em' }}>22-Member Engineering Team</div>
            <div style={{ fontSize: 12, color: '#A855F7', marginTop: 1 }}>Building your Standard Specification Document</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#C084FC', fontVariantNumeric: 'tabular-nums' }}>{pct}%</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>{timeStr} elapsed</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 6, background: '#1E1E22', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3,
            background: 'linear-gradient(90deg, #8C00B4, #C400FF)',
            width: `${pct}%`,
            transition: 'width 0.5s ease',
            boxShadow: '0 0 12px #C400FF88',
          }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <div style={{ fontSize: 11, color: '#6B7280' }}>{done} of {total} agents complete</div>
          <div style={{ fontSize: 11, color: pct === 100 ? '#4ADE80' : '#A855F7', fontWeight: 600, animation: pct < 100 ? 'pulse 2s ease-in-out infinite' : 'none' }}>
            {pct === 100 ? '✓ Complete — preparing document' : '● Writing specification...'}
          </div>
        </div>
      </div>

      {/* Agent grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {total === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid #8C00B4', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: 13, color: '#A855F7' }}>Assembling engineering team...</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {agents.map((agent, i) => (
              <AgentCard key={agent.id} agent={agent} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div style={{ padding: '12px 20px', borderTop: '0.5px solid #8C00B433', display: 'flex', gap: 16, flexShrink: 0 }}>
        {[
          { label: 'Sections', value: '35+' },
          { label: 'Domains', value: 'Auto-detected' },
          { label: 'Version', value: 'v0.1.0 Draft' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, textAlign: 'center', padding: '8px', background: '#ffffff08', borderRadius: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#C084FC' }}>{s.value}</div>
            <div style={{ fontSize: 10, color: '#4A5568', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}