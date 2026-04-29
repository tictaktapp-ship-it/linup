import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ClarifySession {
  id: string;
  project_id: string;
  questions: string[];
  answers: string[] | null;
  gate_status: string;
  created_at: string;
  updated_at: string;
}

interface Stage2ClarifyProps {
  projectId: string;
  onApproved?: () => void;
}

const Stage2Clarify: React.FC<Stage2ClarifyProps> = ({ projectId, onApproved }) => {
  const [session, setSession] = useState<ClarifySession | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    invoke<ClarifySession>('start_clarify', {
      projectId,
      questions: [
        'Who is the primary user of this app?',
        'What is the single most important action a user should be able to take?',
        'Are there any integrations that are absolutely required on day one?',
        'What does success look like after 90 days?',
        'Are there any hard constraints — budget, tech stack, compliance requirements?',
      ],
    })
    .then(s => {
      setSession(s);
      setAnswers(s.answers ?? new Array(s.questions.length).fill(''));
    })
    .catch(e => setError(String(e)));
  }, [projectId]);

  const handleAnswerChange = async (index: number, value: string) => {
    const updated = [...answers];
    updated[index] = value;
    setAnswers(updated);
  };

  const handleSave = async () => {
    if (!session) return;
    setSaving(true); setError('');
    try {
      await invoke('save_clarify_answers', { sessionId: session.id, answers });
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!session) return;
    setSaving(true); setError('');
    try {
      await invoke('save_clarify_answers', { sessionId: session.id, answers });
      await invoke('approve_clarify', { sessionId: session.id });
      onApproved?.();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const allAnswered = answers.length > 0 && answers.every(a => a.trim().length > 0);
  const hasConflict = session?.gate_status === 'conflict';

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 6,
    border: '1px solid #E4E4E0', fontSize: 14,
    boxSizing: 'border-box', fontFamily: 'inherit',
    minHeight: 72, resize: 'vertical',
  };

  if (!session) return (
    <div style={{ padding: 24, color: '#6B6B66' }}>
      {error || 'Starting clarification session...'}
    </div>
  );

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600 }}>Stage 2 — Clarify your idea</h2>
        <p style={{ margin: 0, color: '#6B6B66', fontSize: 14 }}>
          Answer up to {session.questions.length} questions to help LINUP build exactly what you need.
          Be specific — vague answers lead to vague apps.
        </p>
      </div>

      {session.questions.map((q, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            <span style={{ color: '#1D4ED8', marginRight: 8, fontFamily: 'monospace' }}>{i + 1}.</span>
            {q}
          </label>
          <textarea
            style={{ ...inp, borderColor: answers[i]?.trim() ? '#E4E4E0' : '#FCA5A5' }}
            placeholder="Your answer..."
            value={answers[i] ?? ''}
            onChange={e => handleAnswerChange(i, e.target.value)}
            onBlur={handleSave}
          />
        </div>
      ))}

      {hasConflict && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: 12, fontSize: 13, color: '#991B1B' }}>
          Constraint conflict detected in your answers. Please review and resolve before approving.
        </div>
      )}

      {error && <p style={{ color: '#DC2626', fontSize: 13, margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #E4E4E0', background: '#fff', cursor: 'pointer', fontSize: 14 }}>
          {saving ? 'Saving...' : 'Save answers'}
        </button>
        <button
          onClick={handleApprove}
          disabled={!allAnswered || hasConflict || saving}
          style={{
            flex: 2, padding: '10px', borderRadius: 8, border: 'none',
            background: allAnswered && !hasConflict ? '#1D4ED8' : '#E4E4E0',
            color: allAnswered && !hasConflict ? '#fff' : '#9B9B96',
            fontWeight: 600, cursor: allAnswered && !hasConflict ? 'pointer' : 'not-allowed', fontSize: 14,
          }}>
          {saving ? 'Approving...' : 'Approve and continue →'}
        </button>
      </div>
    </div>
  );
};

export default Stage2Clarify;