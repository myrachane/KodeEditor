export type Activity = 'explorer' | 'search' | 'scm' | 'run' | 'extensions' | 'settings' | 'ai';

export type NodeType = 'file' | 'folder';

export interface FileNode {
  name: string;
  path: string;
  type: NodeType;
  children?: FileNode[];
  gitStatus?: string;
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  language: string;
  dirty?: boolean;
}

export interface WorkspaceSettings {
  autoSave: boolean;
  formatOnSave: boolean;
  wordWrap: boolean;
  tabSize: number;
  fontSize: number;
  fontFamily: string;
  theme: 'dark' | 'light' | 'custom';
}

export interface ProblemItem {
  severity: 'error' | 'warning';
  message: string;
  filePath: string;
  line: number;
}
