import { useEffect, useMemo, useState } from 'react';
import type { ProblemItem } from '../types/ide';
import { socket } from '../lib/socket';

type PanelTab = 'terminal' | 'problems' | 'output' | 'debug';

interface BottomPanelProps {
  problems: ProblemItem[];
}

export const BottomPanel = ({ problems }: BottomPanelProps) => {
  const [tab, setTab] = useState<PanelTab>('terminal');
  const [command, setCommand] = useState('');
  const [terminalLines, setTerminalLines] = useState<string[]>(['Terminal ready.']);
  const [height, setHeight] = useState(220);

  useEffect(() => {
    const onOut = (line: string) => setTerminalLines((prev) => [...prev.slice(-300), line]);
    socket.on('terminal:out', onOut);
    return () => {
      socket.off('terminal:out', onOut);
    };
  }, []);

  const runCommand = () => {
    if (!command.trim()) return;
    socket.emit('terminal:run', command.trim());
    setCommand('');
    setTab('terminal');
  };

  const header = useMemo(
    () => [
      { id: 'terminal', label: 'Terminal' },
      { id: 'problems', label: `Problems (${problems.length})` },
      { id: 'output', label: 'Output' },
      { id: 'debug', label: 'Debug Console' },
    ] as Array<{ id: PanelTab; label: string }>,
    [problems.length]
  );

  return (
    <section className="border-t border-[#30363d] bg-[#0d1117]" style={{ height }}>
      <div
        className="h-1 cursor-row-resize bg-[#1f6feb]/40"
        onMouseDown={(event) => {
          const startY = event.clientY;
          const startHeight = height;
          const onMove = (moveEvent: MouseEvent) => {
            const next = startHeight - (moveEvent.clientY - startY);
            setHeight(Math.max(140, Math.min(420, next)));
          };
          const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
          };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}
      />
      <div className="h-9 px-2 border-b border-[#30363d] flex items-center gap-1">
        {header.map((entry) => (
          <button
            key={entry.id}
            className={`h-7 px-3 rounded-xl2 text-xs ${tab === entry.id ? 'bg-[#1f6feb] text-white' : 'text-[#8b949e] hover:bg-[#21262d]'}`}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="h-[calc(100%-40px)] p-2">
        {tab === 'terminal' ? (
          <div className="h-full flex flex-col gap-2">
            <div className="h-9 flex gap-2">
              <input
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') runCommand();
                }}
                className="flex-1 bg-[#161b22] border border-[#30363d] rounded-xl2 px-3 text-xs outline-none"
                placeholder="Run command (e.g. npm run build)"
              />
              <button className="px-4 rounded-xl2 bg-[#1f6feb] text-xs" onClick={runCommand}>
                Run
              </button>
            </div>
            <div className="flex-1 overflow-auto scrollbar bg-black/30 border border-[#30363d] rounded-xl2 p-2 text-xs whitespace-pre-wrap">
              {terminalLines.join('\n')}
            </div>
          </div>
        ) : null}

        {tab === 'problems' ? (
          <div className="h-full overflow-auto scrollbar text-xs">
            {problems.map((problem, index) => (
              <div key={`${problem.filePath}-${index}`} className="h-8 px-2 flex items-center gap-3 border-b border-[#21262d]">
                <span className={problem.severity === 'error' ? 'text-red-400' : 'text-yellow-300'}>
                  {problem.severity.toUpperCase()}
                </span>
                <span className="truncate">{problem.message}</span>
                <span className="text-[#8b949e] ml-auto truncate">{problem.filePath}:{problem.line}</span>
              </div>
            ))}
            {problems.length === 0 ? <p className="p-3 text-[#8b949e]">No issues detected.</p> : null}
          </div>
        ) : null}

        {tab === 'output' ? <div className="text-xs text-[#8b949e] p-2">Build and runtime logs will appear here.</div> : null}
        {tab === 'debug' ? <div className="text-xs text-[#8b949e] p-2">Debugger session stream ready.</div> : null}
      </div>
    </section>
  );
};
