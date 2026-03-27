import clsx from 'clsx';
import type { OpenFile } from '../types/ide';

interface TabsBarProps {
  files: OpenFile[];
  activePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}

export const TabsBar = ({ files, activePath, onSelect, onClose }: TabsBarProps) => {
  return (
    <div className="h-11 border-b border-[#30363d] bg-[#0f1722] flex items-end overflow-x-auto scrollbar">
      {files.map((file) => (
        <button
          key={file.path}
          className={clsx(
            'h-10 min-w-[180px] max-w-[280px] px-3 text-xs border-r border-[#30363d] flex items-center justify-between gap-3',
            activePath === file.path ? 'bg-[#161b22] text-[#e6edf3]' : 'bg-[#0d1117] text-[#8b949e] hover:bg-[#161b22]'
          )}
          onClick={() => onSelect(file.path)}
        >
          <span className="truncate">{file.name}{file.dirty ? ' •' : ''}</span>
          <span
            className="text-[#8b949e] hover:text-[#e6edf3]"
            onClick={(event) => {
              event.stopPropagation();
              onClose(file.path);
            }}
          >
            ×
          </span>
        </button>
      ))}
    </div>
  );
};
