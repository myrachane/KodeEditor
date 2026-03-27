import { useEffect, useMemo, useState } from 'react';

interface Command {
  id: string;
  label: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}

export const CommandPalette = ({ open, onClose, commands }: CommandPaletteProps) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return commands;
    return commands.filter((command) => command.label.toLowerCase().includes(q));
  }, [commands, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20" onClick={onClose}>
      <div className="glass w-[680px] border border-[#30363d] rounded-xl2 shadow-glass" onClick={(event) => event.stopPropagation()}>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full h-12 bg-transparent border-b border-[#30363d] px-4 text-sm outline-none"
          placeholder="Type a command..."
        />
        <div className="max-h-80 overflow-auto scrollbar py-2">
          {filtered.map((command) => (
            <button
              key={command.id}
              className="w-full h-10 px-4 text-left text-sm hover:bg-[#21262d]"
              onClick={() => {
                command.run();
                onClose();
              }}
            >
              {command.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
