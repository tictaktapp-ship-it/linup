import { useState, useEffect, useRef } from 'react';
import { OPENROUTER_KEY } from '../lib/config';

export interface Question {
  id: string;
  text: string;
  answer?: string;
}

interface QuestionnaireCardProps {
  question: Question;
  index: number;
  onAnswer: (id: string, answer: string) => void;
}

function QuestionnaireCard({ question, index, onAnswer }: QuestionnaireCardProps) {
  const [options, setOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [customText, setCustomText] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Generate 4 suggested answers via LLM
    const generateOptions = async () => {
      try {
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + OPENROUTER_KEY,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://linup.io',
            'X-Title': 'LINUP Questionnaire',
          },
          body: JSON.stringify({
            model: 'meta-llama/llama-3.1-8b-instruct',
            max_tokens: 200,
            messages: [{
              role: 'user',
              content: `For this product question: "${question.text}"\n\nProvide exactly 4 short, distinct answer options (max 8 words each). Return ONLY a JSON array of 4 strings, nothing else. Example: ["Option 1", "Option 2", "Option 3", "Option 4"]`
            }]
          })
        });
        const d = await r.json();
        const text = d.choices?.[0]?.message?.content ?? '[]';
        const parsed = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] ?? '[]');
        setOptions(Array.isArray(parsed) ? parsed.slice(0, 4) : []);
      } catch {
        setOptions(['Yes', 'No', 'Not yet decided', 'Need more research']);
      } finally {
        setLoadingOptions(false);
      }
    };
    generateOptions();
  }, [question.text]);

  const handleSelect = (opt: string) => {
    setSelected(opt);
    setShowCustom(false);
    setCustomText('');
    onAnswer(question.id, opt);
  };

  const handleCustomSubmit = () => {
    const answer = customText + (uploadedFile ? ` [File: ${uploadedFileName}]` : '');
    onAnswer(question.id, answer);
    setSelected('custom');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedFile(reader.result as string);
      setUploadedFileName(file.name);
    };
    reader.readAsDataURL(file);
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
        {question.text}
      </div>

      {loadingOptions ? (
        <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Generating options...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {options.map((opt, i) => (
            <button key={i} onClick={() => handleSelect(opt)}
              style={{
                padding: '8px 12px', borderRadius: 7, border: `1px solid ${selected === opt ? 'var(--color-brand)' : '#E0E0DE'}`,
                background: selected === opt ? 'rgba(140,0,180,0.08)' : '#fff',
                color: selected === opt ? 'var(--color-brand)' : 'var(--color-text-primary)',
                fontSize: 13, fontWeight: selected === opt ? 600 : 400,
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              }}>
              {selected === opt ? '✓ ' : ''}{opt}
            </button>
          ))}

          {/* Other / type your own */}
          {!showCustom ? (
            <button onClick={() => setShowCustom(true)}
              style={{ padding: '8px 12px', borderRadius: 7, border: '1px dashed #C0C0BC', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
              ✏️ Other — type your own answer
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <textarea
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                placeholder="Type your answer..."
                style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid var(--color-brand)', fontSize: 13, resize: 'vertical', minHeight: 60, fontFamily: 'var(--font-sans)', outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => fileRef.current?.click()}
                  style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #E0E0DE', background: '#fff', fontSize: 12, cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                  📎 {uploadedFileName || 'Attach file'}
                </button>
                <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={handleFileUpload} />
                <button onClick={handleCustomSubmit} disabled={!customText.trim()}
                  style={{ flex: 1, padding: '6px 12px', borderRadius: 6, border: 'none', background: customText.trim() ? 'var(--color-brand)' : '#E0E0DE', color: '#fff', fontSize: 12, fontWeight: 600, cursor: customText.trim() ? 'pointer' : 'default' }}>
                  Submit answer
                </button>
              </div>
              {uploadedFileName && (
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>📎 {uploadedFileName} attached</div>
              )}
            </div>
          )}
        </div>
      )}
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
          Pass {passNumber} of 3 — Council questions
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