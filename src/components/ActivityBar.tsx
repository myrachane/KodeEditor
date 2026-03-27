import clsx from 'clsx';
import type { Activity } from '../types/ide';

const items: Array<{ id: Activity; label: string; icon: string }> = [
  { id: 'explorer', label: 'Explorer', icon: '📁' },
  { id: 'search', label: 'Search', icon: '🔎' },
  { id: 'scm', label: 'Source Control', icon: '🌿' },
  { id: 'run', label: 'Run & Debug', icon: '▶' },
  { id: 'extensions', label: 'Extensions', icon: '🧩' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
  { id: 'ai', label: 'AI', icon: '✨' },
];

interface ActivityBarProps {
  active: Activity;
  onChange: (activity: Activity) => void;
}

export const ActivityBar = ({ active, onChange }: ActivityBarProps) => {
  return (
    <aside className="glass w-14 border-r border-[#30363d] flex flex-col items-center py-3 gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          title={item.label}
          onClick={() => onChange(item.id)}
          className={clsx(
            'h-10 w-10 rounded-xl2 transition-all duration-150 border',
            active === item.id
              ? 'bg-[#1f6feb] text-white border-[#58a6ff] shadow-glass'
              : 'bg-transparent border-transparent hover:bg-[#21262d] text-[#8b949e]'
          )}
        >
          {item.icon}
        </button>
      ))}
    </aside>
  );
};
