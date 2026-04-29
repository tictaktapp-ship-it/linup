import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface IdeaIntakeForm {
  title: string;
  problem_statement: string;
  target_user: string;
  constraints: string;
  links: string;
}

interface Stage1IdeaIntakeProps {
  projectId: string;
  onSubmitted?: () => void;
}

const Stage1IdeaIntake: React.FC<Stage1IdeaIntakeProps> = ({ projectId, onSubmitted }) => {
  const [form, setForm] = useState<IdeaIntakeForm>({
    title: '', problem_statement: '', target_user: '', constraints: '', links: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    invoke<{ title: string; problem_statement: string; target_user: string; constraints: string | null; links: string | null } | null>(
      'get_idea_intake', { projectId }
    ).then(data => {
      if (data) setForm({
        title: data.title,
        problem_statement: data.problem_statement,
        target_user: data.target_user,
        constraints: data.constraints ?? '',
        links: data.links ?? '',
      });
    }).catch(() => {});
  }, [projectId]);

  const inp = (style?: React.CSSProperties): React.CSSProperties => ({
    width: '100%', padding: '8px 12px', borderRadius: 6,
    border: '1px solid #E4E4E0', fontSize: 14,
    boxSizing: 'border-box', fontFamily: 'inherit', ...style,
  });

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      await invoke('save_idea_intake', {
        projectId,
        title: form.title,
        problemStatement: form.problem_statement,
        targetUser: form.target_user,
        constraints: form.constraints || null,
        links: form.links || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setSaving(true); setError('');
    try {
      await handleSave();
      await invoke('submit_idea_intake', { projectId });
      onSubmitted?.();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = form.title.trim() && form.problem_statement.trim() && form.target_user.trim();

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600 }}>Stage 1 — Your idea</h2>
        <p style={{ margin: 0, color: '#6B6B66', fontSize: 14 }}>Tell us what you want to build. Be as specific as you can.</p>
      </div>

      {[
        { label: 'App name', field: 'title', placeholder: 'e.g. Invoice tracker for freelancers', required: true },
        { label: 'Problem it solves', field: 'problem_statement', placeholder: 'What problem does this solve? Who has this problem today?', required: true, multiline: true },
        { label: 'Target user', field: 'target_user', placeholder: 'e.g. Freelance designers who invoice 5-20 clients per month', required: true },
        { label: 'Constraints', field: 'constraints', placeholder: 'Budget, must-have integrations, things to avoid...', required: false, multiline: true },
        { label: 'Useful links', field: 'links', placeholder: 'Competitors, inspiration, reference apps (one per line)', required: false, multiline: true },
      ].map(({ label, field, placeholder, required, multiline }) => (
        <label key={field} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 500 }}>
          {label} {required && <span style={{ color: '#DC2626', fontSize: 11 }}>required</span>}
          {multiline ? (
            <textarea
              style={inp({ height: 80, resize: 'vertical' })}
              placeholder={placeholder}
              value={form[field as keyof IdeaIntakeForm]}
              onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
            />
          ) : (
            <input
              style={inp()}
              placeholder={placeholder}
              value={form[field as keyof IdeaIntakeForm]}
              onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
            />
          )}
        </label>
      ))}

      {error && <p style={{ color: '#DC2626', fontSize: 13, margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #E4E4E0', background: '#fff', cursor: 'pointer', fontSize: 14 }}>
          {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save draft'}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || saving}
          style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: canSubmit ? '#1D4ED8' : '#E4E4E0', color: canSubmit ? '#fff' : '#9B9B96', fontWeight: 600, cursor: canSubmit ? 'pointer' : 'not-allowed', fontSize: 14 }}>
          {saving ? 'Submitting...' : 'Submit idea →'}
        </button>
      </div>
    </div>
  );
};

export default Stage1IdeaIntake;