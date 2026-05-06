import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import CouncilPanel from '../components/CouncilPanel';
import { GROQ_API_KEY, OPENROUTER_KEY, GROQ_BASE_URL, MODELS } from '../lib/config';
import type { CouncilState, AgentResult } from '../components/CouncilPanel';

const SYSTEM_PROMPT = `You are LINUP, an expert product manager. The user has already provided their app name and description. Your job is to deepen that context through conversation — do NOT ask them to re-explain what they already told you in the brief.

PHASE 1 — Requirements (2-3 exchanges max): Ask targeted follow-up questions based on what is still unclear. Cover: who the end users are and their technical level, the core workflow step by step, and any constraints (integrations, compliance, scale). Never ask generic questions like "what is your app" or "who are your users" if the brief already says. Adapt your questions to the app type — a B2C consumer app needs different questions than a developer tool or internal dashboard.

PHASE 2 — Brand (one message, after requirements are clear): Ask these four questions together:
1. Do you have a primary brand colour? Hex code, describe it (e.g. deep navy), or say not yet.
2. Do you have an existing logo or wordmark? Yes or no.
3. How should the app feel? Professional and corporate / Friendly and approachable / Bold and modern / Calm and trustworthy.
4. Font preference: Clean and minimal / Elegant serif / Technical / No preference.

After brand questions are answered, confirm you have what you need and ask them to click Deploy AI Council.`;





















const STAGES = [
  { index: 0,  name: 'Product Spec',  description: 'AI council reviews your brief and produces product direction' },
  { index: 1,  name: 'Architecture',  description: 'System design, tech stack, and component structure' },
  { index: 2,  name: 'Database',      description: 'Schema design, migrations, and data model' },
  { index: 3,  name: 'Backend',       description: 'API design, business logic, and server code' },
  { index: 4,  name: 'Frontend',      description: 'UI components, pages, and user flows' },
  { index: 5,  name: 'Tests',         description: 'Unit, integration, and end-to-end tests' },
  { index: 6,  name: 'CI/CD',         description: 'Build pipeline and deployment configuration' },
  { index: 7,  name: 'Security',      description: 'Auth, permissions, and security review' },
  { index: 8,  name: 'Performance',   description: 'Optimisation and load testing' },
  { index: 9,  name: 'Deployment',    description: 'Production deployment and go-live' },
  { index: 10, name: 'Handover',      description: 'Documentation, export, and handover pack' },
];

interface Message { role: 'user' | 'assistant'; content: string; }
interface StageStatus { stage_index: number; status: string; artifact: { content: string } | null; }
function makeEmptyCouncil(): CouncilState {
  return { agents: [], gate_verdict: '', gate_scorecard: '', approved: false, running: false };
}

export default function StageWorkspaceScreen() {
  const { projectId, stageIndex: stageParam } = useParams<{ projectId: string; stageIndex: string }>();
  const pid = projectId ?? '';
  const [currentStage, setCurrentStage] = useState(parseInt(stageParam ?? '0'));
  const [stageStatus, setStageStatus] = useState<StageStatus | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [chatRunning, setChatRunning] = useState(false);
  const [councilRunning, setCouncilRunning] = useState(false);
  const [council, setCouncil] = useState<CouncilState>(makeEmptyCouncil());
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const loadStage = async (stage: number) => {
    try {
      const s = await invoke<StageStatus>('get_stage_status', { projectId: pid, stageIndex: stage });
      setStageStatus(s);
      if (s.status === 'pending' && stage === 0 && messages.length === 0) startChat();
      const result = await invoke<{ agents: AgentResult[]; gate_verdict: string; gate_scorecard: string; approved: boolean; } | null>('get_council_result', { projectId: pid, stageIndex: stage });
      if (result) setCouncil({ ...result, running: false });
    } catch (e) { setError(String(e)); }
  };

  useEffect(() => {
    loadStage(currentStage);
    const u1 = listen<{ project_id: string; stage_index: number; agent_id: string; role: string }>('agent-started', ev => {
      if (ev.payload.project_id !== pid || ev.payload.stage_index !== currentStage) return;
      setCouncil(prev => {
        if (prev.agents.find(a => a.agent_id === ev.payload.agent_id)) return prev;
        return { ...prev, running: true, agents: [...prev.agents, { agent_id: ev.payload.agent_id, role: ev.payload.role, tier: 1, provider: 'anthropic', model: '', verdict: 'RUNNING', output: '', findings: [] }] };
      });
    });
    const u2 = listen<{ project_id: string; stage_index: number; agent_id: string; role: string; verdict: string; output: string; }>('agent-completed', ev => {
      if (ev.payload.project_id !== pid || ev.payload.stage_index !== currentStage) return;
      setCouncil(prev => ({ ...prev, agents: prev.agents.map(a => a.agent_id === ev.payload.agent_id ? { ...a, verdict: ev.payload.verdict, output: ev.payload.output } : a) }));
    });
    const u3 = listen<{ project_id: string; stage_index: number; scorecard: string; verdict: string; approved: boolean; }>('stage-gate', ev => {
      if (ev.payload.project_id !== pid || ev.payload.stage_index !== currentStage) return;
      setCouncil(prev => ({ ...prev, running: false, gate_verdict: ev.payload.verdict, gate_scorecard: ev.payload.scorecard, approved: ev.payload.approved }));
      setCouncilRunning(false);
    });
    return () => { u1.then(f => f()); u2.then(f => f()); u3.then(f => f()); };
  }, [currentStage, pid]);

  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [messages, chatRunning]);

  const getKeys = async () => {
    const key = OPENROUTER_KEY || GROQ_API_KEY || apiKey;
    if (!key) {
      setError('Configuration error: service unavailable. Please reinstall LINUP.');
      return null;
    }
    return key;
  };

  const callAI = async (msgs: Message[], key: string): Promise<string> => {
    const r = await fetch(GROQ_BASE_URL + '/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'content-type': 'application/json', 'HTTP-Referer': 'https://linup.io', 'X-Title': 'LINUP' },
      body: JSON.stringify({ model: MODELS.FAST, max_tokens: 1024, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...msgs.map(m => ({ role: m.role, content: m.content }))] }),
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    return d.choices?.[0]?.message?.content ?? '';
  };

  const startChat = async () => {
    const key = await getKeys(); if (!key) return; setChatRunning(true); try { // Load project details from DB to seed the conversation
let projectContext = 'I want to build an app.';
try {
  const proj = await invoke<{ name: string; description: string }>('get_project', { projectId: pid });
  if (proj?.name || proj?.description) {
    projectContext = `I want to build: "${proj.name || 'an app'}". Here is my brief: ${proj.description || 'No description provided yet.'}. Please ask me follow-up questions based on this brief — do not ask me to re-explain what is already in the brief.`;
  }
} catch { /* use default */ }
const reply = await callAI([{ role: 'user', content: projectContext }], key);
      setMessages([{ role: 'assistant', content: reply }]);
    } catch (e) { setError(String(e)); }
    setChatRunning(false);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || chatRunning || councilRunning) return;
    const key = await getKeys();
    if (!key) return;
    const updated = [...messages, { role: 'user' as const, content: text }];
    setMessages(updated); setInput(''); setChatRunning(true); setError(null);
    try {
      const reply = await callAI(updated, key);
      setMessages([...updated, { role: 'assistant', content: reply }]);
    } catch (e) { setError(String(e)); }
    setChatRunning(false);
  };

  const runCouncil = async () => {
    const key = await getKeys(); if (!key) return; setCouncilRunning(true);
    setCouncil({ agents: [], gate_verdict: '', gate_scorecard: '', approved: false, running: true });
    setError(null);
    const brief = messages.map(m => (m.role === 'user' ? 'User: ' : 'LINUP: ') + m.content).join('\n\n'); try {
      const result = await invoke<{ agents: AgentResult[]; gate_verdict: string; gate_scorecard: string; approved: boolean; }>('run_council', {
        projectId: pid, stageIndex: currentStage, userBrief: brief,
        apiKeys: { groq: key },
      });
      setCouncil({ ...result, running: false });
      await loadStage(currentStage);
    } catch (e) { setError(String(e)); setCouncil(prev => ({ ...prev, running: false })); }
    setCouncilRunning(false);
  };

  const handleApprove = async () => {
    try {
      await invoke('approve_stage', { projectId: pid, stageIndex: currentStage });

      // After Stage 0 approval: trigger the Specification Engineering Team
      if (currentStage === 0) {
        const key = await getKeys();
        if (!key) return;

        // Get the product direction from the council results
        const productDirection = council.agents
          .map(a => `## ${a.role}\n${a.output}`)
          .join('\n\n---\n\n');

        setError(null);
        // Show progress to user
        setMessages(prev => [...prev, {
          role: 'assistant' as const,
          content: '✅ Product direction approved. The 22-member Specification Engineering Team is now building your full technical specification across all 28 sections. This takes 3-5 minutes. You will be notified when it is ready for your review and sign-off.'
        }]);

        // Run spec council in background
        invoke('run_spec_council', {
          projectId: pid,
          productDirection,
          apiKeys: { openrouter: key },
        }).then(() => {
          setMessages(prev => [...prev, {
            role: 'assistant' as const,
            content: '📄 Your Standard Specification Document is ready. The team has populated all 28 sections. Please review and sign off to lock the specification — this becomes the law for all development stages.'
          }]);
        }).catch((e: unknown) => {
          setError('Spec team error: ' + String(e));
        });

        // Advance to Stage 1
        setCurrentStage(s => s + 1);
        setMessages([]);
        setStageStatus(null);
        setCouncil(makeEmptyCouncil());
      } else {
        if (currentStage < STAGES.length - 1) {
          setCurrentStage(s => s + 1);
          setMessages([]);
          setStageStatus(null);
          setCouncil(makeEmptyCouncil());
        }
      }
    } catch (e) { setError(String(e)); }
  };

  const handleReject = async () => {
    try {
      await invoke('reject_stage', { projectId: pid, stageIndex: currentStage });
      setMessages([]); setStageStatus(null); setCouncil(makeEmptyCouncil());
      await loadStage(currentStage);
    } catch (e) { setError(String(e)); }
  };

  const status = stageStatus?.status ?? 'pending';
  const readyToRunCouncil = messages.length >= 3 && !councilRunning && !chatRunning && council.agents.length === 0;
  const spin = { display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(99,102,241,0.3)', borderTopColor: '#6366F1', borderRadius: '50%', animation: 'linup-spin 0.7s linear infinite' } as React.CSSProperties;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      <div style={{ width: 200, background: '#0C0C0E', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>
        <div style={{ padding: '14px 12px 6px', fontSize: 9, fontWeight: 700, color: '#4A5568', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Pipeline</div>
        {STAGES.map(stage => {
          const isActive = stage.index === currentStage;
          const isDone = stage.index < currentStage;
          return (
            <button key={stage.index} onClick={() => { setCurrentStage(stage.index); setMessages([]); setStageStatus(null); setCouncil(makeEmptyCouncil()); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', border: 'none', background: isActive ? '#1E293B' : 'transparent', cursor: 'pointer', textAlign: 'left', borderLeft: isActive ? '3px solid var(--color-brand)' : '3px solid transparent' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: isDone ? '#52B788' : isActive ? 'var(--color-brand)' : '#4A5568', flexShrink: 0, display: 'inline-block', marginTop: 1 }} />
              <span style={{ fontSize: 13, color: isDone ? '#52B788' : isActive ? '#F1F5F9' : '#8B9DB5', fontWeight: isActive ? 600 : 400 }}>{stage.index + 1}. {stage.name}</span>
              {isDone && <span style={{ marginLeft: 'auto', color: '#22C55E', fontSize: 12 }}>&#10003;</span>}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>Stage {currentStage + 1}: {STAGES[currentStage]?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{STAGES[currentStage]?.description}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {(chatRunning || councilRunning) && <span style={spin} />}
            {readyToRunCouncil && (
              <button onClick={runCouncil} style={{ padding: '8px 16px', background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Deploy AI Council
              </button>
            )}
          </div>
        </div>

        {showKeyInput && (
          <div style={{ padding: '12px 16px', background: '#FFF7ED', borderBottom: '1px solid #FED7AA', flexShrink: 0 }}>
            <div style={{ fontSize: 13, color: '#92400E', marginBottom: 8, fontWeight: 500 }}>API keys required</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Anthropic key (sk-ant-...)" style={{ flex: 1, padding: '6px 10px', border: '1px solid #FED7AA', borderRadius: 6, fontSize: 13 }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="password" value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} placeholder="OpenAI key (sk-...) for Devil's Advocate and Security" style={{ flex: 1, padding: '6px 10px', border: '1px solid #FED7AA', borderRadius: 6, fontSize: 13 }} />
              <button onClick={() => { setShowKeyInput(false); if (messages.length === 0) startChat(); }} disabled={!apiKey.startsWith('sk-')} style={{ padding: '6px 16px', background: '#F97316', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>Save and start</button>
            </div>
          </div>
        )}

        {error && <div style={{ padding: '10px 20px', background: '#FEF2F2', borderBottom: '1px solid #FECACA', fontSize: 13, color: '#DC2626', flexShrink: 0 }}>{error}</div>}
        {councilRunning && <div style={{ padding: '10px 20px', background: '#EEF2FF', borderBottom: '1px solid #C7D2FE', fontSize: 13, color: '#4338CA', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}><span style={spin} /> AI council reviewing your brief — watch the panel on the right.</div>}

        <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {messages.length === 0 && !chatRunning && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80%', gap: 12 }}><div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>✦</div><div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)' }}>Starting {STAGES[currentStage]?.name}...</div></div>}
          {messages.map((msg, i) => (
            <div key={i} style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 4, paddingLeft: 4, paddingRight: 4 }}>{msg.role === 'user' ? 'You' : 'LINUP'}</div>
              <div style={{ maxWidth: '85%', padding: '12px 16px', borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px', background: msg.role === 'user' ? 'var(--color-brand)' : 'var(--color-bg-secondary)', color: msg.role === 'user' ? '#fff' : 'var(--color-text-primary)', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{msg.content}</div>
            </div>
          ))}
          {chatRunning && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', color: 'var(--color-text-tertiary)', fontSize: 13 }}><span style={spin} /> LINUP is thinking...</div>}
          {readyToRunCouncil && (
            <div style={{ textAlign: 'center', padding: '24px 0', borderTop: '1px dashed var(--color-border-tertiary)', marginTop: 8 }}>
              <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>Ready to deploy the AI council.<br /><strong>9 specialist agents</strong> will review your brief simultaneously.</div>
              <button onClick={runCouncil} style={{ padding: '12px 28px', background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Deploy AI Council</button>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 8 }}>Clarifier · Devil's Advocate · Spec Writer · Security · Innovator · Business Analyst · Quality Gate</div>
            </div>
          )}
        </div>

        {status !== 'approved' && council.agents.length === 0 && (
          <div style={{ padding: '12px 16px', borderTop: '0.5px solid var(--color-border-tertiary)', display: 'flex', gap: 8, flexShrink: 0 }}>
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="Answer LINUP's questions... (Enter to send)" rows={2} disabled={chatRunning || councilRunning} style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--color-border-tertiary)', borderRadius: 8, fontSize: 14, resize: 'none', fontFamily: 'system-ui', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none' }} />
            <button onClick={sendMessage} disabled={chatRunning || councilRunning || !input.trim()} style={{ padding: '0 18px', background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Send</button>
          </div>
        )}
      </div>

      <CouncilPanel council={council} onApprove={handleApprove} onRequestChanges={async (fb) => { const k = await getKeys(); if (!k) return; setCouncilRunning(true); const msg = messages.concat([{ role: 'user' as const, content: 'Council feedback: ' + fb }]); try { const r = await callAI(msg, k); setMessages(msg.concat([{ role: 'assistant', content: r }])); setCouncil(makeEmptyCouncil()); } catch(e) { setError(String(e)); } setCouncilRunning(false); }} onReject={handleReject} status={status} />
    </div>
  );
}