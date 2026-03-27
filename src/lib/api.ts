import type { FileNode } from '../types/ide';

const json = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
};

export const api = {
  health: () => json<{ ok: boolean }>('/api/health'),
  openWorkspace: (workspacePath: string) => json<{ root: FileNode }>('/api/workspace/open', {
    method: 'POST',
    body: JSON.stringify({ workspacePath }),
  }),
  getTree: (workspacePath: string) =>
    json<{ root: FileNode }>(`/api/workspace/tree?workspacePath=${encodeURIComponent(workspacePath)}`),
  readFile: (filePath: string) =>
    json<{ content: string; language: string }>(`/api/workspace/file?filePath=${encodeURIComponent(filePath)}`),
  writeFile: (filePath: string, content: string) =>
    json<{ ok: boolean }>('/api/workspace/file', {
      method: 'PUT',
      body: JSON.stringify({ filePath, content }),
    }),
  createNode: (parentPath: string, name: string, nodeType: 'file' | 'folder') =>
    json<{ ok: boolean; path: string }>('/api/workspace/node', {
      method: 'POST',
      body: JSON.stringify({ parentPath, name, nodeType }),
    }),
  renameNode: (oldPath: string, newPath: string) =>
    json<{ ok: boolean }>('/api/workspace/node', {
      method: 'PATCH',
      body: JSON.stringify({ oldPath, newPath }),
    }),
  deleteNode: (targetPath: string) =>
    json<{ ok: boolean }>(`/api/workspace/node?targetPath=${encodeURIComponent(targetPath)}`, {
      method: 'DELETE',
    }),
  search: (workspacePath: string, query: string) =>
    json<{ results: Array<{ path: string; line: number; text: string }> }>(
      `/api/search?workspacePath=${encodeURIComponent(workspacePath)}&query=${encodeURIComponent(query)}`
    ),
  gitStatus: (workspacePath: string) =>
    json<{ branch: string; changed: string[] }>(
      `/api/git/status?workspacePath=${encodeURIComponent(workspacePath)}`
    ),
  syncCloud: (payload: unknown) =>
    json<{ ok: boolean }>('/api/cloud/sync', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
