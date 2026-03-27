import { useEffect, useMemo, useState } from 'react';
import { ActivityBar } from './components/ActivityBar';
import { AiAssistantPanel } from './components/AiAssistantPanel';
import { BottomPanel } from './components/BottomPanel';
import { CommandPalette } from './components/CommandPalette';
import { EditorPane } from './components/EditorPane';
import { FileTree } from './components/FileTree';
import { StatusBar } from './components/StatusBar';
import { TabsBar } from './components/TabsBar';
import { WelcomeDashboard } from './components/WelcomeDashboard';
import { useDebounce } from './hooks/useDebounce';
import { api } from './lib/api';
import { socket } from './lib/socket';
import type { Activity, FileNode, OpenFile, ProblemItem, WorkspaceSettings } from './types/ide';

const defaultSettings: WorkspaceSettings = {
  autoSave: true,
  formatOnSave: false,
  wordWrap: false,
  tabSize: 2,
  fontSize: 14,
  fontFamily: 'JetBrains Mono',
  theme: 'dark',
};

const detectLanguage = (path: string) => {
  const ext = path.split('.').pop()?.toLowerCase();
  if (!ext) return 'plaintext';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    html: 'html',
    css: 'css',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    sh: 'shell',
  };
  return map[ext] ?? 'plaintext';
};

const flattenFiles = (node: FileNode): FileNode[] => {
  if (node.type === 'file') return [node];
  return (node.children ?? []).flatMap(flattenFiles);
};

const App = () => {
  const [activity, setActivity] = useState<Activity>('explorer');
  const [workspacePath, setWorkspacePath] = useState('');
  const [rootNode, setRootNode] = useState<FileNode | null>(null);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [line, setLine] = useState(1);
  const [column, setColumn] = useState(1);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [branch, setBranch] = useState('no-git');
  const [gitChanged, setGitChanged] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<WorkspaceSettings>(() => {
    const cached = localStorage.getItem('visrodeck:settings');
    return cached ? { ...defaultSettings, ...JSON.parse(cached) } : defaultSettings;
  });
  const [recent, setRecent] = useState<string[]>(() => JSON.parse(localStorage.getItem('visrodeck:recent') ?? '[]'));
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ path: string; line: number; text: string }>>([]);
  const [zenMode, setZenMode] = useState(false);

  const activeFile = openFiles.find((item) => item.path === activePath) ?? null;
  const debouncedContent = useDebounce(activeFile?.content ?? '', 500);
  const debouncedSearch = useDebounce(searchQuery, 250);

  useEffect(() => {
    localStorage.setItem('visrodeck:settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('visrodeck:recent', JSON.stringify(recent.slice(0, 8)));
  }, [recent]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setActivity('search');
      }
      if (event.key === 'F11') {
        event.preventDefault();
        document.documentElement.requestFullscreen?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!workspacePath || !debouncedSearch.trim()) {
      setSearchResults([]);
      return;
    }
    api.search(workspacePath, debouncedSearch).then((res) => setSearchResults(res.results)).catch(() => setSearchResults([]));
  }, [debouncedSearch, workspacePath]);

  useEffect(() => {
    if (!activeFile || !settings.autoSave) return;
    api.writeFile(activeFile.path, debouncedContent).catch(() => null);
    socket.emit('file:change', { filePath: activeFile.path, content: debouncedContent });
  }, [debouncedContent, activeFile?.path, settings.autoSave]);

  useEffect(() => {
    if (!workspacePath) return;
    const interval = setInterval(() => {
      api.gitStatus(workspacePath)
        .then((res) => {
          setBranch(res.branch || 'detached');
          setGitChanged(new Set(res.changed));
        })
        .catch(() => {
          setBranch('no-git');
          setGitChanged(new Set());
        });
    }, 2000);
    return () => clearInterval(interval);
  }, [workspacePath]);

  useEffect(() => {
    const onRemote = ({ filePath, content }: { filePath: string; content: string }) => {
      setOpenFiles((prev) => prev.map((file) => (file.path === filePath ? { ...file, content } : file)));
    };
    socket.on('file:remote-change', onRemote);
    return () => {
      socket.off('file:remote-change', onRemote);
    };
  }, []);

  const openWorkspace = async (initialPath?: string) => {
    const selected = initialPath ?? window.prompt('Enter workspace absolute path') ?? '';
    if (!selected) return;
    const response = await api.openWorkspace(selected);
    setWorkspacePath(selected);
    setRootNode(response.root);
    setOpenFiles([]);
    setActivePath(null);
    setRecent((prev) => [selected, ...prev.filter((entry) => entry !== selected)]);
  };

  const refreshTree = async () => {
    if (!workspacePath) return;
    const response = await api.getTree(workspacePath);
    setRootNode(response.root);
  };

  const openFile = async (path: string) => {
    const existing = openFiles.find((item) => item.path === path);
    if (existing) {
      setActivePath(existing.path);
      socket.emit('file:join', path);
      return;
    }
    const response = await api.readFile(path);
    const file: OpenFile = {
      path,
      name: path.split('/').pop() ?? path,
      content: response.content,
      language: response.language || detectLanguage(path),
      dirty: false,
    };
    setOpenFiles((prev) => [...prev, file]);
    setActivePath(path);
    socket.emit('file:join', path);
  };

  const updateActiveContent = (content: string) => {
    if (!activePath) return;
    setOpenFiles((prev) => prev.map((item) => (item.path === activePath ? { ...item, content, dirty: true } : item)));
  };

  const closeTab = (path: string) => {
    setOpenFiles((prev) => {
      const next = prev.filter((item) => item.path !== path);
      if (activePath === path) setActivePath(next.at(-1)?.path ?? null);
      return next;
    });
  };

  const createNode = async (parentPath: string, nodeType: 'file' | 'folder') => {
    const name = window.prompt(`Enter ${nodeType} name`);
    if (!name) return;
    await api.createNode(parentPath, name, nodeType);
    await refreshTree();
  };

  const renameNode = async (targetPath: string) => {
    const name = window.prompt('Enter new name');
    if (!name) return;
    const parts = targetPath.split('/');
    parts[parts.length - 1] = name;
    await api.renameNode(targetPath, parts.join('/'));
    await refreshTree();
  };

  const deleteNode = async (targetPath: string) => {
    const ok = window.confirm(`Delete ${targetPath}?`);
    if (!ok) return;
    await api.deleteNode(targetPath);
    await refreshTree();
    closeTab(targetPath);
  };

  const allProblems: ProblemItem[] = useMemo(() => {
    const issues: ProblemItem[] = [];
    for (const file of openFiles) {
      file.content.split('\n').forEach((lineText, index) => {
        if (lineText.includes('TODO')) issues.push({ severity: 'warning', message: 'Pending TODO', filePath: file.path, line: index + 1 });
        if (lineText.includes('FIXME')) issues.push({ severity: 'error', message: 'Fixme marker found', filePath: file.path, line: index + 1 });
      });
    }
    return issues;
  }, [openFiles]);

  const commands = [
    { id: 'open', label: 'Workspace: Open Folder', run: () => openWorkspace() },
    { id: 'autosave', label: `Toggle Auto Save (${settings.autoSave ? 'On' : 'Off'})`, run: () => setSettings((prev) => ({ ...prev, autoSave: !prev.autoSave })) },
    { id: 'wrap', label: `Toggle Word Wrap (${settings.wordWrap ? 'On' : 'Off'})`, run: () => setSettings((prev) => ({ ...prev, wordWrap: !prev.wordWrap })) },
    { id: 'zen', label: `Toggle Zen Mode (${zenMode ? 'On' : 'Off'})`, run: () => setZenMode((prev) => !prev) },
    { id: 'theme', label: 'Switch Theme (Dark/Light)', run: () => setSettings((prev) => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' })) },
    { id: 'sync', label: 'Cloud Sync Workspace', run: () => api.syncCloud({ workspacePath, files: flattenFiles(rootNode as FileNode) }) },
  ];

  return (
    <div className={`h-full w-full flex ${settings.theme === 'light' ? 'bg-white text-black' : 'bg-[#0d1117] text-[#c9d1d9]'}`}>
      <ActivityBar active={activity} onChange={setActivity} />

      {!zenMode && sidebarOpen ? (
        <aside className="glass w-[290px] border-r border-[#30363d] flex flex-col">
          <div className="h-11 px-3 border-b border-[#30363d] flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-[#8b949e]">{activity}</p>
            <button className="text-xs text-[#8b949e] hover:text-[#e6edf3]" onClick={() => setSidebarOpen(false)}>
              hide
            </button>
          </div>

          {activity === 'explorer' ? (
            <FileTree
              root={rootNode}
              activePath={activePath}
              onOpenFile={openFile}
              onCreate={createNode}
              onRename={renameNode}
              onDelete={deleteNode}
              gitChanged={gitChanged}
            />
          ) : null}

          {activity === 'search' ? (
            <div className="p-2 text-xs flex flex-col gap-2">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-9 rounded-xl2 border border-[#30363d] bg-[#0d1117] px-2 outline-none"
                placeholder="Search in workspace..."
              />
              <div className="overflow-auto scrollbar space-y-1">
                {searchResults.map((entry, idx) => (
                  <button key={`${entry.path}-${idx}`} className="w-full rounded-xl2 text-left p-2 bg-[#161b22] hover:bg-[#21262d]" onClick={() => openFile(entry.path)}>
                    <p className="truncate">{entry.path}:{entry.line}</p>
                    <p className="truncate text-[#8b949e]">{entry.text}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {activity === 'settings' ? (
            <div className="p-3 text-xs space-y-3">
              <label className="flex items-center justify-between">Auto Save
                <input type="checkbox" checked={settings.autoSave} onChange={() => setSettings((prev) => ({ ...prev, autoSave: !prev.autoSave }))} />
              </label>
              <label className="flex items-center justify-between">Word Wrap
                <input type="checkbox" checked={settings.wordWrap} onChange={() => setSettings((prev) => ({ ...prev, wordWrap: !prev.wordWrap }))} />
              </label>
              <label className="block">Font Size
                <input type="range" min={12} max={22} value={settings.fontSize} onChange={(event) => setSettings((prev) => ({ ...prev, fontSize: Number(event.target.value) }))} className="w-full" />
              </label>
              <label className="block">Tab Size
                <input type="number" min={2} max={8} value={settings.tabSize} onChange={(event) => setSettings((prev) => ({ ...prev, tabSize: Number(event.target.value) || 2 }))} className="w-full h-9 mt-1 rounded-xl2 border border-[#30363d] bg-[#0d1117] px-2" />
              </label>
            </div>
          ) : null}

          {activity === 'scm' ? <div className="p-3 text-xs">Branch: {branch}<br />Changed Files: {gitChanged.size}</div> : null}
          {activity === 'extensions' ? <div className="p-3 text-xs">Extension marketplace scaffold ready (connect API providers).</div> : null}
          {activity === 'run' ? <div className="p-3 text-xs">Use terminal panel to run build/test/debug tasks.</div> : null}
          {activity === 'ai' ? <div className="p-3 text-xs">Open AI pane on right side for code analysis.</div> : null}
        </aside>
      ) : null}

      <main className="flex-1 min-w-0 flex flex-col">
        <div className="h-11 px-3 border-b border-[#30363d] glass flex items-center justify-between">
          <div className="text-xs truncate">{workspacePath || 'No workspace loaded'}</div>
          <div className="flex items-center gap-2">
            <button className="h-8 px-3 rounded-xl2 bg-[#21262d] text-xs" onClick={() => setSidebarOpen((prev) => !prev)}>
              {sidebarOpen ? 'Sidebar Off' : 'Sidebar On'}
            </button>
            <button className="h-8 px-3 rounded-xl2 bg-[#21262d] text-xs" onClick={() => setZenMode((prev) => !prev)}>
              Zen
            </button>
            <button className="h-8 px-3 rounded-xl2 bg-[#1f6feb] text-xs" onClick={() => openWorkspace()}>
              Browse
            </button>
          </div>
        </div>

        {workspacePath ? (
          <>
            <TabsBar files={openFiles} activePath={activePath} onSelect={setActivePath} onClose={closeTab} />
            <div className="flex-1 min-h-0 flex">
              <section className="flex-1 min-w-0">
                {activeFile ? (
                  <EditorPane
                    value={activeFile.content}
                    language={activeFile.language}
                    settings={settings}
                    onChange={updateActiveContent}
                    onCursor={(nextLine, nextColumn) => {
                      setLine(nextLine);
                      setColumn(nextColumn);
                    }}
                  />
                ) : (
                  <WelcomeDashboard recent={recent} onOpenWorkspace={openWorkspace} onOpenRecent={(path) => openWorkspace(path)} />
                )}
              </section>

              {activity === 'ai' ? <AiAssistantPanel code={activeFile?.content ?? ''} /> : null}
            </div>
            <BottomPanel problems={allProblems} />
          </>
        ) : (
          <WelcomeDashboard recent={recent} onOpenWorkspace={openWorkspace} onOpenRecent={(path) => openWorkspace(path)} />
        )}

        <StatusBar
          line={line}
          column={column}
          language={activeFile?.language ?? 'plaintext'}
          branch={branch}
          errors={allProblems.filter((item) => item.severity === 'error').length}
          warnings={allProblems.filter((item) => item.severity === 'warning').length}
          live={Boolean(workspacePath)}
        />
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
    </div>
  );
};

export default App;
