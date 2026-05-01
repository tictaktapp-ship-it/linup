import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface Props {
  projectId: string;
  onApprove: () => void;
  onBack: () => void;
}

export default function Step6({ projectId, onApprove, onBack }: Props) {
  const [spec, setSpec] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) { setLoading(false); return; }
    invoke<Array<{artifact_type: string, content: number[]}>>('get_artifacts', { projectId, stageIndex: 3 })
      .then(artifacts => {
        const specArtifact = artifacts.find(a => a.artifact_type === 'product_spec');
        if (specArtifact) {
          setSpec(new TextDecoder().decode(new Uint8Array(specArtifact.content)));
        } else {
          setSpec('Product specification is being generated. If this screen appears blank, return to the previous step and run Stage 1 first.');
        }
        setLoading(false);
      })
      .catch(() => { setSpec('No product specification found. Please run Stage 1 first.'); setLoading(false); });
  }, [projectId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0 32px 32px' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8 }}>
          Review your product specification
        </div>
        <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
          LINUP has generated a product spec from your idea. Review it carefully &mdash; once approved, LINUP will build to this specification.
        </div>
      </div>
      <div style={{
        flex: 1, overflowY: 'auto', background: 'var(--color-bg-secondary)',
        border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8,
        padding: 20, fontSize: 13, lineHeight: 1.7,
        color: 'var(--color-text-primary)', fontFamily: 'monospace',
        whiteSpace: 'pre-wrap', minHeight: 200, marginBottom: 20,
      }}>
        {loading ? 'Loading specification...' : spec}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onBack} style={{ padding: '8px 20px', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 6, background: 'transparent', cursor: 'pointer', fontSize: 14 }}>
          &larr; Back
        </button>
        <button
          onClick={onApprove}
          disabled={loading || !spec || spec.includes('Please run Stage 1')}
          style={{ flex: 1, padding: '10px 24px', background: loading ? '#ccc' : '#16A34A', color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 500 }}
        >
          Approve and continue &rarr;
        </button>
      </div>
    </div>
  );
}
