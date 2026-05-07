import { useState } from 'react';

export interface Question {
  id: string;
  text: string;
  answer?: string;
}

interface ParsedOption {
  letter: string;
  text: string;
  detail: string;
  recommended: boolean;
}

function parseOptions(questionText: string): { question: string; options: ParsedOption[] } {
  const lines = questionText.split('\n').map(l => l.trim()).filter(Boolean);
  const question = lines[0].replace(/^QUESTION:\s*/, '');
  const options: ParsedOption[] = [];
  for (const line of lines.slice(1)) {
    const m = line.match(/^([A-D]):\s*(.+?)(?:\s+—\s+(.+?))?(\s+★\s*RECOMMENDED)?$/);
    if (m) {
      options.push({
        letter: m[1],
        text: m[2].trim(),
        detail: m[3]?.trim() ?? '',
        recommended: !!m[4],
      });
    }
  }
  // If no structured options found, return empty (will use free text fallback)
  return { question, options };
}

interface QuestionnaireCardProps {
  question: Question;
  index: number;
  onAnswer: (id: string, answer: string) => void;
}

function QuestionnaireCard({ question, index, onAnswer }: QuestionnaireCardProps) {
  const { question: questionText, options } = parseOptions(question.text);
  const [selected, setSelected] = useState<string>('');
  const [customText, setCustomText] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const handleSelect = (letter: string, text: string) => {
    setSelected(letter);
    setShowCustom(false);
    onAnswer(question.id, letter + ': ' + text);
  };

  const isAnswered = selected !== '' || (showCustom && customText.length > 0);

  return (
    <div style={{
      background: isAnswered ? '#F0FDF4' : '#FAFAFA',
      border: `1px solid ${isAnswered ? '#86EFAC' : '#E0E0DE'}`,
      borderRadius: 10, padding: '14px 16px', marginBottom: 10,
      transition: 'all 0.2s',
    }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Question {index + 1}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 10, lineHeight: 1.5 }}>
        {questionText}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {options.length > 0 ? options.map((opt) => (
          <button key={opt.letter} onClick={() => handleSelect(opt.letter, opt.text)}
            style={{
              padding: '10px 12px', borderRadius: 7, textAlign: 'left', cursor: 'pointer',
              border: `1px solid ${selected === opt.letter ? 'var(--color-brand)' : opt.recommended ? '#C7D2FE' : '#E0E0DE'}`,
              background: selected === opt.letter ? 'rgba(140,0,180,0.08)' : opt.recommended ? '#EEF2FF' : '#fff',
              transition: 'all 0.15s',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: selected === opt.letter ? 'var(--color-brand)' : '#6B7280', minWidth: 18 }}>{opt.letter}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: selected === opt.letter ? 600 : 400, color: selected === opt.letter ? 'var(--color-brand)' : 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {opt.text}
                  {opt.recommended && <span style={{ fontSize: 10, background: '#6366F1', color: '#fff', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>Recommended</span>}
                </div>
                {opt.detail && <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{opt.detail}</div>}
              </div>
              {selected === opt.letter && <span style={{ color: 'var(--color-brand)', fontSize: 14 }}>✓</span>}
            </div>
          </button>
        )) : null}

        {/* Other / type your own */}
        {!showCustom ? (
          <button onClick={() => setShowCustom(true)}
            style={{ padding: '8px 12px', borderRadius: 7, border: '1px dashed #C0C0BC', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
            ✏ Other — type your own answer
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <textarea value={customText} onChange={e => setCustomText(e.target.value)}
              placeholder="Type your answer..."
              style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid var(--color-brand)', fontSize: 13, resize: 'vertical', minHeight: 60, fontFamily: 'inherit', outline: 'none' }}
            />
            <button onClick={() => { onAnswer(question.id, 'Other: ' + customText); setSelected('other'); setShowCustom(false); }}
              disabled={!customText.trim()}
              style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: customText.trim() ? 'var(--color-brand)' : '#E0E0DE', color: '#fff', fontSize: 12, fontWeight: 600, cursor: customText.trim() ? 'pointer' : 'default' }}>
              Submit answer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface QuestionnaireProps {
  questions: Question[];
  passNumber: number;
  onSubmit: (answers: Record<string, string>) => void;
  onSkip: () => void;
}

export default function Questionnaire({ questions, passNumber, onSubmit, onSkip }: QuestionnaireProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const answeredCount = Object.keys(answers).length;

  const handleAnswer = (id: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [id]: answer }));
  };

  return (
    <div style={{ padding: '16px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-brand)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
          Pass {passNumber} of 5 — Council questions
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          Answer these questions to help the council produce a better specification. All answers are optional — click Submit when ready.
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
          {answeredCount} of {questions.length} answered
        </div>
      </div>

      {questions.map((q, i) => (
        <QuestionnaireCard key={q.id} question={q} index={i} onAnswer={handleAnswer} />
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={onSkip}
          style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #E0E0DE', background: 'transparent', fontSize: 13, cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
          Skip — proceed anyway
        </button>
        <button onClick={() => onSubmit(answers)}
          style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: 'var(--color-brand)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          Submit answers → Re-run council
        </button>
      </div>
    </div>
  );
}