export interface DiffLine {
  lineNum?: number;
  type: 'added' | 'removed' | 'context';
  content: string;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface DiffFile {
  path: string;
  hunks: DiffHunk[];
}