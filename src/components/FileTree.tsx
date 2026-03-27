import { useMemo, useState } from 'react';
import type { FileNode } from '../types/ide';

interface FileTreeProps {
  root: FileNode | null;
  activePath: string | null;
  onOpenFile: (path: string) => void;
  onCreate: (parentPath: string, type: 'file' | 'folder') => void;
  onRename: (targetPath: string) => void;
  onDelete: (targetPath: string) => void;
  gitChanged: Set<string>;
}

export const FileTree = ({
  root,
  activePath,
  onOpenFile,
  onCreate,
  onRename,
  onDelete,
  gitChanged,
}: FileTreeProps) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (path: string) => setExpanded((prev) => ({ ...prev, [path]: !prev[path] }));

  const renderNode = (node: FileNode, depth = 0) => {
    const isFolder = node.type === 'folder';
    const isOpen = expanded[node.path] ?? depth < 2;
    const isChanged = gitChanged.has(node.path);

    return (
      <div key={node.path}>
        <div
          className={`h-8 text-xs flex items-center gap-2 px-2 rounded-xl2 cursor-pointer hover:bg-[#21262d] ${
            activePath === node.path ? 'bg-[#1f2937]' : ''
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (isFolder) {
              toggle(node.path);
              return;
            }
            onOpenFile(node.path);
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            const action = window.prompt('Action: new-file | new-folder | rename | delete');
            if (action === 'new-file') onCreate(node.path, 'file');
            if (action === 'new-folder') onCreate(node.path, 'folder');
            if (action === 'rename') onRename(node.path);
            if (action === 'delete') onDelete(node.path);
          }}
        >
          <span className="w-4 text-center">{isFolder ? (isOpen ? '▾' : '▸') : '•'}</span>
          <span className="truncate">{node.name}</span>
          {isChanged ? <span className="text-[#58a6ff]">●</span> : null}
        </div>
        {isFolder && isOpen && node.children?.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  const content = useMemo(() => {
    if (!root) return <p className="text-xs text-[#8b949e] px-3 py-4">No workspace selected.</p>;
    return renderNode(root);
  }, [root, activePath, expanded, gitChanged]);

  return (
    <div className="h-full overflow-auto scrollbar px-1 py-2">
      {content}
    </div>
  );
};
