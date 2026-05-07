import { useEffect, useState } from 'react';

interface SpecAgent {
  id: string;
  role: string;
  done: boolean;
}

interface SpecBuildingPanelProps {
  agents: SpecAgent[];
  allAgentRoles?: string[];
}

const AGENT_DESCRIPTIONS: Record<string, string> = {
  'Specification Program Lead': 'Coordinating the full team and ensuring all sections connect cohesively',
  'Product Manager': 'Defining the product vision, goals, and success metrics',
  'User Researcher': 'Mapping user personas, journeys, and key pain points',
  'Business Analyst': 'Documenting business rules, workflows, and process requirements',
  'UX Designer': 'Designing screen flows, layouts, and interaction patterns',
  'Copywriter': 'Writing product voice, tone, error messages, and microcopy',
  'Technical Architect': 'Defining the technical stack, architecture, and system design',
  'Security Engineer': 'Specifying security requirements, authentication, and data protection',
  'Database Architect': 'Designing the data model, schema, and storage strategy',
  'API Designer': 'Defining API contracts, endpoints, and integration patterns',
  'DevOps Engineer': 'Planning deployment, CI/CD pipeline, and infrastructure',
  'Performance Engineer': 'Setting performance budgets, caching, and optimisation targets',
  'QA Lead': 'Defining test strategy, acceptance criteria, and quality gates',
  'Accessibility Specialist': 'Ensuring WCAG compliance and inclusive design requirements',
  'Analytics Engineer': 'Specifying tracking events, dashboards, and reporting needs',
  'Compliance Officer': 'Reviewing regulatory requirements and legal obligations',
  'Financial Analyst': 'Assessing revenue model viability and cost projections',
  'Mobile Specialist': 'Defining mobile-specific requirements and platform constraints',
  'Integration Specialist': 'Mapping third-party integrations and external dependencies',
  'Domain Expert': 'Classifying domain type and activating specialist knowledge',
  'Lead Engineer': 'Reviewing all sections and resolving technical questions',
  'Editor-in-Chief': 'Final review — ensuring clarity, consistency, and completeness',
};

function getDescription(role: string): string {
  if (AGENT_DESCRIPTIONS[role]) return AGENT_DESCRIPTIONS[role];
  const lower = role.toLowerCase();
  if (lower.includes('lead')) return 'Leading and coordinating this section of the specification';
  if (lower.includes('security')) return 'Specifying security and data protection requirements';
  if (lower.includes('database') || lower.includes('data')) return 'Designing the data model and storage architecture';
  if (lower.includes('api')) return 'Defining API contracts and integration patterns';
  if (lower.includes('test') || lower.includes('qa')) return 'Defining test strategy and acceptance criteria';
  if (lower.includes('deploy') || lower.includes('devops')) return 'Planning deployment and infrastructure requirements';
  if (lower.includes('ux') || lower.includes('design')) return 'Designing screens, flows, and user interactions';
  if (lower.includes('product')) return 'Defining product goals, features, and success metrics';
  if (lower.includes('editor')) return 'Performing final review and ensuring document consistency';
  return 'Writing and reviewing this section of your specification';
}

// All known agent roles in order — shown as "waiting" until they appear
const ALL_ROLES = Object.keys(AGENT_DESCRIPTIONS);

export default function SpecBuildingPanel({ agents }: SpecBuildingPanelProps) {
  const done = agents.filter(a => a.done).length;
  const pct = agents.length > 0 ? Math.round((done / Math.max(agents.length, 1)) * 100) : 0;
  const [elapsed, setElapsed] = useState(0);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startTime]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  // Merge known roles with live agents
  const agentMap = new Map(agents.map(a => [a.role, a]));
  const displayAgents = ALL_ROLES.map(role => agentMap.get(role) ?? { id: role, role, done: false, waiting: true });
  // Add any agents not in our known list
  agents.forEach(a => { if (!ALL_ROLES.includes(a.role)) displayAgents.push({ ...a, waiting: false }); });

  return (
    <>
      <style>{`
        @keyframes linup-spin { to { transform: rotate(360deg); } }
        @keyframes linup-pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes linup-glow { 0%,100% { box-shadow: 0 0 8px #C400FF44; } 50% { box-shadow: 0 0 20px #C400FF88; } }
      `}</style>

      {/* Modal overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}>
        <div style={{
          width: '75vw', height: '80vh',
          background: 'linear-gradient(160deg, #0F0F14 0%, #1A0030 60%, #0F0F14 100%)',
          borderRadius: 16,
          border: '0.5px solid #8C00B455',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.8), 0 0 0 0.5px #8C00B433',
          animation: 'linup-glow 3s ease-in-out infinite',
        }}>

          {/* Header */}
          <div style={{ padding: '20px 24px 14px', borderBottom: '0.5px solid #8C00B433', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.02em' }}>Engineering Department</div>
                <div style={{ fontSize: 11, color: '#A855F7', marginTop: 2 }}>Creating Full App Specification · {done} of {agents.length || ALL_ROLES.length} agents active</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#C084FC', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{pct}%</div>
                <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{timeStr} elapsed</div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ height: 4, background: '#1E1E2A', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: 'linear-gradient(90deg, #8C00B4, #C400FF, #8C00B4)',
                backgroundSize: '200% 100%',
                width: `${Math.max(pct, 2)}%`,
                transition: 'width 0.6s ease',
                boxShadow: '0 0 10px #C400FF66',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <div style={{ fontSize: 10, color: '#4A5568' }}>35+ sections · v0.1.0 Draft</div>
              <div style={{ fontSize: 10, color: pct === 100 ? '#4ADE80' : '#A855F7', fontWeight: 600, animation: pct < 100 ? 'linup-pulse 2s ease-in-out infinite' : 'none' }}>
                {pct === 100 ? '✓ Complete — preparing document' : '● Writing specification...'}
              </div>
            </div>
          </div>

          {/* Agent list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {displayAgents.map((agent: any) => {
                const isActive = agentMap.has(agent.role) && !agent.done;
                const isDone = agent.done;
                const isWaiting = !agentMap.has(agent.role);
                return (
                  <div key={agent.id} style={{
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: `0.5px solid ${isDone ? '#22C55E33' : isActive ? '#8C00B466' : '#ffffff0a'}`,
                    background: isDone ? '#052e1615' : isActive ? '#8C00B415' : '#ffffff04',
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    transition: 'all 0.4s ease',
                    opacity: isWaiting ? 0.4 : 1,
                  }}>
                    {/* Status dot */}
                    <div style={{ marginTop: 2, flexShrink: 0 }}>
                      {isDone ? (
                        <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff' }}>✓</div>
                      ) : isActive ? (
                        <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #A855F7', borderTopColor: 'transparent', animation: 'linup-spin 0.8s linear infinite' }} />
                      ) : (
                        <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid #ffffff22' }} />
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: isDone ? '#4ADE80' : isActive ? '#C084FC' : '#4A5568', marginBottom: 2 }}>
                        {agent.role}
                      </div>
                      <div style={{ fontSize: 10, color: isDone ? '#86EFAC99' : isActive ? '#A855F799' : '#4A556888', lineHeight: 1.4 }}>
                        {isDone ? 'Section complete' : isActive ? getDescription(agent.role) : 'Waiting for brief...'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}