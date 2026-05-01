interface Props {
  onNext: (stepData?: Record<string, unknown>) => void;
  onBack: () => void;
}

export default function Step5({ onNext, onBack }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '40px 32px', maxWidth: 520, margin: '24px auto 0', width: '100%' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8 }}>
          Ready to run Stage 1
        </div>
        <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
          LINUP will use your idea to generate a full product specification.
          This typically takes 2-4 minutes.
        </div>
      </div>
      <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 8, padding: 20, fontSize: 13 }}>
        <strong style={{ display: 'block', marginBottom: 10 }}>What happens next:</strong>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9, color: 'var(--color-text-secondary)' }}>
          <li>AI generates a product specification from your idea</li>
          <li>Gates check the spec for completeness and quality</li>
          <li>LINUP may pause to ask you clarifying questions</li>
          <li>You review and approve before anything is built</li>
        </ul>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onBack} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '0.5px solid var(--color-border-tertiary)', background: 'transparent', cursor: 'pointer', fontSize: 14 }}>
          &larr; Back
        </button>
        <button onClick={() => onNext()} style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: 'var(--color-accent-primary)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
          Run Stage 1 &rarr;
        </button>
      </div>
    </div>
  );
}
