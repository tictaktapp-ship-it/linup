50.
    </p>
    <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 8, padding: 16, fontSize: 13 }}>
      <strong>What happens next:</strong>
      <ul style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.8 }}>
        <li>AI generates product spec from your idea</li>
        <li>Gates check for completeness</li>
        <li>You review and approve before anything is built</li><li>LINUP may pause to ask you clarifying questions during the build</li>
      </ul>
    </div>
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      <button onClick={onBack} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #E4E4E0', background: '#fff', cursor: 'pointer' }}>← Back</button>
      <button onClick={onNext} style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: '#1D4ED8', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
        Run Stage 1 →
      </button>
    </div>
  </div>
);

export default Step5;