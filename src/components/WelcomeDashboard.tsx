interface WelcomeDashboardProps {
  recent: string[];
  onOpenWorkspace: () => void;
  onOpenRecent: (path: string) => void;
}

export const WelcomeDashboard = ({ recent, onOpenWorkspace, onOpenRecent }: WelcomeDashboardProps) => {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <h1 className="text-3xl font-semibold text-[#e6edf3]">Visrodeck Studio 2026</h1>
      <p className="text-[#8b949e] mt-3 max-w-2xl">
        Premium cloud-ready web IDE with Monaco engine, collaboration, AI assistance, autosave and workspace intelligence.
      </p>
      <button
        className="mt-6 h-11 px-5 rounded-xl2 bg-[#1f6feb] text-white hover:bg-[#388bfd]"
        onClick={onOpenWorkspace}
      >
        Open Workspace
      </button>
      <div className="mt-8 w-full max-w-xl text-left">
        <p className="text-xs uppercase tracking-wider text-[#8b949e] mb-2">Recent Projects</p>
        <div className="space-y-2">
          {recent.map((path) => (
            <button
              key={path}
              className="w-full h-10 px-3 rounded-xl2 bg-[#161b22] hover:bg-[#21262d] text-xs text-left truncate"
              onClick={() => onOpenRecent(path)}
            >
              {path}
            </button>
          ))}
          {recent.length === 0 ? <p className="text-xs text-[#8b949e]">No recent projects yet.</p> : null}
        </div>
      </div>
    </div>
  );
};
