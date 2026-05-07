import { useState, useEffect, useRef, useCallback } from 'react';

interface SpecSection {
  id: string;
  number: string;
  title: string;
  content: string;
  verdict: 'COMPLETE' | 'NEEDS_INPUT' | 'BLOCKED' | 'UNKNOWN';
  gaps: number;
  questions: number;
}

interface SpecDocumentViewerProps {
  doc: string;
  projectId: string;
  projectName: string;
  onApprove: (outputFolder: string) => Promise<void>;
  onReject: (feedback: string) => Promise<void>;
  onClose: () => void;
}

function renderMarkdown(text: string): string {
  return text
    .replace(/<!--.*?-->/gs, '')
    .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre class="spec-code"><code>$2</code></pre>')
    .replace(/^\|(.+)\|\s*$/gm, (_: string, row: string) => {
      const cells = row.split('|').map((c: string) => c.trim());
      return `<tr>${cells.map((c: string) => `<td>${c}</td>`).join('')}</tr>`;
    })
    .replace(/(<tr>.*<\/tr>\n?)+/gs, (match: string) => `<table class="spec-table">${match}</table>`)
    .replace(/^---+$/gm, '<hr class="spec-hr" />')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="spec-inline-code">$1</code>')
    .replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/gs, (match: string) => `<ul class="spec-list">${match}</ul>`)
    .replace(/\[GAP-(\w+)\]:/g, '<span class="spec-gap">[GAP-$1]:</span>')
    .replace(/^QUESTION: (.+)$/gm, '<div class="spec-question"><span class="spec-q-label">QUESTION</span> $1</div>')
    .replace(/^VERDICT: (COMPLETE|NEEDS_INPUT|BLOCKED)$/gm, (_: string, v: string) => {
      const cls = v === 'COMPLETE' ? 'verdict-complete' : v === 'NEEDS_INPUT' ? 'verdict-needs' : 'verdict-blocked';
      return `<div class="spec-verdict ${cls}">VERDICT: ${v}</div>`;
    })
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
}

function parseSections(doc: string): SpecSection[] {
  const sections: SpecSection[] = [];
  const parts = doc.split(/(?=^## )/m);
  for (const part of parts) {
    if (!part.trim()) continue;
    const lines = part.split('\n');
    const heading = lines[0].replace(/^#+\s*/, '').replace(/<!--.*?-->/, '').trim();
    const content = lines.slice(1).join('\n');
    const numMatch = heading.match(/^(\d+[\.\d]*)\)/);
    const number = numMatch ? numMatch[1] : '';
    const title = heading.replace(/^\d+[\.\d]*\)\s*/, '').replace(/\[.*?\]/g, '').trim();
    const upper = content.toUpperCase();
    let verdict: SpecSection['verdict'] = 'UNKNOWN';
    if (upper.includes('VERDICT: COMPLETE')) verdict = 'COMPLETE';
    else if (upper.includes('VERDICT: NEEDS_INPUT')) verdict = 'NEEDS_INPUT';
    else if (upper.includes('VERDICT: BLOCKED')) verdict = 'BLOCKED';
    else if (upper.includes('[GAP-')) verdict = 'NEEDS_INPUT';
    const gaps = (content.match(/\[GAP-/g) || []).length;
    const questions = (content.match(/^QUESTION:/gm) || []).length;
    if (title) sections.push({ id: `sec-${sections.length}`, number, title, content, verdict, gaps, questions });
  }
  return sections;
}

function VerdictDot({ verdict }: { verdict: SpecSection['verdict'] }) {
  const colors = { COMPLETE: '#52B788', NEEDS_INPUT: '#D97706', BLOCKED: '#DC2626', UNKNOWN: '#8A8A82' };
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: colors[verdict], flexShrink: 0, marginTop: 1 }} />;
}

export default function SpecDocumentViewer({ doc, projectId, projectName, onApprove, onReject, onClose }: SpecDocumentViewerProps) {
  const [sections, setSections] = useState<SpecSection[]>([]);
  const [activeSection, setActiveSection] = useState<string>('');
  const [search, setSearch] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showAnswerPanel, setShowAnswerPanel] = useState(false);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => { setSections(parseSections(doc)); }, [doc]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const handler = () => {
      const scrollTop = container.scrollTop;
      let current = '';
      for (const [id, el] of Object.entries(sectionRefs.current)) {
        if (el && el.offsetTop - 120 <= scrollTop) current = id;
      }
      if (current) setActiveSection(current);
    };
    container.addEventListener('scroll', handler, { passive: true });
    return () => container.removeEventListener('scroll', handler);
  }, [sections]);

  const scrollTo = useCallback((id: string) => {
    const el = sectionRefs.current[id];
    if (el && contentRef.current) contentRef.current.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
    setActiveSection(id);
  }, []);

  const complete = sections.filter(s => s.verdict === 'COMPLETE').length;
  const needsInput = sections.filter(s => s.verdict === 'NEEDS_INPUT').length;
  const blocked = sections.filter(s => s.verdict === 'BLOCKED').length;
  const totalGaps = sections.reduce((a, s) => a + s.gaps, 0);
  const totalQuestions = sections.reduce((a, s) => a + s.questions, 0);
  const allQuestions = sections.flatMap(s =>
    s.content.split('\n')
      .filter((l: string) => l.trim().startsWith('QUESTION:'))
      .map((l: string, i: number) => ({ id: s.id + '-q' + i, text: l.replace(/^QUESTION:\s*/, '').trim(), section: s.title }))
  );
  const filteredSections = search.trim() ? sections.filter(s => s.title.toLowerCase().includes(search.toLowerCase()) || s.content.toLowerCase().includes(search.toLowerCase())) : sections;

  const downloadMarkdown = () => {
    const blob = new Blob([doc], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '-')}-specification-v0.1.0.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${projectName} — Specification</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono&display=swap');
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',sans-serif;color:#1A1A18}
.cover{min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:80px;background:linear-gradient(135deg,#3D006B 0%,#8C00B4 50%,#C400FF 100%);color:#fff;page-break-after:always}
.cover-eyebrow{font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;opacity:.6;margin-bottom:48px}
.cover-badge{display:inline-block;padding:4px 12px;border:1px solid rgba(255,255,255,.4);border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.08em;margin-bottom:24px}
.cover-title{font-size:48px;font-weight:700;letter-spacing:-.03em;line-height:1.1;margin-bottom:16px}
.cover-sub{font-size:18px;opacity:.8;margin-bottom:40px}
.cover-meta{font-size:12px;opacity:.55;line-height:2.2}
.content{padding:60px 80px}
h1{font-size:26px;font-weight:700;color:#8C00B4;margin:48px 0 16px;border-bottom:2px solid #8C00B4;padding-bottom:8px}
h2{font-size:18px;font-weight:600;color:#1A1A18;margin:28px 0 10px}
h3{font-size:13px;font-weight:700;color:#4A4A46;margin:18px 0 6px;text-transform:uppercase;letter-spacing:.06em}
p{font-size:13px;line-height:1.7;color:#1A1A18;margin-bottom:10px}
ul{margin:6px 0 14px 18px}li{font-size:13px;line-height:1.7;margin-bottom:3px}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px}
th,td{border:1px solid #E0E0DE;padding:7px 10px;text-align:left;vertical-align:top}
th{background:#F4F4F2;font-weight:600}
code{font-family:'JetBrains Mono',monospace;font-size:11px;background:#F4F4F2;padding:1px 4px;border-radius:3px}
pre{background:#1A1A18;color:#F4F4F2;padding:14px;border-radius:6px;font-size:11px;margin:10px 0;white-space:pre-wrap}
.gap{color:#DC2626;font-weight:700}
.question{background:#EEF2FF;border-left:3px solid #6366F1;padding:7px 10px;margin:6px 0;font-size:12px}
hr{border:none;border-top:1px solid #E0E0DE;margin:28px 0}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="cover">
  <div class="cover-eyebrow">LINUP · AI Co-Founder Platform</div>
  <div class="cover-badge">DRAFT — AWAITING APPROVAL</div>
  <div class="cover-title">${projectName}</div>
  <div class="cover-sub">Product Specification Document</div>
  <div class="cover-meta">Version: 0.1.0<br/>Project ID: ${projectId}<br/>Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}<br/>Produced by: LINUP 22-Agent Engineering Team<br/>Status: Draft — Awaiting Founder Approval</div>
</div>
<div class="content">
${doc.replace(/<!--.*?-->/gs, '').replace(/^## (.+)$/gm, '<h1>$1</h1>').replace(/^### (.+)$/gm, '<h2>$1</h2>').replace(/^#### (.+)$/gm, '<h3>$1</h3>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\[GAP-(\w+)\]:/g, '<span class="gap">[GAP-$1]:</span>').replace(/^QUESTION: (.+)$/gm, '<div class="question"><strong>QUESTION:</strong> $1</div>').replace(/^---+$/gm, '<hr/>').replace(/\n\n/g, '</p><p>')}
</div>
<script>window.onload=()=>window.print();</script>
</body></html>`;
    win.document.write(html);
    win.document.close();
  };

  const handleApprove = async () => {
    setApproving(true);
    setSaveStatus('Saving…');
    try {
      await onApprove('');
      setSaveStatus('Saved');
    } catch (e) { setSaveStatus('Error'); console.error(e); }
    setApproving(false);
  };

  const handleReject = async () => {
    if (!rejectFeedback.trim()) return;
    setRejecting(true);
    try { await onReject(rejectFeedback); setShowRejectModal(false); } catch (e) { console.error(e); }
    setRejecting(false);
  };

  const btn = (bg: string, color: string, border?: string) => ({
    height: 32, padding: '0 14px', borderRadius: 6, border: border || 'none',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
    background: bg, color,
  } as React.CSSProperties);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0C0C0E', display: 'flex', flexDirection: 'column', fontFamily: "'Inter',system-ui,sans-serif" }}>
      {/* Topbar */}
      <div style={{ height: 52, flexShrink: 0, background: '#141417', borderBottom: '0.5px solid #2A2A30', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10 }}>
        <img src="/assets/linup-icon.png" alt="LINUP" style={{ width: 22, height: 22, objectFit: 'contain' }} />
        <img src="/assets/linup-wordmark-transparent.png" alt="LINUP" style={{ height: 15, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.9 }} />
        <div style={{ width: 1, height: 20, background: '#2A2A30', margin: '0 4px' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9' }}>{projectName}</span>
        <span style={{ fontSize: 12, color: '#4A5568' }}>/ Product Specification</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#1E1E22', border: '0.5px solid #2A2A30', color: '#8A8A82', letterSpacing: '0.06em' }}>v0.1.0</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#FEF3C7', color: '#B45309', letterSpacing: '0.06em' }}>DRAFT</span>
        <div style={{ flex: 1 }} />
        {saveStatus && <span style={{ fontSize: 11, color: '#52B788' }}>{saveStatus}</span>}
        {allQuestions.length > 0 && <button style={btn('#EEF2FF', '#6366F1', '0.5px solid #C7D2FE')} onClick={() => setShowAnswerPanel(true)}>✎ Answer {allQuestions.length} Questions</button>}
        <button style={btn('transparent', '#8A8A82')} onClick={downloadMarkdown}>↓ MD</button>
        <button style={btn('transparent', '#8A8A82')} onClick={downloadPDF}>↓ PDF</button>
        <div style={{ width: 1, height: 20, background: '#2A2A30' }} />
        <button style={btn('#FEF2F2', '#DC2626', '0.5px solid #FECACA')} onClick={() => setShowRejectModal(true)}>✕ Reject</button>
        <button style={btn('#8C00B4', '#fff')} onClick={handleApprove} disabled={approving}>{approving ? 'Saving…' : '✓ Approve & Lock'}</button>
        <button style={btn('transparent', '#8A8A82')} onClick={onClose}>✕</button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* TOC */}
        <div style={{ width: 256, flexShrink: 0, background: '#141417', borderRight: '0.5px solid #2A2A30', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px 8px', borderBottom: '0.5px solid #2A2A30' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#4A5568', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Contents</div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ marginTop: 8, width: '100%', padding: '6px 10px', background: '#1E1E22', border: '0.5px solid #2A2A30', borderRadius: 6, fontSize: 12, color: '#F1F5F9', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ padding: '8px 12px', borderBottom: '0.5px solid #2A2A30', display: 'flex', gap: 6 }}>
            {[['#52B788', complete, 'Done'], ['#D97706', needsInput, 'Input'], ['#DC2626', blocked, 'Blocked'], ['#8A8A82', totalGaps, 'Gaps']].map(([color, num, label]) => (
              <div key={String(label)} style={{ flex: 1, textAlign: 'center', background: '#1E1E22', borderRadius: 4, padding: '4px 2px' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: String(color), display: 'block' }}>{num}</span>
                <span style={{ fontSize: 9, color: '#4A5568', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {filteredSections.map(sec => (
              <div key={sec.id} onClick={() => scrollTo(sec.id)} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 14px', cursor: 'pointer', background: activeSection === sec.id ? 'rgba(140,0,180,0.12)' : 'transparent', borderLeft: activeSection === sec.id ? '2px solid #8C00B4' : '2px solid transparent' }}>
                <span style={{ fontSize: 10, color: '#4A5568', flexShrink: 0, marginTop: 2, minWidth: 18 }}>{sec.number}</span>
                <span style={{ fontSize: 11, color: activeSection === sec.id ? '#F1F5F9' : '#8B9DB5', fontWeight: activeSection === sec.id ? 600 : 400, lineHeight: 1.4, flex: 1 }}>{sec.title}</span>
                <VerdictDot verdict={sec.verdict} />
                {sec.gaps > 0 && <span style={{ fontSize: 9, color: '#DC2626', fontWeight: 700 }}>{sec.gaps}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#FAFAFA', padding: '36px 52px' }} ref={contentRef}>
          {/* Header card */}
          <div style={{ background: 'linear-gradient(135deg,#3D006B 0%,#8C00B4 50%,#C400FF 100%)', borderRadius: 12, padding: '28px 36px', marginBottom: 28, color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <img src="/assets/linup-icon.png" alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} />
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.6, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>LINUP · AI Co-Founder Platform</div>
                <div style={{ fontSize: 11, opacity: 0.5 }}>22-Agent Engineering Team</div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <img src="/assets/linup-wordmark-transparent.png" alt="LINUP" style={{ height: 18, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.6 }} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>{projectName}</div>
            <div style={{ fontSize: 14, opacity: 0.75, marginBottom: 4 }}>Product Specification Document</div>
            <div style={{ fontSize: 11, opacity: 0.5 }}>Version 0.1.0 · Draft · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              {[['Sections', sections.length, '#fff'], ['Complete', complete, '#52B788'], ['Gaps', totalGaps, '#F97316'], ['Questions', totalQuestions, '#C4B5FD']].map(([label, num, color]) => (
                <div key={String(label)} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 16px', textAlign: 'center' }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: String(color), display: 'block' }}>{num}</span>
                  <span style={{ fontSize: 10, opacity: 0.65, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sections */}
          {filteredSections.map(sec => (
            <div key={sec.id} ref={el => { sectionRefs.current[sec.id] = el; }} style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #E0E0DE', marginBottom: 14, overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', borderBottom: '0.5px solid #F4F4F2', display: 'flex', alignItems: 'center', gap: 8, background: sec.verdict === 'BLOCKED' ? '#FEF2F2' : sec.verdict === 'NEEDS_INPUT' ? '#FFFBEB' : sec.verdict === 'COMPLETE' ? '#F0FFF4' : '#FAFAFA' }}>
                {sec.number && <span style={{ fontSize: 10, fontWeight: 700, color: '#8C00B4', background: 'rgba(140,0,180,0.1)', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>{sec.number}</span>}
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A18', flex: 1 }}>{sec.title}</span>
                {sec.verdict !== 'UNKNOWN' && (
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999, letterSpacing: '0.06em', background: sec.verdict === 'COMPLETE' ? '#D8F3DC' : sec.verdict === 'NEEDS_INPUT' ? '#FEF3C7' : '#FEF2F2', color: sec.verdict === 'COMPLETE' ? '#2D6A4F' : sec.verdict === 'NEEDS_INPUT' ? '#B45309' : '#DC2626' }}>
                    {sec.verdict === 'COMPLETE' ? '✓ COMPLETE' : sec.verdict === 'NEEDS_INPUT' ? '⚠ NEEDS INPUT' : '✕ BLOCKED'}
                  </span>
                )}
                {sec.gaps > 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: '#FEF2F2', color: '#DC2626', letterSpacing: '0.06em' }}>{sec.gaps} GAP{sec.gaps !== 1 ? 'S' : ''}</span>}
              </div>
              <div style={{ padding: '14px 18px', fontSize: 13, color: '#1A1A18', lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: renderMarkdown(sec.content) }} />
            </div>
          ))}

          {/* Bottom approve bar */}
          <div style={{ marginTop: 28, padding: 20, background: '#fff', borderRadius: 10, border: '1.5px solid #8C00B4', display: 'flex', alignItems: 'center', gap: 14 }}>
            <img src="/assets/linup-icon.png" alt="" style={{ width: 26, height: 26 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A18' }}>Ready to lock this specification?</div>
              <div style={{ fontSize: 12, color: '#8A8A82', marginTop: 2 }}>Approving locks this document as the rulebook for all subsequent build stages.</div>
            </div>
            <button style={{ ...btn('#FEF2F2', '#DC2626', '0.5px solid #FECACA'), height: 36, padding: '0 16px', fontSize: 13 }} onClick={() => setShowRejectModal(true)}>✕ Reject &amp; Revise</button>
            <button style={{ ...btn('#8C00B4', '#fff'), height: 36, padding: '0 20px', fontSize: 13 }} onClick={handleApprove} disabled={approving}>{approving ? 'Saving…' : '✓ Approve & Lock'}</button>
          </div>
        </div>
      </div>

      {/* Answer questions panel */}
      {showAnswerPanel && allQuestions.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(12,12,14,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#141417', borderRadius: 12, border: '0.5px solid #2A2A30', padding: 28, width: 600, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <img src='/assets/linup-icon.png' alt='' style={{ width: 22, height: 22 }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9' }}>Answer Specification Questions</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#4A5568' }}>{Object.keys(questionAnswers).length}/{allQuestions.length} answered</span>
            </div>
            <p style={{ fontSize: 13, color: '#8B9DB5', lineHeight: 1.6, marginBottom: 16 }}>Your answers will be sent to the Engineering Team to revise the specification.</p>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {allQuestions.map((q: {id:string;text:string;section:string}) => (
                <div key={q.id} style={{ background: '#1E1E22', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 10, color: '#6366F1', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>{q.section}</div>
                  <div style={{ fontSize: 13, color: '#F1F5F9', marginBottom: 8, lineHeight: 1.5 }}>{q.text}</div>
                  <textarea value={questionAnswers[q.id] ?? ''} onChange={e => setQuestionAnswers(prev => ({ ...prev, [q.id]: e.target.value }))} placeholder='Your answer...' style={{ width: '100%', minHeight: 60, padding: '8px 10px', background: '#141417', border: '0.5px solid #2A2A30', borderRadius: 6, fontSize: 12, color: '#F1F5F9', resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button style={btn('transparent', '#8A8A82')} onClick={() => setShowAnswerPanel(false)}>Cancel</button>
              <button style={btn('#8C00B4', '#fff')} onClick={async () => {
                const answersText = allQuestions.map((q: {id:string;text:string;section:string}) => Q: \nA: ).join('\n\n');
                setShowAnswerPanel(false);
                setRejecting(true);
                await onReject('Please revise the specification addressing these answers:\n\n' + answersText);
                setRejecting(false);
              }}>Send to Engineering Team →</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(12,12,14,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#141417', borderRadius: 12, border: '0.5px solid #2A2A30', padding: 28, width: 500, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <img src="/assets/linup-icon.png" alt="" style={{ width: 22, height: 22 }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9' }}>Reject Specification</span>
            </div>
            <p style={{ fontSize: 13, color: '#8B9DB5', lineHeight: 1.6, marginBottom: 16 }}>The Engineering Team will revise the specification based on your feedback. Be specific about what needs to change.</p>
            <textarea value={rejectFeedback} onChange={e => setRejectFeedback(e.target.value)} placeholder="What needs to change? e.g. 'The data architecture is missing the payments entity. The security section needs specific OWASP controls for the API layer.'" autoFocus style={{ width: '100%', minHeight: 130, padding: '10px 12px', background: '#1E1E22', border: '0.5px solid #2A2A30', borderRadius: 8, fontSize: 13, color: '#F1F5F9', resize: 'vertical', fontFamily: "'Inter',sans-serif", outline: 'none', lineHeight: 1.6, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <button style={btn('transparent', '#8A8A82')} onClick={() => setShowRejectModal(false)}>Cancel</button>
              <button style={{ ...btn('#FEF2F2', '#DC2626', '0.5px solid #FECACA'), opacity: rejectFeedback.trim() ? 1 : 0.4 }} onClick={handleReject} disabled={!rejectFeedback.trim() || rejecting}>{rejecting ? 'Sending…' : '✕ Send to Engineering Team'}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .spec-code{background:#1A1A18;color:#F4F4F2;padding:10px 14px;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:12px;overflow-x:auto;margin:8px 0;white-space:pre}
        .spec-table{width:100%;border-collapse:collapse;margin:10px 0;font-size:12px}
        .spec-table td{border:1px solid #E0E0DE;padding:7px 10px;color:#1A1A18;vertical-align:top}
        .spec-table tr:first-child td{background:#F4F4F2;font-weight:600}
        .spec-hr{border:none;border-top:1px solid #E0E0DE;margin:14px 0}
        .spec-inline-code{font-family:'JetBrains Mono',monospace;font-size:11px;background:#F4F4F2;padding:1px 4px;border-radius:3px;color:#8C00B4}
        .spec-list{margin:6px 0 10px 18px}
        .spec-list li{margin-bottom:3px}
        .spec-gap{color:#DC2626;font-weight:700}
        .spec-question{background:#EEF2FF;border-left:3px solid #6366F1;padding:7px 12px;border-radius:0 6px 6px 0;margin:6px 0}
        .spec-q-label{font-size:9px;font-weight:700;color:#6366F1;letter-spacing:.08em;text-transform:uppercase;margin-right:6px}
        .spec-verdict{font-size:11px;font-weight:700;padding:3px 9px;border-radius:4px;display:inline-block;margin:3px 0;letter-spacing:.04em}
        .verdict-complete{background:#D8F3DC;color:#2D6A4F}
        .verdict-needs{background:#FEF3C7;color:#B45309}
        .verdict-blocked{background:#FEF2F2;color:#DC2626}
      `}</style>
    </div>
  );
}