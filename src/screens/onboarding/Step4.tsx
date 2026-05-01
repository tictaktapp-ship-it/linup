interface Props {
  onNext: (stepData?: Record<string, unknown>) => void;
  onBack: () => void;
}

export default function Step4({ onNext, onBack }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: '48px 32px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 12 }}>
          AI powered by LINUP
        </div>
        <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
          LINUP includes full AI processing as part of your subscription.
          No API keys needed &mdash; everything is handled for you.
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', lineHeight: 1.6 }}>
          Want to use your own Anthropic API key? You can configure this later in
          Settings &rarr; Advanced.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button onClick={onBack} style={{ padding: '8px 20px', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 6, background: 'transparent', cursor: 'pointer', fontSize: 14 }}>
          &larr; Back
        </button>
        <button onClick={onNext} style={{ padding: '8px 24px', background: 'var(--color-accent-primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
          Continue &rarr;
        </button>
      </div>
    </div>
  );
}
