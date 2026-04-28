import React, { useState } from 'react';
import { DiffFile } from '../types/diff';

interface DiffViewerProps {
  files: DiffFile[];
  defaultFile?: string;
}

const DiffViewer: React.FC<DiffViewerProps> = ({ files, defaultFile }) => {
  const [selectedFile, setSelectedFile] = useState(defaultFile ?? (files[0]?.path ?? ''));
  const current = files.find(f => f.path === selectedFile);

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
      {/* File list */}
      <div style={{ width: 240, background: '#F9F9F8', borderRight: '1px solid #E4E4E0', overflowY: 'auto', flexShrink: 0 }}>
        {files.map(f => (
          <div key={f.path} onClick={() => setSelectedFile(f.path)}
            style={{
              padding: '8px 12px', cursor: 'pointer', wordBreak: 'break-all',
              background: selectedFile === f.path ? '#E8E8E4' : 'transparent',
              borderLeft: selectedFile === f.path ? '3px solid #1D4ED8' : '3px solid transparent',
              fontSize: 12,
            }}>
            📄 {f.path}
          </div>
        ))}
      </div>

      {/* Diff content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
        {current?.hunks.map((hunk, hi) => (
          <div key={hi} style={{ marginBottom: 16 }}>
            <div style={{ padding: '2px 12px', background: '#EFF6FF', color: '#1D4ED8', fontSize: 12 }}>
              {hunk.header}
            </div>
            {hunk.lines.map((line, li) => (
              <div key={li} style={{
                display: 'flex', gap: 8, padding: '1px 12px',
                background: line.type === 'added' ? '#DCFCE7' : line.type === 'removed' ? '#FEE2E2' : 'transparent',
              }}>
                <span style={{ minWidth: 36, color: '#9B9B96', userSelect: 'none', textAlign: 'right' }}>
                  {line.lineNum ?? ''}
                </span>
                <span style={{ color: line.type === 'added' ? '#16A34A' : line.type === 'removed' ? '#DC2626' : '#6B6B66' }}>
                  {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                </span>
                <span style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line.content}</span>
              </div>
            ))}
          </div>
        ))}
        {!current && <p style={{ padding: 16, color: '#6B6B66' }}>Select a file to view diff.</p>}
      </div>
    </div>
  );
};

export const DiffViewerDemo: React.FC = () => {
  const sampleFiles: DiffFile[] = [
    {
      path: 'src/commands/stage.rs',
      hunks: [
        {
          header: '@@ -1,5 +1,8 @@',
          lines: [
            { lineNum: 1, type: 'context',  content: 'use rusqlite::{Connection, params};' },
            { lineNum: 2, type: 'added',    content: 'use serde::{Serialize, Deserialize};' },
            { lineNum: 3, type: 'added',    content: 'use uuid::Uuid;' },
            { lineNum: 4, type: 'removed',  content: 'use old_crate::Thing;' },
            { lineNum: 5, type: 'context',  content: '' },
          ],
        },
      ],
    },
    {
      path: 'src/components/BudgetBar.tsx',
      hunks: [
        {
          header: '@@ -10,4 +10,6 @@',
          lines: [
            { lineNum: 10, type: 'context', content: 'const BudgetBar = () => {' },
            { lineNum: 11, type: 'added',   content: '  const [open, setOpen] = useState(false);' },
            { lineNum: 12, type: 'context', content: '  return <div />;' },
          ],
        },
      ],
    },
  ];
  return (
    <div style={{ height: 500, border: '1px solid #E4E4E0', borderRadius: 8, overflow: 'hidden' }}>
      <DiffViewer files={sampleFiles} defaultFile="src/commands/stage.rs" />
    </div>
  );
};

export default DiffViewer;