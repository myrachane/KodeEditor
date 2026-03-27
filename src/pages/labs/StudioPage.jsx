// src/pages/labs/StudioPage.jsx — Phase 4 COMPLETE
// Multi-tab terminal · Settings · Jane AI · Node graph · Extensions · Interpreters

import { Component, useEffect, useRef, useState, useCallback, useMemo, lazy, Suspense } from "react";
import Editor from "@monaco-editor/react";
import FileExplorer  from "./FileExplorer";
import ContextMenu   from "./ContextMenu";
import TitleBar      from "./TitleBar";
import WorkspaceSetup from "./WorkspaceSetup";
import MultiTerminal from "./MultiTerminal";
import { isDesktopBridge, studioBridge } from "../../ide/core/bridge";

const MapPanel = lazy(() => import("./MapPanel"));
const SettingsPanel = lazy(() => import("./SettingsPanel"));
const JanePanel = lazy(() => import("./JanePanel"));
import SearchPanel from "../../ide/panels/SearchPanel";
import ScmPanel from "../../ide/panels/ScmPanel";
import { registerCommand, executeCommand, unregisterCommand } from "../../ide/core/commands";
import { registerKeybinding, handleKeyEvent, unregisterKeybinding } from "../../ide/core/keybindings";
import { registerBuiltInExtensions, getAllExtensions, isActivated, activateExtension } from "../../ide/core/extensions";
import {
  AUTH_KEY,
  DEFAULT_SETTINGS,
  EXT_INTERP,
  GUEST_MODE_KEY,
  SETTINGS_KEY,
  buildRiskProfile,
  flattenTree,
  getLang,
} from "../../ide/config/settings";

const s = studioBridge;

function AuthGate({ guestModeEnabled, onSetGuestModeEnabled, onAuth }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password.trim()) {
      setError("Email and password are required.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Name is required for signup.");
      return;
    }
    setError("");
    onAuth?.({
      type: "account",
      user: {
        name: mode === "signup" ? name.trim() : (name.trim() || cleanEmail.split("@")[0] || "User"),
        email: cleanEmail,
        tier: "free",
      },
      signedAt: Date.now(),
    });
  };

  return (
    <>
      <style>{AUTH_CSS}</style>
      <div className="auth-root">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="auth-logo">VISRODECK</span>
            <span className="auth-sep">/</span>
            <span className="auth-sub">CLOUD IDE</span>
          </div>
          <h1 className="auth-title">{mode === "login" ? "Sign in to continue" : "Create your account"}</h1>
          <p className="auth-desc">Workspace access is protected. Sign in or use guest mode.</p>

          {mode === "signup" && (
            <input
              className="auth-input"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <input
            className="auth-input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />

          {error && <div className="auth-error">{error}</div>}

          <div className="auth-actions">
            <button className="auth-primary" onClick={submit}>
              {mode === "login" ? "Sign In" : "Sign Up"}
            </button>
            <button className="auth-secondary" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
              {mode === "login" ? "Create account" : "Use existing account"}
            </button>
          </div>

          <div className="auth-guest-row">
            <label className="auth-checkbox">
              <input
                type="checkbox"
                checked={guestModeEnabled}
                onChange={(e) => onSetGuestModeEnabled?.(e.target.checked)}
              />
              <span>Allow Guest Mode</span>
            </label>
            <button
              className="auth-guest-btn"
              onClick={() => onAuth?.({ type: "guest", signedAt: Date.now() })}
              disabled={!guestModeEnabled}
            >
              Continue as Guest
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

class MapErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "Map render failed" };
  }
  componentDidCatch(error) {
    console.error("[studio] Map panel crashed:", error);
  }
  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, message: "" });
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: 280,
          flexShrink: 0,
          borderLeft: "1px solid #2a3442",
          background: "linear-gradient(180deg,#121925,#0e131c)",
          color: "#c8d2df",
          fontFamily: "'JetBrains Mono', monospace",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 14,
          fontSize: 11,
          textAlign: "center",
        }}>
          Map temporarily disabled for stability.<br />
          <button
            onClick={() => {
              this.setState({ hasError: false, message: "" });
              this.props.onRetry?.();
            }}
            style={{
              marginTop: 10,
              height: 26,
              padding: "0 10px",
              background: "#1a2230",
              border: "1px solid #2a3442",
              borderRadius: 4,
              color: "#d3dceb",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              cursor: "pointer",
            }}
          >
            Retry Map
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Editor pane ───────────────────────────────────────────────
function EditorArea({ openFiles, activeFile, onChange, onClose, onSelect, settings, onGhostSelection, onUnghost, onValidate, onEditorMount }) {
  if (!activeFile) return (
    <div className="ea-empty">
      <div className="ea-empty-in">
        <span className="ea-empty-icon">[ ]</span>
        <p>Open a file from the explorer</p>
        <small>Right-click to create files &amp; folders</small>
      </div>
    </div>
  );
  return (
    <div className="ea-pane">
      <div className="ea-tabs">
        {openFiles.map(f => (
          <div key={f.path} className={`ea-tab${activeFile.path===f.path?" on":""}`}
            onClick={() => onSelect(f)}>
            <span className="ea-tab-name">{f.name}</span>
            {f.dirty && <span className="ea-tab-dot">●</span>}
            <span className="ea-tab-x"
              onClick={e => { e.stopPropagation(); onClose(f); }}>×</span>
          </div>
        ))}
      </div>
      <div className="ea-wrap">
        <Editor
          key={activeFile.path}
          defaultLanguage={getLang(activeFile.name)}
          value={activeFile.content ?? ""}
          onChange={v => onChange(activeFile.path, v ?? "")}
          onValidate={(markers) => onValidate?.(activeFile.path, activeFile.name, markers)}
          onMount={(editor, monaco) => {
            onEditorMount?.(editor, monaco);
            editor.addAction({
              id: "visrodeck-ghost-it",
              label: "Ghost it",
              contextMenuGroupId: "navigation",
              contextMenuOrder: 1.5,
              run: () => {
                const model = editor.getModel();
                const selection = editor.getSelection();
                if (!model || !selection || selection.isEmpty()) return;
                const selected = model.getValueInRange(selection);
                onGhostSelection?.(selected, selection);
              },
            });
            editor.addAction({
              id: "visrodeck-unghost",
              label: "Unghost (remove ghost blocks)",
              contextMenuGroupId: "navigation",
              contextMenuOrder: 1.6,
              run: () => onUnghost?.(),
            });
          }}
          theme={settings.theme === "light" ? "light" : "vs-dark"}
          options={{
            fontFamily: `"${settings.fontFamily}","Fira Code",monospace`,
            fontSize:   settings.fontSize,
            lineHeight: settings.lineHeight,
            minimap:    { enabled: settings.minimap },
            wordWrap:   settings.wordWrap ? "on" : "off",
            lineNumbers:settings.lineNumbers ? "on" : "off",
            scrollBeyondLastLine: false,
            padding:    { top: 16, bottom: 16 },
            renderLineHighlight: "gutter",
            cursorBlinking: settings.cursorBlink ? "smooth" : "solid",
            cursorStyle: settings.cursorStyle,
            smoothScrolling: settings.smoothScroll,
            bracketPairColorization: { enabled: settings.bracketPairs },
            tabSize: settings.tabSize,
            overviewRulerBorder: false,
          }}
        />
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function StudioPage() {
  const [workspace,   setWorkspace]   = useState(null);
  const [showSetup,   setShowSetup]   = useState(true);
  const [tree,        setTree]        = useState([]);
  const [openFiles,   setOpenFiles]   = useState([]);
  const [activeFile,  setActiveFile]  = useState(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [rightOpenFiles, setRightOpenFiles] = useState([]);
  const [rightActiveFile, setRightActiveFile] = useState(null);
  const [focusPane, setFocusPane] = useState("left"); // left | right
  const [isRunning,   setIsRunning]   = useState(false);
  const [outputLines, setOutputLines] = useState([]);
  const [debugLines,  setDebugLines]  = useState([]);
  const [ctxMenu,     setCtxMenu]     = useState(null);
  const [mapOpen,     setMapOpen]     = useState(false);
  const [showSettings,setShowSettings]= useState(false);
  const [showJane,    setShowJane]    = useState(false);
  const [settings,    setSettings]    = useState(DEFAULT_SETTINGS);
  const [activeRunInterpreter, setActiveRunInterpreter] = useState("auto");
  const [showExplorer, setShowExplorer] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);
  const [leftMode, setLeftMode] = useState("explorer"); // explorer | search | scm | extensions
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const [mapResetToken, setMapResetToken] = useState(0);
  const [gitInfo, setGitInfo] = useState({ branch: "no-git", changed: 0, ahead: 0, behind: 0 });
  const [problems, setProblems] = useState([]);
  const [depStatus, setDepStatus] = useState({ alerts: [], lockfile: null });
  const [runContext, setRunContext] = useState(null);
  const [safeExecModal, setSafeExecModal] = useState(null);
  const [executionGraph, setExecutionGraph] = useState({ nodes: [], edges: [] });
  const [crashReport, setCrashReport] = useState(null);
  const [dbStatus, setDbStatus] = useState({ state: "idle", message: "" });
  const [guestModeEnabled, setGuestModeEnabled] = useState(() => {
    try {
      const raw = localStorage.getItem(GUEST_MODE_KEY);
      return raw === null ? true : raw === "1";
    } catch (_) {
      return true;
    }
  });
  const [authSession, setAuthSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
    } catch (_) { return null; }
  });
  const account = authSession?.type === "account" ? authSession.user : null;

  const unsubRef = useRef([]);
  const outputBufRef = useRef("");
  const outputLinesRef = useRef([]);
  const lastCommandRef = useRef("");
  const syscallTrailRef = useRef([]);
  const runContextRef = useRef(null);
  const depAlertRef = useRef("");
  const pendingOutRef = useRef([]);
  const flushTimerRef = useRef(null);
  const cmdInputRef = useRef(null);
  const lastPreparedRunRef = useRef(null);
  const runnerSessionIdRef = useRef(null);
  const editorRef = useRef(null);
  const pendingRevealRef = useRef(null); // { path, line, column }

  const dbg = msg => setDebugLines(d =>
    [...d.slice(-499), `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const ensureRunnerSession = useCallback(async (cwd) => {
    if (runnerSessionIdRef.current) return runnerSessionIdRef.current;
    try {
      const res = await s?.pty?.create?.(cwd || workspace || undefined);
      if (res?.sessionId) {
        runnerSessionIdRef.current = res.sessionId;
        return res.sessionId;
      }
    } catch (_) {}
    return null;
  }, [workspace]);

  useEffect(() => {
    // Pre-create runner session so Run/Stop is instant.
    if (!s?.pty?.create) return;
    let cancelled = false;
    (async () => {
      const id = await ensureRunnerSession(workspace || undefined);
      if (cancelled || !id) return;
      if (workspace) {
        try { s?.pty?.cd?.(id, workspace); } catch (_) {}
      }
    })();
    return () => { cancelled = true; };
  }, [workspace, ensureRunnerSession]);

  const logSystemCall = useCallback((entry) => {
    const line = `[sys] ${entry}`;
    syscallTrailRef.current = [...syscallTrailRef.current.slice(-39), line];
    setDebugLines(d => [...d.slice(-498), `[${new Date().toLocaleTimeString()}] ${line}`]);
  }, []);

  const addExecutionEdge = useCallback((from, to, label) => {
    setExecutionGraph(prev => {
      const key = `${from}->${to}:${label}`;
      if (prev.edges.some(e => `${e.from}->${e.to}:${e.label}` === key)) return prev;
      const nodes = new Set(prev.nodes);
      nodes.add(from);
      nodes.add(to);
      return {
        nodes: Array.from(nodes),
        edges: [...prev.edges.slice(-79), { from, to, label }],
      };
    });
  }, []);

  const parseLineProblem = useCallback((line) => {
    if (!line || typeof line !== "string") return null;
    const py = line.match(/File "(.+)", line (\d+)/i);
    if (py) return { source: "runtime", file: py[1], line: Number(py[2]), message: line.trim() };
    const js = line.match(/\((.+):(\d+):(\d+)\)/);
    if (js) return { source: "runtime", file: js[1], line: Number(js[2]), message: line.trim() };
    return null;
  }, []);

  const flatFiles = useMemo(() => flattenTree(tree), [tree]);
  const dirtyCount = useMemo(
    () => [...openFiles, ...rightOpenFiles].filter(f => f.dirty).length,
    [openFiles, rightOpenFiles]
  );
  const focusedFile = useMemo(() => {
    if (splitOpen && focusPane === "right") return rightActiveFile;
    return activeFile;
  }, [activeFile, focusPane, rightActiveFile, splitOpen]);
  const breadcrumbs = useMemo(() => {
    if (!focusedFile?.path) return [];
    return focusedFile.path.split(/[\\/]/).filter(Boolean).slice(-6);
  }, [focusedFile]);

  const save = useCallback(async (file) => {
    const t = file || focusedFile; if (!t) return;
    await s?.fs.write(t.path, t.content);
    setOpenFiles(f => f.map(x => x.path === t.path ? { ...x, dirty: false } : x));
    setActiveFile(a => a?.path === t.path ? { ...a, dirty: false } : a);
    setRightOpenFiles(f => f.map(x => x.path === t.path ? { ...x, dirty: false } : x));
    setRightActiveFile(a => a?.path === t.path ? { ...a, dirty: false } : a);
    dbg(`Saved: ${t.name}`);
  }, [focusedFile]);

  useEffect(() => {
    (async () => {
      try {
        const res = await s?.settings?.merged?.();
        if (res?.ok && res.settings) {
          setSettings(prev => ({ ...prev, ...res.settings, autoSave: true }));
        }
      } catch (_) {
        try {
          const raw = localStorage.getItem(SETTINGS_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            setSettings(prev => ({ ...prev, ...parsed, autoSave: true }));
          }
        } catch (_) {}
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await s?.settings?.save?.(settings, "user");
      } catch (_) {
        try {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch (_) {}
      }
    })();
  }, [settings]);

  useEffect(() => {
    try {
      if (authSession) localStorage.setItem(AUTH_KEY, JSON.stringify(authSession));
      else localStorage.removeItem(AUTH_KEY);
    } catch (_) {}
  }, [authSession]);

  useEffect(() => {
    try {
      localStorage.setItem(GUEST_MODE_KEY, guestModeEnabled ? "1" : "0");
    } catch (_) {}
  }, [guestModeEnabled]);

  // ── IPC subscriptions (tree + pty exit) ──────────────────
  useEffect(() => {
    const flushOutput = () => {
      flushTimerRef.current = null;
      const batch = pendingOutRef.current;
      pendingOutRef.current = [];
      if (!batch.length) return;
      setOutputLines(prev => {
        const next = [...prev, ...batch].slice(-500);
        outputLinesRef.current = next;
        return next;
      });
    };

    const queueOutput = (items) => {
      if (!items?.length) return;
      pendingOutRef.current.push(...items);
      if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(flushOutput, 100);
      }
    };

    const addProblem = (p) => {
      if (!p?.file || !p?.line) return;
      setProblems(prev => {
        const key = `${p.source}:${p.file}:${p.line}:${p.message}`;
        if (prev.some(x => `${x.source}:${x.file}:${x.line}:${x.message}` === key)) return prev;
        return [...prev, p].slice(-300);
      });
    };

    const unTree = s?.fs.onTreeUpdate(t => setTree(t));
    const unRunCtx = s?.pty.onRunContext?.((ctx) => {
      const runnerId = runnerSessionIdRef.current;
      if (runnerId && ctx?.sessionId && ctx.sessionId !== runnerId) return;
      setRunContext(ctx);
      runContextRef.current = ctx;
      if (ctx?.command) lastCommandRef.current = ctx.command;
      const source = ctx?.isolated ? "Isolated Workspace" : "Workspace";
      addExecutionEdge("Studio Run", source, "dispatch");
      if (ctx?.command) {
        const proc = ctx.command.split(/\s+/)[0] || "process";
        addExecutionEdge(source, proc, "spawn");
      }
      logSystemCall(`run context ready [${ctx?.isolated ? "isolate" : "direct"}]`);
    });
    const unData = s?.pty.onData((payload) => {
      const runnerId = runnerSessionIdRef.current;
      const sessionId = payload?.sessionId;
      const chunk = payload?.data;
      if (runnerId && sessionId && sessionId !== runnerId) return;
      if (!chunk) return;
      const cleaned = String(chunk).replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
      const raw = outputBufRef.current + cleaned;
      const lines = raw.split(/\r?\n/);
      outputBufRef.current = lines.pop() ?? "";
      if (lines.length) {
        queueOutput(lines.map(text => ({ type: /error|exception|traceback|parsererror/i.test(text) ? "err" : "out", text })));
        lines.forEach((line) => {
          const p = parseLineProblem(line);
          if (p) addProblem(p);
          if (/wrote|saved|created|updated/i.test(line)) {
            const m = line.match(/([A-Za-z]:\\[^ "'\r\n]+|\/[^ "'\r\n]+)/);
            if (m?.[1]) {
              addExecutionEdge(lastCommandRef.current || "process", m[1], "write");
            }
          }
        });
      }
    });
    const unExit = s?.pty.onExit((payload) => {
      const runnerId = runnerSessionIdRef.current;
      const sessionId = payload?.sessionId;
      const code = payload?.code;
      if (runnerId && sessionId && sessionId !== runnerId) return;
      setIsRunning(false);
      if (outputBufRef.current.trim()) {
        queueOutput([{ type: "out", text: outputBufRef.current }]);
        outputBufRef.current = "";
      }
      dbg(`Exit: ${code}`);
      logSystemCall(`process exit code=${code}`);
      if (Number(code) !== 0) {
        setCrashReport({
          at: Date.now(),
          code,
          command: lastCommandRef.current || "unknown",
          context: runContextRef.current,
          tail: outputLinesRef.current.slice(-18).map(l => l.text),
          syscalls: syscallTrailRef.current.slice(-12),
          recommendation: "Switch to isolate mode and retry with minimal dependencies.",
        });
      }
    });
    unsubRef.current = [unTree, unData, unExit, unRunCtx].filter(Boolean);
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      unsubRef.current.forEach(fn => { try { fn(); } catch (_) {} });
    };
  }, [addExecutionEdge, logSystemCall, parseLineProblem]);

  // ── Extensions ────────────────────────────────────────────────
  useEffect(() => {
    registerBuiltInExtensions();
  }, []);

  // ── Commands & Keybindings ────────────────────────────────────
  useEffect(() => {
    const commandIds = [
      "workbench.action.quickOpen",
      "workbench.action.findInFiles",
      "workbench.action.files.save",
      "workbench.action.debug.run",
      "workbench.action.openSettings",
      "workbench.action.togglePanel",
      "workbench.action.toggleMap",
      "workbench.action.splitEditor",
      "workbench.action.toggleExplorer",
      "workbench.action.toggleTerminal",
      "workbench.action.showScm",
    ];
    const saveHandler = () => save();
    const runHandler = () => run();
    const toggleSplitHandler = () => setSplitOpen(v => !v);

    registerCommand("workbench.action.quickOpen", () => setCmdOpen(v => !v));
    registerCommand("workbench.action.findInFiles", () => { setShowExplorer(true); setLeftMode("search"); });
    registerCommand("workbench.action.files.save", saveHandler);
    registerCommand("workbench.action.debug.run", runHandler);
    registerCommand("workbench.action.openSettings", () => setShowSettings(v => !v));
    registerCommand("workbench.action.togglePanel", () => setShowJane(v => !v));
    registerCommand("workbench.action.toggleMap", () => setMapOpen(v => !v));
    registerCommand("workbench.action.splitEditor", toggleSplitHandler);
    registerCommand("workbench.action.toggleExplorer", () => setShowExplorer(v => !v));
    registerCommand("workbench.action.toggleTerminal", () => setShowTerminal(v => !v));
    registerCommand("workbench.action.showScm", () => { setShowExplorer(true); setLeftMode("scm"); });

    registerKeybinding("ctrl+p", "workbench.action.quickOpen", () => setCmdOpen(v => !v));
    registerKeybinding("ctrl+shift+f", "workbench.action.findInFiles", () => { setShowExplorer(true); setLeftMode("search"); });
    registerKeybinding("ctrl+s", "workbench.action.files.save", saveHandler);
    registerKeybinding("ctrl+enter", "workbench.action.debug.run", runHandler);
    registerKeybinding("ctrl+,", "workbench.action.openSettings", () => setShowSettings(v => !v));
    registerKeybinding("ctrl+j", "workbench.action.togglePanel", () => setShowJane(v => !v));
    registerKeybinding("ctrl+m", "workbench.action.toggleMap", () => setMapOpen(v => !v));
    registerKeybinding("ctrl+\\", "workbench.action.splitEditor", toggleSplitHandler);
    registerKeybinding("ctrl+b", "workbench.action.toggleExplorer", () => setShowExplorer(v => !v));
    registerKeybinding("ctrl+`", "workbench.action.toggleTerminal", () => setShowTerminal(v => !v));
    registerKeybinding("ctrl+shift+g", "workbench.action.showScm", () => { setShowExplorer(true); setLeftMode("scm"); });

    const fn = (e) => {
      if (handleKeyEvent(e)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setCmdOpen(false);
      }
    };
    window.addEventListener("keydown", fn);
    return () => {
      window.removeEventListener("keydown", fn);
      commandIds.forEach((id) => {
        unregisterCommand(id);
        unregisterKeybinding(id);
      });
    };
  }, [save, run]);

  // ── Workspace ─────────────────────────────────────────────
  const openWorkspace = async dir => {
    dbg(isDesktopBridge ? `Opening workspace: ${dir}` : `Opening browser workspace: ${dir}`);
    try {
      const r = await s?.workspace.set(dir);
      if (!r?.ok) {
        dbg(`Workspace failed: ${dir}`);
        setShowSetup(true);
        return;
      }
      setWorkspace(dir);
      setShowSetup(false);
      setExecutionGraph({ nodes: [], edges: [] });
      setCrashReport(null);
      dbg(isDesktopBridge ? `Workspace ready: ${dir}` : `Browser mode workspace: ${dir}`);
      if (r?.tree) setTree(r.tree);
    } catch (err) {
      dbg(`Workspace error: ${err?.message || "unknown"}`);
      setShowSetup(true);
    }
  };

  // ── File ops ──────────────────────────────────────────────
  const openFileInPane = async (pane, node) => {
    if (!node || node.meta?.truncated) return;
    const isRight = pane === "right";
    const list = isRight ? rightOpenFiles : openFiles;
    const ex = list.find(f => f.path === node.path);
    if (ex) {
      isRight ? setRightActiveFile(ex) : setActiveFile(ex);
      return;
    }
    const r = await s?.fs.read(node.path);
    if (r?.content !== undefined) {
      const file = { ...node, content: r.content, dirty: false };
      if (isRight) {
        setRightOpenFiles(f => [...f, file]);
        setRightActiveFile(file);
      } else {
        setOpenFiles(f => [...f, file]);
        setActiveFile(file);
      }
    }
  };

  const openFile = async (node) => {
    const pane = splitOpen ? focusPane : "left";
    await openFileInPane(pane, node);
  };

  const openPathAt = useCallback(async (filePath, line = 1, column = 1) => {
    if (!filePath) return;
    const found = flatFiles.find(f => f.path === filePath) || {
      type: "file",
      name: String(filePath).split(/[\\/]/).pop(),
      path: filePath,
    };
    pendingRevealRef.current = { path: filePath, line, column };
    const pane = splitOpen ? focusPane : "left";
    await openFileInPane(pane, found);
  }, [flatFiles, focusPane, splitOpen, rightOpenFiles, openFiles]);

  useEffect(() => {
    const pending = pendingRevealRef.current;
    if (!pending || !focusedFile?.path) return;
    if (pending.path !== focusedFile.path) return;
    const editor = editorRef.current;
    if (!editor) return;
    try {
      const pos = { lineNumber: Number(pending.line || 1), column: Number(pending.column || 1) };
      editor.revealLineInCenter(pos.lineNumber);
      editor.setPosition(pos);
      editor.focus();
    } catch (_) {}
    pendingRevealRef.current = null;
  }, [focusedFile?.path]);

  const changeFileInPane = (pane, filePath, val) => {
    const isRight = pane === "right";
    if (isRight) {
      setRightOpenFiles(f => f.map(x => x.path === filePath ? { ...x, content: val, dirty: true } : x));
      setRightActiveFile(a => a?.path === filePath ? { ...a, content: val, dirty: true } : a);
      return;
    }
    setOpenFiles(f => f.map(x => x.path === filePath ? { ...x, content: val, dirty: true } : x));
    setActiveFile(a => a?.path === filePath ? { ...a, content: val, dirty: true } : a);
  };

  const closeTabInPane = (pane, node) => {
    const isRight = pane === "right";
    const list = isRight ? rightOpenFiles : openFiles;
    const next = list.filter(f => f.path !== node.path);
    if (isRight) {
      setRightOpenFiles(next);
      setRightActiveFile(p => p?.path === node.path ? (next[next.length - 1] ?? null) : p);
    } else {
      setOpenFiles(next);
      setActiveFile(p => p?.path === node.path ? (next[next.length - 1] ?? null) : p);
    }
  };

  const getGhostMarkers = (fileName) => {
    const ext = (fileName || "").split(".").pop()?.toLowerCase();
    if (["py", "sh", "yaml", "yml", "rb", "pl", "r"].includes(ext)) return { start: "# GHOST-START", end: "# GHOST-END" };
    if (["html", "xml", "htm"].includes(ext)) return { start: "<!-- GHOST-START -->", end: "<!-- GHOST-END -->" };
    if (["css", "scss", "sass", "less"].includes(ext)) return { start: "/* GHOST-START */", end: "/* GHOST-END */" };
    if (["sql"].includes(ext)) return { start: "-- GHOST-START", end: "-- GHOST-END" };
    return { start: "// GHOST-START", end: "// GHOST-END" };
  };
  const ghostSelection = (pane, selected, selection) => {
    const file = pane === "right" ? rightActiveFile : activeFile;
    if (!file || !selected) return;
    const { start, end } = getGhostMarkers(file.name);
    const lineIndent = " ".repeat(Math.max(0, (selection.startColumn || 1) - 1));
    const wrapped = `${lineIndent}${start}\n${selected}\n${lineIndent}${end}`;
    const content = file.content || "";
    const lines = content.split(/\r?\n/);
    const from = Math.max(0, (selection.startLineNumber || 1) - 1);
    const to = Math.max(0, (selection.endLineNumber || 1) - 1);
    lines.splice(from, to - from + 1, wrapped);
    const next = lines.join("\n");
    changeFileInPane(pane, file.path, next);
    dbg("Ghost block inserted");
  };
  const unghostSelection = (pane) => {
    const file = pane === "right" ? rightActiveFile : activeFile;
    if (!file?.content) return;
    const lines = file.content.split(/\r?\n/);
    const out = [];
    let skipUntilEnd = false;
    for (const line of lines) {
      if (/GHOST-START/.test(line)) { skipUntilEnd = true; continue; }
      if (/GHOST-END/.test(line)) { skipUntilEnd = false; continue; }
      if (!skipUntilEnd) out.push(line);
    }
    const next = out.join("\n");
    if (next !== file.content) {
      changeFileInPane(pane, file.path, next);
      dbg("Ghost blocks removed");
    }
  };

  useEffect(() => {
    if (!splitOpen && focusPane !== "left") setFocusPane("left");
  }, [splitOpen, focusPane]);

  const toggleSplit = useCallback(() => {
    setSplitOpen(v => !v);
  }, []);

  const moveFocusedToOtherPane = useCallback(() => {
    if (!focusedFile) return;
    if (!splitOpen) setSplitOpen(true);
    const from = splitOpen ? focusPane : "left";
    const to = from === "left" ? "right" : "left";
    const file = focusedFile;
    closeTabInPane(from, file);
    openFileInPane(to, file);
    setFocusPane(to);
  }, [closeTabInPane, focusPane, focusedFile, openFileInPane, splitOpen]);

  useEffect(() => {
    if (!settings.autoSave || !focusedFile?.dirty) return;
    const timer = setTimeout(() => { save(focusedFile); }, 700);
    return () => clearTimeout(timer);
  }, [settings.autoSave, focusedFile, save]);

  const executeWithSafety = useCallback(async (cmd, meta = {}) => {
    if (!cmd) return;
    const runNow = async () => {
      setCrashReport(null);
      lastCommandRef.current = cmd;
      logSystemCall(`execute ${cmd}`);
      if (settings.runParallel) {
        const res = await s?.pty?.create?.(workspace || undefined);
        if (res?.sessionId) {
          s.pty.run(res.sessionId, cmd, { isolate: settings.isolateRun });
          dbg(`Run (parallel): ${cmd}`);
        } else {
          dbg("Terminal unavailable");
        }
        return;
      }
      setIsRunning(true);
      const runnerId = await ensureRunnerSession(workspace || undefined);
      if (!runnerId) {
        dbg("Terminal unavailable (no runner session)");
        setIsRunning(false);
        return;
      }
      s.pty.run(runnerId, cmd, { isolate: settings.isolateRun });
      dbg(`Run: ${cmd}${settings.isolateRun ? " [isolate]" : ""}`);
    };
    if (!settings.safeExecute) {
      await runNow();
      return;
    }
    setSafeExecModal({
      cmd,
      meta,
      risk: buildRiskProfile(cmd),
      onConfirm: () => {
        setSafeExecModal(null);
        void runNow();
      },
      onCancel: () => {
        setSafeExecModal(null);
        dbg("Safe execute cancelled by user");
      },
    });
  }, [dbg, ensureRunnerSession, logSystemCall, settings.isolateRun, settings.runParallel, settings.safeExecute, workspace]);

  // ── Run / Stop ────────────────────────────────────────────
  async function run() {
    setOutputLines([]);
    outputLinesRef.current = [];
    setProblems([]);
    outputBufRef.current = "";
    const file = focusedFile;
    if (!file) { dbg("No active file to run"); return; }
    if (file?.dirty) await save(file);
    const ext = file?.name?.split(".").pop()?.toLowerCase();
    const preferred = settings.interpreter === "auto"
      ? (EXT_INTERP[ext] || "node")
      : settings.interpreter;
    const resolved = await s?.system?.resolveInterpreter(preferred);
    if (!resolved?.ok) {
      setIsRunning(false);
      dbg(`Interpreter missing. Tried: ${(resolved?.checked || []).join(", ")}`);
      return;
    }
    const interpCmd = resolved.command;
    setActiveRunInterpreter(preferred);
    if (lastPreparedRunRef.current) {
      await s?.run?.cleanup(lastPreparedRunRef.current);
      lastPreparedRunRef.current = null;
    }
    let runPath = file?.path || "index.js";
    if (file) {
      const prepared = await s?.run?.prepare(file.path, file.content || "");
      if (prepared?.ok && prepared?.path) {
        runPath = prepared.path;
        lastPreparedRunRef.current = prepared.path;
      }
    }
    let cmd = `${interpCmd} "${runPath}"`;
    if (file?.name?.toLowerCase() === "requirements.txt") {
      cmd = `${interpCmd} -m pip install -r "${file.path}"`;
    } else if (file?.name?.toLowerCase() === "package.json") {
      cmd = `npm install`;
    }
    addExecutionEdge("Studio Run", interpCmd, "spawn");
    await executeWithSafety(cmd, { source: "run", preferred, interpCmd });
  }
  async function stop() {
    const runnerId = await ensureRunnerSession(workspace || undefined);
    if (runnerId) s.pty.stop(runnerId);
    if (lastPreparedRunRef.current) {
      await s?.run?.cleanup(lastPreparedRunRef.current);
      lastPreparedRunRef.current = null;
    }
    setIsRunning(false);
    dbg("Stopped");
  }

  // ── Context menu ──────────────────────────────────────────
  const openCtx = (e, node) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, node }); };
  const closeCtx = () => setCtxMenu(null);

  const ctxAction = async action => {
    const node = ctxMenu?.node; closeCtx();
    if (!node || node.meta?.truncated) return;
    const dir = n => {
      if (!n) return workspace;
      let base = n.type === "directory"
        ? n.path
        : (n.path?.replace(/[\\/][^\\/]+$/, "") || workspace);
      if (/^[A-Za-z]:$/.test(base)) base += "\\";
      return base || workspace;
    };

    const joinPath = (base, name) => {
      const safeBase = base || workspace || "";
      if (!safeBase) return name;
      if (safeBase.endsWith("\\") || safeBase.endsWith("/")) return `${safeBase}${name}`;
      return `${safeBase}${sepForPath(safeBase)}${name}`;
    };

    if (action === "new_file") {
      const name = window.prompt("File name:"); if (!name) return;
      const fp = joinPath(dir(node), name);
      const res = await s.fs.write(fp, "");
      if (res?.error) { dbg(`Create file failed: ${res.error}`); return; }
      await openFile({ type: "file", name, path: fp });
      dbg(`Created file: ${name}`);
      logSystemCall(`fs.write ${fp}`);
      addExecutionEdge("Explorer", fp, "write");
    }
    if (action === "new_folder") {
      const name = window.prompt("Folder name:"); if (!name) return;
      const res = await s.fs.mkdir(joinPath(dir(node), name));
      if (res?.error) { dbg(`Create folder failed: ${res.error}`); return; }
      dbg(`Created folder: ${name}`);
      logSystemCall(`fs.mkdir ${name}`);
    }
    if (action === "rename") {
      const n = window.prompt("Rename to:", node?.name); if (!n || n === node?.name) return;
      const res = await s.fs.rename(node.path, n);
      if (res?.error) { dbg(`Rename failed: ${res.error}`); return; }
      setOpenFiles(f => f.filter(x => x.path !== node.path));
      if (activeFile?.path === node.path) setActiveFile(null);
      dbg(`Renamed: ${node.name} -> ${n}`);
      logSystemCall(`fs.rename ${node.path} -> ${n}`);
    }
    if (action === "delete") {
      if (!window.confirm(`Delete "${node?.name}"?`)) return;
      const res = await s?.fs.delete(node.path);
      if (res?.error) { dbg(`Delete failed: ${res.error}`); return; }
      setOpenFiles(f => f.filter(x => !x.path.startsWith(node.path)));
      if (activeFile?.path?.startsWith(node.path)) setActiveFile(null);
      dbg(`Deleted: ${node.name}`);
      logSystemCall(`fs.delete ${node.path}`);
    }
    if (action === "open_terminal") {
      const d = dir(node);
      const runnerId = await ensureRunnerSession(workspace || undefined);
      if (runnerId) s.pty.cd(runnerId, d);
      logSystemCall(`pty.cd ${d}`);
    }
    if (action === "copy_path") navigator.clipboard.writeText(node?.path ?? "");
    await refreshRootTree();
  };

  const attachChildren = (nodes, dirPath, children) =>
    nodes.map(n => {
      if (n.path === dirPath && n.type === "directory") {
        return { ...n, children };
      }
      if (Array.isArray(n.children)) {
        return { ...n, children: attachChildren(n.children, dirPath, children) };
      }
      return n;
    });

  const expandDir = async (dirPath) => {
    try {
      const r = await s?.fs.tree(dirPath);
      if (Array.isArray(r?.tree)) {
        setTree(prev => attachChildren(prev, dirPath, r.tree));
      }
    } catch (_) {}
  };

  const refreshRootTree = async () => {
    try {
      const root = workspace;
      if (!root) return;
      const r = await s?.fs.tree(root);
      if (Array.isArray(r?.tree)) setTree(r.tree);
    } catch (error) {
      dbg(`Refresh failed: ${error?.message || "unknown"}`);
    }
  };

  const importDroppedFiles = async (fileList, targetDir) => {
    try {
      if (!workspace) {
        dbg("Open a workspace before uploading files");
        return;
      }
      const files = Array.from(fileList || []);
      if (!files.length) return;
      const target = targetDir || workspace;

      const nativePaths = files.map(f => f?.path).filter(Boolean);
      if (nativePaths.length === files.length && s?.fs?.importPaths) {
        const res = await s.fs.importPaths(target, nativePaths);
        if (res?.error) { dbg(`Import failed: ${res.error}`); return; }
        dbg(`Imported ${res?.imported ?? nativePaths.length} item(s)`);
        await refreshRootTree();
        return;
      }

      // Browser fallback: write dropped files via base64.
      for (const f of files) {
        const data = await f.arrayBuffer();
        const bytes = new Uint8Array(data);
        let binary = "";
        for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        const full = `${target}${target.endsWith("/") || target.endsWith("\\") ? "" : sepForPath(target)}${f.name}`;
        const writeRes = await s?.fs?.writeBinary?.(full, base64);
        if (writeRes?.error) {
          dbg(`Upload failed for ${f.name}: ${writeRes.error}`);
          return;
        }
      }
      dbg(`Uploaded ${files.length} file(s)`);
      await refreshRootTree();
    } catch (error) {
      dbg(`Upload error: ${error?.message || "unknown"}`);
    }
  };

  useEffect(() => {
    const fn = () => ctxMenu && closeCtx();
    window.addEventListener("click", fn);
    return () => window.removeEventListener("click", fn);
  }, [ctxMenu]);

  useEffect(() => {
    if (!cmdOpen) return;
    setCmdQuery("");
    setTimeout(() => cmdInputRef.current?.focus(), 0);
  }, [cmdOpen]);

  useEffect(() => () => {
    if (lastPreparedRunRef.current) {
      s?.run?.cleanup(lastPreparedRunRef.current);
      lastPreparedRunRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!workspace || !s?.git?.status) return;
    let cancelled = false;
    const fetchGit = async () => {
      const res = await s.git.status();
      if (cancelled) return;
      if (res?.ok) {
        setGitInfo({
          branch: res.branch || "detached",
          changed: Array.isArray(res.changed) ? res.changed.length : 0,
          ahead: Number(res.ahead || 0),
          behind: Number(res.behind || 0),
        });
      } else {
        setGitInfo({ branch: "no-git", changed: 0, ahead: 0, behind: 0 });
      }
    };
    fetchGit();
    const timer = setInterval(fetchGit, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [workspace]);

  useEffect(() => {
    if (!workspace || !s?.system?.dependencyStatus) return;
    let cancelled = false;
    const poll = async () => {
      const res = await s.system.dependencyStatus();
      if (cancelled || !res?.ok) return;
      setDepStatus(res);
      if (Array.isArray(res.alerts) && res.alerts.length > 0) {
        const key = res.alerts.join("|");
        if (depAlertRef.current !== key) {
          depAlertRef.current = key;
          dbg(`Dependency monitor alert: ${res.alerts.join(", ")}`);
        }
      } else {
        depAlertRef.current = "";
      }
    };
    poll();
    const timer = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [workspace]);

  const executeCommand = async (item) => {
    setCmdOpen(false);
    if (!item) return;
    if (item.type === "action") item.run?.();
    if (item.type === "file") await openFile(item.file);
  };

  const commandItems = useMemo(() => {
    const actions = [
      { id: "run", label: "Run Active File", hint: "Ctrl+Enter", run: run },
      { id: "preview", label: "Open Live Preview (HTML)", hint: "Web", run: () => {
        if (!focusedFile?.name?.toLowerCase().endsWith(".html")) return;
        const html = focusedFile.content || "";
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(url), 15000);
      } },
      { id: "save", label: "Save Active File", hint: "Ctrl+S", run: () => save() },
      { id: "toggle_explorer", label: showExplorer ? "Hide Explorer" : "Show Explorer", hint: "Layout", run: () => setShowExplorer(v => !v) },
      { id: "toggle_terminal", label: showTerminal ? "Hide Terminal" : "Show Terminal", hint: "Layout", run: () => setShowTerminal(v => !v) },
      { id: "split", label: splitOpen ? "Close Split Editor" : "Split Editor", hint: "Layout", run: () => toggleSplit() },
      ...(splitOpen ? [{ id: "move", label: "Move Tab to Other Pane", hint: "Layout", run: () => moveFocusedToOtherPane() }] : []),
      { id: "toggle_map", label: mapOpen ? "Hide Insight Map" : "Show Insight Map", hint: "Ctrl+M", run: () => setMapOpen(v => !v) },
      { id: "settings", label: "Open Settings", hint: "Ctrl+,", run: () => setShowSettings(true) },
      { id: "jane", label: "Open Jane AI", hint: "Ctrl+J", run: () => setShowJane(true) },
      { id: "safe_execute", label: settings.safeExecute ? "Disable Safe Execute" : "Enable Safe Execute", hint: "Security", run: () => setSettings(prev => ({ ...prev, safeExecute: !prev.safeExecute })) },
      { id: "isolate_run", label: settings.isolateRun ? "Disable Isolate Run" : "Enable Isolate Run", hint: "Security", run: () => setSettings(prev => ({ ...prev, isolateRun: !prev.isolateRun })) },
      { id: "efficiency", label: "Check code efficiency", hint: "Analyze active file", run: () => {
        const file = focusedFile;
        if (!file?.content) { dbg("Open a file to check efficiency"); return; }
        const lines = file.content.split(/\r?\n/);
        const total = lines.length;
        const nonEmpty = lines.filter(l => l.trim().length > 0).length;
        const todo = lines.filter(l => /TODO|FIXME|XXX/i.test(l)).length;
        const long = lines.filter(l => l.length > 120).length;
        const avgLen = total ? Math.round(lines.reduce((a, l) => a + l.length, 0) / total) : 0;
        dbg(`[Efficiency] ${file.name}: ${total} lines, ${nonEmpty} code, ${todo} TODO/FIXME, ${long} long lines (>120), avg ${avgLen} chars`);
        if (long > 0) dbg(`  → Consider wrapping or splitting ${long} long line(s)`);
        if (todo > 0) dbg(`  → ${todo} TODO/FIXME marker(s) pending`);
      } },
      { id: "install_deps", label: "Install Project Dependencies", hint: "One-click", run: () => {
        const hasPkg = flatFiles.some(f => /(^|[\\/])package\.json$/i.test(f.path));
        const hasReq = flatFiles.some(f => /(^|[\\/])requirements\.txt$/i.test(f.path));
        if (hasPkg) {
          executeWithSafety("npm install", { source: "deps", manager: "npm" });
          dbg("Dependency install queued: npm install");
          return;
        }
        if (hasReq) {
          executeWithSafety("python -m pip install -r requirements.txt", { source: "deps", manager: "pip" });
          dbg("Dependency install queued: pip install -r requirements.txt");
          return;
        }
        dbg("No package.json or requirements.txt found in workspace root");
      } },
      { id: "signout", label: "Sign Out", hint: "Account", run: () => {
        setAuthSession(null);
        setShowSetup(true);
      } },
    ];

    const q = cmdQuery.trim().toLowerCase();
    const actionMatches = actions
      .filter(a => !q || a.label.toLowerCase().includes(q))
      .map(a => ({ type: "action", ...a }));

    const fileMatches = flatFiles
      .filter(f => !q || f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
      .slice(0, 14)
      .map(f => ({ type: "file", id: f.path, label: f.name, hint: f.path, file: f }));

    return [...actionMatches, ...fileMatches].slice(0, 20);
  }, [cmdQuery, executeWithSafety, flatFiles, focusedFile, mapOpen, moveFocusedToOtherPane, run, save, settings.isolateRun, settings.safeExecute, showExplorer, showTerminal, splitOpen, toggleSplit]);

  const sepForPath = p => (p?.includes("\\") ? "\\" : "/");
  const sanitizeNewName = (name) => String(name || "").trim().replace(/[<>:"/\\|?*]/g, "");
  const createNode = async (kind, baseDir) => {
    const rawName = window.prompt(kind === "file" ? "New file name:" : "New folder name:");
    const name = sanitizeNewName(rawName);
    if (!name) return;
    const rootDir = baseDir || workspace;
    if (!rootDir) return;
    const normalized = /^[A-Za-z]:$/.test(rootDir) ? `${rootDir}\\` : rootDir;
    const sep = sepForPath(normalized);
    const fullPath = `${normalized}${normalized.endsWith("\\") || normalized.endsWith("/") ? "" : sep}${name}`;
    try {
      if (kind === "file") {
        const res = await s.fs.write(fullPath, "");
        if (res?.error) { dbg(`Create file failed: ${res.error}`); return; }
        await refreshRootTree();
        await openFile({ type: "file", name, path: fullPath });
        dbg(`Created file: ${name}`);
      } else {
        const res = await s.fs.mkdir(fullPath);
        if (res?.error) { dbg(`Create folder failed: ${res.error}`); return; }
        await refreshRootTree();
        dbg(`Created folder: ${name}`);
      }
    } catch (err) {
      dbg(`Create ${kind} failed: ${err?.message || err}`);
    }
  };

  const openLivePreview = () => {
    if (!focusedFile?.name?.toLowerCase().endsWith(".html")) {
      dbg("Live preview works for .html files");
      return;
    }
    const html = focusedFile.content || "";
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  };

  // ── Render ────────────────────────────────────────────────
  if (!authSession) {
    return (
      <AuthGate
        guestModeEnabled={guestModeEnabled}
        onSetGuestModeEnabled={setGuestModeEnabled}
        onAuth={setAuthSession}
      />
    );
  }

  if (showSetup) return (
    <WorkspaceSetup
      onSelect={openWorkspace}
      onBrowse={async () => {
        const p = await s.dialog.openFolder();
        if (p) openWorkspace(p);
      }}
    />
  );

  return (
    <>
      <style>{CSS}</style>
      <div className={`vr-root theme-${settings.theme}`} onClick={closeCtx}>

        <TitleBar
          workspace={workspace}
          isRunning={isRunning}
          interpreter={activeRunInterpreter === "auto" ? settings.interpreter : activeRunInterpreter}
          onRun={run}
          onStop={stop}
          onChangeWorkspace={() => setShowSetup(true)}
          onSettings={() => setShowSettings(true)}
          onJane={() => setShowJane(v => !v)}
        />

        <div className="vr-workbar">
          <div className="vr-breadcrumbs">
            {breadcrumbs.length === 0
              ? <span className="vr-crumb muted">No file selected</span>
              : breadcrumbs.map((b, i) => <span key={i} className="vr-crumb">{b}</span>)}
          </div>
          <div className="vr-work-actions">
            <button className={`vr-pill${settings.safeExecute ? " on" : ""}`} onClick={() => setSettings(prev => ({ ...prev, safeExecute: !prev.safeExecute }))}>SafeExec</button>
            <button className={`vr-pill${settings.isolateRun ? " on" : ""}`} onClick={() => setSettings(prev => ({ ...prev, isolateRun: !prev.isolateRun }))}>Isolate</button>
            <button
              className={`vr-pill${showExplorer && leftMode === "explorer" ? " on" : ""}`}
              onClick={() => {
                setShowExplorer(true);
                setLeftMode("explorer");
              }}
            >
              Explorer
            </button>
            <button
              className={`vr-pill${showExplorer && leftMode === "search" ? " on" : ""}`}
              onClick={() => {
                setShowExplorer(true);
                setLeftMode("search");
              }}
            >
              Search
            </button>
            <button
              className={`vr-pill${showExplorer && leftMode === "scm" ? " on" : ""}`}
              onClick={() => {
                setShowExplorer(true);
                setLeftMode("scm");
              }}
            >
              SCM
            </button>
            <button
              className={`vr-pill${showExplorer && leftMode === "extensions" ? " on" : ""}`}
              onClick={() => { setShowExplorer(true); setLeftMode("extensions"); }}
            >
              Extensions
            </button>
            <button className={`vr-pill${splitOpen ? " on" : ""}`} onClick={toggleSplit}>Split</button>
            {splitOpen && (
              <button className="vr-pill" onClick={moveFocusedToOtherPane} title="Move active tab to other pane">
                Move
              </button>
            )}
            <button className={`vr-pill${showTerminal ? " on" : ""}`} onClick={() => setShowTerminal(v => !v)}>Terminal</button>
            <button className={`vr-pill${mapOpen ? " on" : ""}`} onClick={() => setMapOpen(v => {
              const next = !v;
              if (next) setMapResetToken(t => t + 1);
              return next;
            })}>Map</button>
            <button className="vr-pill" onClick={openLivePreview}>Preview</button>
            <button className="vr-pill" onClick={() => setCmdOpen(true)}>Command</button>
          </div>
        </div>

        {(depStatus?.alerts?.length > 0 || crashReport) && (
          <div className="vr-alertbar">
            {depStatus?.alerts?.length > 0 && (
              <span>Dependency Lock Monitor: {depStatus.alerts.join(" · ")}</span>
            )}
            {crashReport && (
              <span>
                Crash Tree: cmd {crashReport.command} to exit {crashReport.code} · Suggestion: isolate mode
              </span>
            )}
          </div>
        )}
        {crashReport && (
          <div className="vr-crash-panel">
            <div className="vr-crash-head">Crash Tree</div>
            <div className="vr-crash-line">Studio Run → {crashReport.context?.isolated ? "Isolated Workspace" : "Workspace"} → {crashReport.command} → Exit {crashReport.code}</div>
            <div className="vr-crash-head">Last System Calls</div>
            {crashReport.syscalls.map((line, idx) => <div key={`sys-${idx}`} className="vr-crash-line">{line}</div>)}
            <div className="vr-crash-head">Last Output</div>
            {crashReport.tail.map((line, idx) => <div key={`tail-${idx}`} className="vr-crash-line">{line}</div>)}
            <div className="vr-crash-reco">{crashReport.recommendation}</div>
          </div>
        )}

        <div className="vr-body">
          {showExplorer && (
            <>
              {leftMode === "explorer" && (
                <FileExplorer
                  tree={tree}
                  activeFile={focusedFile}
                  onSelect={openFile}
                  onContextMenu={openCtx}
                  onExpandDir={expandDir}
                onNewFile={() => createNode("file")}
                onNewFolder={() => createNode("folder")}
                onRefresh={refreshRootTree}
                onImportDrop={importDroppedFiles}
                workspace={workspace}
                onRootContextMenu={e => openCtx(e, {
                    type: "directory", path: workspace,
                    name: workspace?.split(/[\\/]/).pop()
                  })}
                />
              )}
              {leftMode === "search" && (
                <SearchPanel
                  workspace={workspace}
                  onOpenResult={(filePath, line, column) => {
                    void openPathAt(filePath, line, column);
                  }}
                />
              )}
              {leftMode === "scm" && (
                <ScmPanel
                  workspace={workspace}
                  onOpenFile={(filePath) => {
                    const found = flatFiles.find(f => f.path === filePath);
                    if (found) void openFile(found);
                  }}
                />
              )}
              {leftMode === "extensions" && (
                <div className="vr-ext-panel">
                  <div className="vr-ext-title">Extensions</div>
                  <div className="vr-ext-list">
                    {getAllExtensions().map((ext) => (
                      <div key={ext.id} className="vr-ext-item">
                        <span className="vr-ext-name">{ext.manifest?.name || ext.id}</span>
                        <span className="vr-ext-ver">v{ext.manifest?.version || "?"}</span>
                        <button
                          className={`vr-ext-btn${isActivated(ext.id) ? " on" : ""}`}
                          onClick={() => activateExtension(ext.id)}
                          title={isActivated(ext.id) ? "Activated" : "Activate"}
                        >
                          {isActivated(ext.id) ? "On" : "Off"}
                        </button>
                      </div>
                    ))}
                    {getAllExtensions().length === 0 && (
                      <div className="vr-ext-empty">No extensions. Connect a marketplace to install more.</div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <main className="vr-main">
            <div className="vr-split">
              <div className="vr-editors">
                <div className={`vr-editor-pane${focusPane === "left" ? " focus" : ""}`} onMouseDown={() => setFocusPane("left")}>
                  <EditorArea
                    openFiles={openFiles}
                    activeFile={activeFile}
                    onChange={(filePath, val) => changeFileInPane("left", filePath, val)}
                    onClose={(node) => closeTabInPane("left", node)}
                    onSelect={(file) => { setFocusPane("left"); setActiveFile(file); }}
                    settings={settings}
                    onEditorMount={(editor) => { editorRef.current = editor; }}
                    onGhostSelection={(selected, selection) => ghostSelection("left", selected, selection)}
                    onUnghost={() => unghostSelection("left")}
                    onValidate={(filePath, fileName, markers) => {
                      const ext = fileName?.split(".").pop()?.toLowerCase();
                      if (!["js", "jsx", "ts", "tsx", "json", "css", "html"].includes(ext)) return;
                      const lintProblems = (markers || [])
                        .filter(m => (m.severity === 8 || m.severity === 4) && m.startLineNumber)
                        .map(m => ({
                          source: "editor",
                          file: filePath,
                          line: m.startLineNumber,
                          message: m.message,
                        }));
                      setProblems(prev => {
                        const runtime = prev.filter(p => p.source === "runtime");
                        return [...runtime, ...lintProblems].slice(-300);
                      });
                    }}
                  />
                </div>

                {splitOpen && (
                  <>
                    <div className="vr-editor-divider" />
                    <div className={`vr-editor-pane${focusPane === "right" ? " focus" : ""}`} onMouseDown={() => setFocusPane("right")}>
                      <EditorArea
                        openFiles={rightOpenFiles}
                        activeFile={rightActiveFile}
                        onChange={(filePath, val) => changeFileInPane("right", filePath, val)}
                        onClose={(node) => closeTabInPane("right", node)}
                        onSelect={(file) => { setFocusPane("right"); setRightActiveFile(file); }}
                        settings={settings}
                        onEditorMount={(editor) => { editorRef.current = editor; }}
                        onGhostSelection={(selected, selection) => ghostSelection("right", selected, selection)}
                        onUnghost={() => unghostSelection("right")}
                        onValidate={(filePath, fileName, markers) => {
                          const ext = fileName?.split(".").pop()?.toLowerCase();
                          if (!["js", "jsx", "ts", "tsx", "json", "css", "html"].includes(ext)) return;
                          const lintProblems = (markers || [])
                            .filter(m => (m.severity === 8 || m.severity === 4) && m.startLineNumber)
                            .map(m => ({
                              source: "editor",
                              file: filePath,
                              line: m.startLineNumber,
                              message: m.message,
                            }));
                          setProblems(prev => {
                            const runtime = prev.filter(p => p.source === "runtime");
                            return [...runtime, ...lintProblems].slice(-300);
                          });
                        }}
                      />
                    </div>
                  </>
                )}
              </div>

              <button className="vr-map-btn"
                onClick={() => setMapOpen(o => {
                  const next = !o;
                  if (next) setMapResetToken(t => t + 1);
                  return next;
                })}
                title={mapOpen ? "Collapse map (Ctrl+M)" : "Expand map (Ctrl+M)"}>
                {mapOpen ? "›" : "‹"}
              </button>

              {mapOpen && (
                <MapErrorBoundary
                  resetKey={`${workspace || "none"}:${focusedFile?.path || "no-file"}:${mapResetToken}`}
                  onRetry={() => setMapResetToken(t => t + 1)}
                >
                  <Suspense fallback={<div className="vr-map-loading">Loading map…</div>}>
                    <MapPanel workspace={workspace} activeFile={focusedFile} tree={tree} executionGraph={executionGraph} />
                  </Suspense>
                </MapErrorBoundary>
              )}
            </div>

            {showTerminal && (
              <MultiTerminal
                workspace={workspace}
                isRunning={isRunning}
                outputLines={outputLines}
                debugLines={debugLines}
                problems={problems}
                onOpenProblem={(problem) => {
                  const found = flatFiles.find(f => f.path === problem.file);
                  if (found) openFile(found);
                }}
              />
            )}
          </main>
        </div>

        <div className="vr-statusbar">
          <span>FILES {flatFiles.length}</span>
          <span>OPEN {openFiles.length}</span>
          <span>DIRTY {dirtyCount}</span>
          <span>BRANCH {gitInfo.branch}</span>
          <span>CHANGED {gitInfo.changed}</span>
          <span>SYNC +{gitInfo.ahead}/-{gitInfo.behind}</span>
          <span>INTERPRETER {settings.interpreter.toUpperCase()}</span>
          <span>SAFE {settings.safeExecute ? "ON" : "OFF"}</span>
          <span>ISOLATE {settings.isolateRun ? "ON" : "OFF"}</span>
          <span>PARALLEL {settings.runParallel ? "ON" : "OFF"}</span>
          <span>DEP {depStatus?.alerts?.length || 0}</span>
          <span>{runContext?.isolated ? "ISO-RUN" : "DIRECT-RUN"}</span>
          <span>{isRunning ? "RUNNING" : "IDLE"}</span>
          <span title="Runtime memory: see Terminal output">MEM —</span>
        </div>

        {ctxMenu && (
          <ContextMenu
            x={ctxMenu.x} y={ctxMenu.y}
            node={ctxMenu.node}
            onAction={ctxAction}
            onClose={closeCtx}
          />
        )}

        {showSettings && (
          <Suspense fallback={<div className="vr-panel-loading">Loading settings…</div>}>
          <SettingsPanel
            settings={settings}
            onSave={s => setSettings({ ...s, autoSave: true })}
            gitInfo={gitInfo}
            debugLines={debugLines}
            dbStatus={dbStatus}
            onTestDb={async (config) => {
              setDbStatus({ state: "checking", message: "Checking..." });
              const res = await s.system.testDb(config);
              if (res?.ok) setDbStatus({ state: "ok", message: res.message || "Connected" });
              else setDbStatus({ state: "error", message: res?.error || "Connection failed" });
            }}
            account={account}
            onSignIn={(payload) => setAuthSession({ type: "account", user: payload, signedAt: Date.now() })}
            onSignOut={() => setAuthSession(null)}
            onClose={() => setShowSettings(false)}
            workspace={workspace}
            onInstallDependencies={(cmd) => { executeWithSafety(cmd, { source: "settings-deps" }); setShowSettings(false); }}
          />
          </Suspense>
        )}

        {showJane && (
          <Suspense fallback={<div className="vr-panel-loading">Loading Jane…</div>}>
          <JanePanel
            activeFile={focusedFile}
            onClose={() => setShowJane(false)}
          />
          </Suspense>
        )}

        {cmdOpen && (
          <div className="vr-cmd-overlay" onClick={() => setCmdOpen(false)}>
            <div className="vr-cmd" onClick={e => e.stopPropagation()}>
              <input
                ref={cmdInputRef}
                className="vr-cmd-input"
                placeholder="Type a command or file name..."
                value={cmdQuery}
                onChange={e => setCmdQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") executeCommand(commandItems[0]);
                  if (e.key === "Escape") setCmdOpen(false);
                }}
              />
              <div className="vr-cmd-list">
                {commandItems.length === 0
                  ? <div className="vr-cmd-empty">No matches</div>
                  : commandItems.map(item => (
                    <button key={item.id} className="vr-cmd-item" onClick={() => executeCommand(item)}>
                      <span>{item.label}</span>
                      <small>{item.hint}</small>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {safeExecModal && (
          <div className="vr-safe-overlay" onClick={safeExecModal.onCancel}>
            <div className="vr-safe-card" onClick={e => e.stopPropagation()}>
              <div className="vr-safe-title">SAFE EXECUTE</div>
              <div className="vr-safe-cmd">{safeExecModal.cmd}</div>
              <div className="vr-safe-grid">
                <div><span>CPU impact</span><b>{safeExecModal.risk.cpu}</b></div>
                <div><span>Memory estimate</span><b>{safeExecModal.risk.memory}</b></div>
                <div><span>Network activity</span><b>{safeExecModal.risk.network}</b></div>
                <div><span>Permission summary</span><b>{safeExecModal.risk.permissions}</b></div>
              </div>
              <div className="vr-safe-engine">Powered by {safeExecModal.risk.engine}</div>
              <div className="vr-safe-actions">
                <button className="vr-safe-cancel" onClick={safeExecModal.onCancel}>Cancel</button>
                <button className="vr-safe-confirm" onClick={safeExecModal.onConfirm}>Run Securely</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap');
:root{
  --bg:#0a1019;--bg1:#0f1725;--bg2:#162133;--bg3:#1a2940;
  --bdr:#2a3b54;--bdr2:#1f2e45;
  --text:#e8f0fc;--t2:#b5c7df;--t3:#6f87aa;
  --white:#f5f9ff;--red:#ee7b7b;--yel:#f0cb7f;--green:#5be2a7;
  --mono:'JetBrains Mono',monospace;--ui:'Space Grotesk',sans-serif;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
.vr-root{
  display:flex;flex-direction:column;height:100vh;width:100%;
  background:
    linear-gradient(rgba(255,255,255,.014) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.014) 1px, transparent 1px),
    radial-gradient(circle at top left, rgba(92,132,191,.18), transparent 34%),
    var(--bg);
  background-size:24px 24px,24px 24px,100% 100%,auto;
  color:var(--text);font-family:var(--ui);overflow:hidden;user-select:none;
}
.vr-root.theme-light{
  --bg:#f4f7fb;--bg1:#eaf0f8;--bg2:#dfe8f3;--bg3:#d4dfed;
  --bdr:#c4d0de;--bdr2:#d1dae6;
  --text:#0f1724;--t2:#3f536e;--t3:#72839a;
  background:
    linear-gradient(rgba(10,30,60,.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(10,30,60,.04) 1px, transparent 1px),
    radial-gradient(circle at top left, rgba(87,128,193,.12), transparent 35%),
    var(--bg);
}
.vr-body{display:flex;flex:1;overflow:hidden;}
.vr-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;}
.vr-split{flex:1;display:flex;overflow:hidden;border-bottom:1px solid var(--bdr);position:relative;}
.vr-editors{flex:1;display:flex;min-width:0;overflow:hidden;}
.vr-editor-pane{flex:1;min-width:0;overflow:hidden;display:flex;}
.vr-editor-pane.focus{box-shadow:inset 0 0 0 1px rgba(134,171,217,.28);}
.vr-editor-divider{width:1px;background:var(--bdr);flex-shrink:0;}
.vr-workbar{min-height:38px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:6px 14px;background:linear-gradient(180deg,#111a2a,#0f1725);border-bottom:1px solid var(--bdr2);}
.vr-breadcrumbs{display:flex;gap:6px;align-items:center;overflow:hidden;min-width:0;flex:1;min-width:0;}
.vr-crumb{font-family:var(--mono);font-size:10px;color:#9db3d2;white-space:nowrap;}
.vr-crumb:not(.muted)::after{content:"/";margin-left:6px;color:#4f668a;}
.vr-crumb:last-child::after{display:none;}
.vr-crumb.muted{color:#7086a8;}
.vr-work-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;flex-shrink:0;}
.vr-pill{height:26px;padding:0 12px;border:1px solid #2c3f5d;background:#152133;color:#8fa6c9;border-radius:8px;font-family:var(--mono);font-size:10px;font-weight:500;cursor:pointer;transition:color .12s,border-color .12s,background .12s;}
.vr-pill.on{color:#f3f8ff;border-color:#58a6ff;background:rgba(88,166,255,.12);}
.vr-pill:hover{color:#e9f1ff;border-color:#4e6e9b;background:#1a2a42;}
.vr-alertbar{height:26px;display:flex;align-items:center;gap:14px;padding:0 10px;background:#162134;border-bottom:1px solid #2a3d5c;color:#b1c4df;font-family:var(--mono);font-size:9px;overflow-x:auto;white-space:nowrap;}
.vr-crash-panel{max-height:170px;overflow:auto;background:#111b2d;border-bottom:1px solid #2a3d5c;padding:8px 10px;}
.vr-crash-head{font-family:var(--mono);font-size:9px;color:#93a7c5;letter-spacing:.12em;margin:4px 0;}
.vr-crash-line{font-family:var(--mono);font-size:9px;color:#d3e0f4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.vr-crash-reco{font-family:var(--mono);font-size:9px;color:#e5c88a;margin-top:6px;}
.vr-statusbar{height:26px;display:flex;gap:14px;align-items:center;padding:0 10px;border-top:1px solid var(--bdr2);background:#111a29;font-family:var(--mono);font-size:9px;color:#8da4c8;flex-shrink:0;overflow-x:auto;}
.vr-statusbar::-webkit-scrollbar{height:0;}

/* Editor */
.ea-pane{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;}
.ea-empty{flex:1;display:flex;align-items:center;justify-content:center;background:var(--bg);}
.ea-empty-in{text-align:center;}
.ea-empty-icon{display:block;font-family:var(--mono);font-size:28px;color:#506887;margin-bottom:12px;}
.ea-empty-in p{font-family:var(--mono);font-size:11px;color:#9cb3d4;}
.ea-empty-in small{font-family:var(--mono);font-size:9px;color:#6f87aa;margin-top:5px;display:block;}
.ea-tabs{display:flex;height:36px;background:linear-gradient(180deg,#111a2a,#0f1725);border-bottom:1px solid var(--bdr);overflow-x:auto;flex-shrink:0;}
.ea-tabs::-webkit-scrollbar{height:0;}
.ea-tab{display:flex;align-items:center;gap:5px;padding:0 12px;height:100%;font-family:var(--mono);font-size:11px;color:var(--t3);border-right:1px solid var(--bdr2);cursor:pointer;white-space:nowrap;flex-shrink:0;transition:color .1s;background:#101828;}
.ea-tab:hover{color:var(--t2);background:var(--bg2);}
.ea-tab.on{color:var(--text);background:#162338;border-bottom:2px solid #86abd9;}
.ea-tab-dot{color:var(--yel);font-size:9px;}
.ea-tab-x{color:var(--t3);font-size:14px;opacity:0;transition:opacity .1s;padding:0 2px;}
.ea-tab:hover .ea-tab-x{opacity:1;}
.ea-tab-x:hover{color:var(--red);}
.ea-wrap{flex:1;overflow:hidden;}

/* Map toggle */
.vr-map-btn{position:absolute;right:292px;top:50%;transform:translateY(-50%);width:16px;height:50px;background:#16243a;border:1px solid #304663;border-radius:6px;color:#93abd0;font-size:10px;cursor:pointer;outline:none;display:flex;align-items:center;justify-content:center;transition:all .15s;z-index:10;}
.vr-map-btn:hover{color:var(--text);background:var(--bg3);}
.vr-map-loading,.vr-panel-loading{display:flex;align-items:center;justify-content:center;padding:20px;color:#6e7681;font-size:11px;}
.vr-ext-panel{display:flex;flex-direction:column;height:100%;overflow:hidden;}
.vr-ext-title{padding:8px 12px;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#6e7681;border-bottom:1px solid var(--border);}
.vr-ext-list{flex:1;overflow:auto;padding:6px;}
.vr-ext-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;font-size:11px;}
.vr-ext-item:hover{background:var(--bg2);}
.vr-ext-name{flex:1;overflow:hidden;text-overflow:ellipsis;}
.vr-ext-ver{color:#6e7681;font-size:10px;}
.vr-ext-btn{min-width:36px;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg2);color:#8b949e;font-size:10px;cursor:pointer;}
.vr-ext-btn.on{background:#238636;border-color:#2ea043;color:#fff;}
.vr-ext-empty{padding:12px;color:#6e7681;font-size:11px;}
.vr-cmd-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(2px);z-index:3000;display:flex;align-items:flex-start;justify-content:center;padding-top:70px;}
.vr-cmd{width:min(760px,92vw);background:#111b2d;border:1px solid #2a3d5a;border-radius:12px;overflow:hidden;box-shadow:0 18px 60px rgba(0,0,0,.8);}
.vr-cmd-input{width:100%;height:42px;background:#0c1522;border:none;border-bottom:1px solid #24354f;padding:0 14px;color:#e9f1ff;font-family:var(--mono);font-size:12px;outline:none;}
.vr-cmd-list{max-height:320px;overflow:auto;padding:6px;}
.vr-cmd-list::-webkit-scrollbar{width:4px;}
.vr-cmd-list::-webkit-scrollbar-thumb{background:#334a6a;border-radius:10px;}
.vr-cmd-item{width:100%;display:flex;align-items:center;justify-content:space-between;background:transparent;border:none;border-radius:4px;padding:8px 10px;color:#d4d4d4;cursor:pointer;font-family:var(--mono);font-size:11px;text-align:left;}
.vr-cmd-item:hover{background:#1b2a42;}
.vr-cmd-item small{color:#7f98bb;font-size:9px;margin-left:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.vr-cmd-empty{padding:16px;font-family:var(--mono);font-size:11px;color:#7c95b9;}
.vr-safe-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(2px);z-index:3500;display:flex;align-items:center;justify-content:center;padding:20px;}
.vr-safe-card{width:min(640px,95vw);background:#11161f;border:1px solid #2a3442;border-radius:10px;padding:16px;box-shadow:0 20px 60px rgba(0,0,0,.8);}
.vr-safe-title{font-family:var(--mono);font-size:10px;letter-spacing:.18em;color:#9db2d2;margin-bottom:8px;}
.vr-safe-cmd{font-family:var(--mono);font-size:11px;color:#dbe5f1;background:#0c121a;border:1px solid #273242;padding:8px;border-radius:6px;margin-bottom:10px;word-break:break-all;}
.vr-safe-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.vr-safe-grid div{background:#0c121a;border:1px solid #273242;border-radius:6px;padding:8px;display:flex;flex-direction:column;gap:4px;}
.vr-safe-grid span{font-family:var(--mono);font-size:9px;color:#7388a7;}
.vr-safe-grid b{font-family:var(--mono);font-size:10px;color:#dbe5f1;font-weight:500;}
.vr-safe-engine{margin-top:10px;font-family:var(--mono);font-size:9px;color:#7d92b2;}
.vr-safe-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px;}
.vr-safe-cancel,.vr-safe-confirm{height:30px;padding:0 11px;border-radius:6px;font-family:var(--mono);font-size:10px;cursor:pointer;}
.vr-safe-cancel{border:1px solid #2a3442;background:#141b25;color:#9fb3d4;}
.vr-safe-confirm{border:1px solid #a1b7d6;background:#b3c6df;color:#0b1119;font-weight:700;}
@media (max-width: 980px){
  .vr-workbar{padding:0 6px;}
  .vr-breadcrumbs{display:none;}
  .vr-map-btn{right:0;top:0;transform:none;bottom:8px;top:auto;}
}
@media (max-width: 760px){
  .vr-body{flex-direction:column;}
  .vr-split{min-height:280px;}
  .vr-safe-grid{grid-template-columns:1fr;}
}
`;

const AUTH_CSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap');
.auth-root{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:
  linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px),
  linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px),
  radial-gradient(circle at top left, rgba(65,112,180,.12), transparent 35%),
  #0b0f14;}
.auth-card{width:min(460px,94vw);background:rgba(17,20,27,.82);border:1px solid #273142;border-radius:10px;padding:22px;backdrop-filter:blur(8px);box-shadow:0 20px 60px rgba(0,0,0,.55);}
.auth-brand{display:flex;align-items:center;gap:8px;margin-bottom:12px;}
.auth-logo{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;letter-spacing:.2em;color:#f1f5f9;}
.auth-sep{color:#3d4b61;}
.auth-sub{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.16em;color:#7d8ea8;}
.auth-title{font-family:'Space Grotesk',sans-serif;font-size:24px;line-height:1.2;color:#e3ebf6;margin-bottom:6px;}
.auth-desc{font-family:'JetBrains Mono',monospace;font-size:10px;color:#7b8ca6;margin-bottom:14px;}
.auth-input{width:100%;height:38px;background:#0b1119;border:1px solid #2a3442;border-radius:6px;color:#e3ebf6;font-family:'JetBrains Mono',monospace;font-size:11px;padding:0 11px;margin-bottom:8px;outline:none;}
.auth-input:focus{border-color:#3a4f6d;}
.auth-actions{display:flex;gap:8px;margin-top:8px;}
.auth-primary{height:34px;padding:0 12px;border:1px solid #89a9d6;background:#9eb9de;color:#0b1119;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;}
.auth-secondary{height:34px;padding:0 12px;border:1px solid #2a3442;background:#111827;color:#9fb1ca;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:10px;cursor:pointer;}
.auth-primary:hover{filter:brightness(1.05);}
.auth-secondary:hover{color:#d0ddf1;border-color:#3a4b63;}
.auth-error{border:1px solid #57343c;background:#1a1013;color:#f3b1bb;border-radius:6px;padding:8px 10px;font-family:'JetBrains Mono',monospace;font-size:10px;margin-top:8px;}
.auth-guest-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding-top:12px;border-top:1px solid #1d2734;}
.auth-checkbox{display:flex;align-items:center;gap:8px;font-family:'JetBrains Mono',monospace;font-size:10px;color:#96a9c7;}
.auth-guest-btn{height:30px;padding:0 11px;border:1px solid #2a3442;background:#111827;color:#adc1de;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:10px;cursor:pointer;}
.auth-guest-btn:disabled{opacity:.45;cursor:not-allowed;}
`;
