import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const STAGES = [
  { index: 0,  name: 'Product Spec',  icon: '📋', description: 'AI interviews you and generates a full product specification' },
  { index: 1,  name: 'Architecture',  icon: '🏗️', description: 'System design, tech stack, and component structure' },
  { index: 2,  name: 'Database',      icon: '🗄️', description: 'Schema design, migrations, and data model' },
  { index: 3,  name: 'Backend',       icon: '⚙️', description: 'API design, business logic, and server code' },
  { index: 4,  name: 'Frontend',      icon: '💻', description: 'UI components, pages, and user flows' },
  { index: 5,  name: 'Tests',         icon: '🧪', description: 'Unit, integration, and end-to-end tests' },
  { index: 6,  name: 'CI/CD',         icon: '🚀', description: 'Build pipeline and deployment configuration' },
  { index: 7,  name: 'Security',      icon: '🔒', description: 'Auth, permissions, and security review' },
  { index: 8,  name: 'Performance',   icon: '⚡', description: 'Optimisation and load testing' },
  { index: 9,  name: 'Deployment',    icon: '🌐', description: 'Production deployment and go-live' },
  { index: 10, name: 'Handover',      icon: '📦', description: 'Documentation, export, and handover pack' },
];

interface Message { role: 'user' | 'assistant'; content: string; }

interface StageArtifact {
  id: string; project_id: string; stage_index: number;
  artifact_type: string; content: string; created_at: string;
}

interface StageStatus {
  stage_index: number; status: string; artifact: StageArtifact | null;
}
const SYSTEM_PROMPT = `You are LINUP, an expert product manager and software architect. Your job is to help the user define their internal tool through a short conversation, then generate a comprehensive product specification.

Start by warmly greeting the user and asking 2-3 targeted clarifying questions about their app — who will use it, what the main workflow is, and any key constraints. Keep questions concise. After the user answers, ask 1-2 follow-up questions if needed. Once you have enough information (usually after 2-3 exchanges), tell the user you have enough to write the spec and ask them to click Generate Spec.

When generating the spec (when asked), produce a well-structured markdown document with these sections:
# Product Specification: [App Name]
## Executive Summary
## Target Users
## User Stories
## Acceptance Criteria
## Technical Constraints
## Feature List (MoSCoW)
## Out of Scope`;

export default function StageWorkspaceScreen() {
  const { projectId, stageIndex: stageParam } = useParams<{ projectId: string; stageIndex: string }>();
  const pid = projectId ?? '';
  const [currentStage, setCurrentStage] = useState(parseInt(stageParam ?? '0'));
  const [stageStatus, setStageStatus] = useState<StageStatus | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const loadStage = async (stage: number) => {
    try {
      const s = await invoke<StageStatus>('get_stage_status', { projectId: pid, stageIndex: stage });
      setStageStatus(s);
      if (s.status === 'pending' && stage === 0 && messages.length === 0) {
        startConversation();
      }
    } catch (e) { setError(String(e)); }
  };

  useEffect(() => {
    loadStage(currentStage);
    const unlisten = listen<{ project_id: string; stage_index: number; status: string }>('stage-status', event => {
      if (event.payload.project_id === pid && event.payload.stage_index === currentStage) {
        loadStage(currentStage);
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [currentStage, pid]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, running]);

  const getKey = async (): Promise<string> => {
    if (apiKey) return apiKey;
    try {
      const k = await invoke<string>('get_secret', { service: 'linup-' + pid, key: 'ANTHROPIC_API_KEY' });
      if (k) { setApiKey(k); return k; }
    } catch { /* no key stored */ }
    setShowKeyInput(true);
    return '';
  };
  const callAI = async (msgs: Message[], key: string): Promise<string> => {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: msgs.map(m => ({ role: m.role, content: m.content })),
      }),
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.content?.[0]?.text ?? '';
  };

  const startConversation = async () => {
    const key = await getKey();
    if (!key) return;
    setRunning(true);
    try {
      const seed: Message = { role: 'user', content: 'I want to build an internal tool. I have provided the app name and description already during setup. Please start our conversation.' };
      const reply = await callAI([seed], key);
      setMessages([{ role: 'assistant', content: reply }]);
    } catch (e) { setError(String(e)); }
    setRunning(false);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || running) return;
    const key = await getKey();
    if (!key) return;
    const newMsg: Message = { role: 'user', content: text };
    const updated = [...messages, newMsg];
    setMessages(updated);
    setInput('');
    setRunning(true);
    setError(null);
    try {
      const reply = await callAI(updated, key);
      setMessages([...updated, { role: 'assistant', content: reply }]);
    } catch (e) { setError(String(e)); }
    setRunning(false);
  };

  const generateSpec = async () => {
    const key = await getKey();
    if (!key) return;
    setRunning(true); setError(null);
    const prompt: Message = {
      role: 'user',
      content: 'I am ready. Please generate the full Product Specification document now based on our conversation.',
    };
    const updated = [...messages, prompt];
    setMessages(updated);
    try {
      const spec = await callAI(updated, key);
      const withSpec = [...updated, { role: 'assistant' as const, content: spec }];
      setMessages(withSpec);
      await invoke('run_stage', { projectId: pid, stageIndex: currentStage, anthropicKey: key });
      await loadStage(currentStage);
    } catch (e) { setError(String(e)); }
    setRunning(false);
  };

  const handleApprove = async () => {
    try {
      await invoke('approve_stage', { projectId: pid, stageIndex: currentStage });
      if (currentStage < STAGES.length - 1) {
        const next = currentStage + 1;
        setCurrentStage(next);
        setMessages([]);
        setStageStatus(null);
        setShowComment(false);
        setComment('');
      }
    } catch (e) { setError(String(e)); }
  };

  const handleReject = async () => {
    try {
      await invoke('reject_stage', { projectId: pid, stageIndex: currentStage });
      setMessages([]);
      setStageStatus(null);
      await loadStage(currentStage);
    } catch (e) { setError(String(e)); }
  };

  const submitRevision = async () => {
    if (!comment.trim()) return;
    const key = await getKey();
    if (!key) return;
    setRunning(true);
    const msg: Message = { role: 'user', content: 'Please revise the spec with these changes: ' + comment };
    const updated = [...messages, msg];
    setMessages(updated);
    try {
      const reply = await callAI(updated, key);
      setMessages([...updated, { role: 'assistant', content: reply }]);
      setComment(''); setShowComment(false);
    } catch (e) { setError(String(e)); }
    setRunning(false);
  };

  const artifact = stageStatus?.artifact;
  const status = stageStatus?.status ?? 'pending';
  const hasArtifact = !!artifact;
  const readyToGenerate = messages.length >= 4 && !hasArtifact && !running;

  const spinStyle = {
    display: 'inline-block', width: 14, height: 14,
    border: '2px solid rgba(99,102,241,0.3)', borderTopColor: '#6366F1',
    borderRadius: '50%', animation: 'linup-spin 0.7s linear infinite',
  } as React.CSSProperties;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ width: 196, background: '#0F172A', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>
        <div style={{ padding: '16px 14px 8px', fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pipeline</div>
        {STAGES.map(stage => {
          const isActive = stage.index === currentStage;
          const isDone = stage.index < currentStage;
          return (
            <button key={stage.index}
              onClick={() => { setCurrentStage(stage.index); setMessages([]); setStageStatus(null); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', border: 'none', background: isActive ? '#1E293B' : 'transparent', cursor: 'pointer', textAlign: 'left', borderLeft: isActive ? '3px solid #6366F1' : '3px solid transparent' }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{stage.icon}</span>
              <span style={{ fontSize: 12, color: isDone ? '#22C55E' : isActive ? '#F1F5F9' : '#475569', fontWeight: isActive ? 600 : 400 }}>
                {stage.index + 1}. {stage.name}
              </span>
              {isDone && <span style={{ marginLeft: 'auto', color: '#22C55E', fontSize: 12 }}>&#10003;</span>}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {STAGES[currentStage]?.icon} Stage {currentStage + 1}: {STAGES[currentStage]?.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
              {STAGES[currentStage]?.description}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {running && <span style={spinStyle} />}
            {readyToGenerate && (
              <button onClick={generateSpec} style={{ padding: '7px 14px', background: '#6366F1', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Generate spec
              </button>
            )}
          </div>
        </div>

        {showKeyInput && (
          <div style={{ padding: '12px 16px', background: '#FFF7ED', borderBottom: '1px solid #FED7AA', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 13, color: '#92400E', flexShrink: 0 }}>Anthropic API key required:</span>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              style={{ flex: 1, padding: '6px 10px', border: '1px solid #FED7AA', borderRadius: 6, fontSize: 13 }} />
            <button
              onClick={() => { setShowKeyInput(false); if (messages.length === 0) startConversation(); }}
              disabled={!apiKey.startsWith('sk-')}
              style={{ padding: '6px 14px', background: '#F97316', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
              Save and start
            </button>
          </div>
        )}

        {error && (
          <div style={{ padding: '10px 20px', background: '#FEF2F2', borderBottom: '1px solid #FECACA', fontSize: 13, color: '#DC2626', flexShrink: 0 }}>
            {error}
          </div>
        )}

        <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {messages.length === 0 && !running && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80%', gap: 12 }}>
              <div style={{ fontSize: 40 }}>{STAGES[currentStage]?.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)' }}>Starting {STAGES[currentStage]?.name}...</div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 4, paddingLeft: 4, paddingRight: 4 }}>
                {msg.role === 'user' ? 'You' : 'LINUP'}
              </div>
              <div style={{
                maxWidth: '85%', padding: '12px 16px',
                borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                background: msg.role === 'user' ? '#6366F1' : 'var(--color-bg-secondary)',
                color: msg.role === 'user' ? '#fff' : 'var(--color-text-primary)',
                fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
            </div>
          ))}
          {running && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
              <span style={spinStyle} /> LINUP is thinking...
            </div>
          )}
          {readyToGenerate && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>Ready to generate your product specification</div>
              <button onClick={generateSpec} style={{ padding: '10px 24px', background: '#6366F1', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Generate spec
              </button>
            </div>
          )}
        </div>

        {status !== 'approved' && !hasArtifact && (
          <div style={{ padding: '12px 16px', borderTop: '0.5px solid var(--color-border-tertiary)', display: 'flex', gap: 8, flexShrink: 0 }}>
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Answer LINUP's questions... (Enter to send, Shift+Enter for newline)"
              rows={2} disabled={running}
              style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--color-border-tertiary)', borderRadius: 8, fontSize: 14, resize: 'none', fontFamily: 'system-ui', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none' }}
            />
            <button onClick={sendMessage} disabled={running || !input.trim()}
              style={{ padding: '0 18px', background: '#6366F1', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
              Send
            </button>
          </div>
        )}
      </div>

      {hasArtifact && (
        <div style={{ width: 220, borderLeft: '0.5px solid var(--color-border-tertiary)', display: 'flex', flexDirection: 'column', gap: 10, padding: 16, flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Review</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6, padding: '10px 12px', background: 'var(--color-bg-secondary)', borderRadius: 6 }}>
            Read the specification in the chat before approving.
          </div>
          <button onClick={handleApprove} disabled={status === 'approved'}
            style={{ padding: '10px', background: status === 'approved' ? '#F0FDF4' : '#16A34A', color: status === 'approved' ? '#16A34A' : '#fff', border: status === 'approved' ? '1px solid #BBF7D0' : 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: status === 'approved' ? 'default' : 'pointer' }}>
            {status === 'approved' ? 'Approved' : 'Approve'}
          </button>
          <button onClick={() => setShowComment(s => !s)}
            style={{ padding: '10px', background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Request changes
          </button>
          {showComment && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <textarea value={comment} onChange={e => setComment(e.target.value)}
                placeholder="What needs to change?" rows={4}
                style={{ padding: 8, border: '1px solid var(--color-border-tertiary)', borderRadius: 6, fontSize: 12, resize: 'vertical', fontFamily: 'system-ui' }} />
              <button onClick={submitRevision} disabled={!comment.trim() || running}
                style={{ padding: '7px', background: '#F97316', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Submit feedback
              </button>
            </div>
          )}
          <button onClick={handleReject}
            style={{ padding: '10px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Reject and redo
          </button>
        </div>
      )}
    </div>
  );
}