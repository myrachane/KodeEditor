// src/pages/labs/MultiTerminal.jsx
// Multi-tab terminal — each tab is an independent pty session

import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

const s = typeof window !== "undefined" ? window.studio : null;
let tabCounter = 1;

export default function MultiTerminal({ isRunning, outputLines, debugLines, problems = [], onOpenProblem }) {
  const [tabs, setTabs] = useState([{ id: 1, label: "bash 1", sessionId: null }]);
  const [activeId, setActiveId] = useState(1);
  const [panelTab, setPanelTab] = useState("output");
  const activeIdRef = useRef(activeId);

  // Map of tabId -> { term, fit, ro, unsubs }
  const instancesRef = useRef({});

  const initTerm = useCallback((id, el) => {
    if (!el || instancesRef.current[id]?.term) return;

    const term = new Terminal({
      theme: {
        background: "#000000", foreground: "#e2e2e2", cursor: "#fff",
        selectionBackground: "#ffffff22",
        black: "#111",   brightBlack: "#3a3a3d",
        red: "#e05c5c",  brightRed: "#ff7070",
        green: "#3ddc84",brightGreen: "#50f09b",
        yellow: "#e8c06a",brightYellow: "#f0d080",
        blue: "#5b9cf6", brightBlue: "#7ab4ff",
        magenta: "#b87fd4",brightMagenta: "#d09ee8",
        cyan: "#4ec9c9", brightCyan: "#66e0e0",
        white: "#d4d4d4",brightWhite: "#fff",
      },
      fontFamily: '"JetBrains Mono","Cascadia Code","Fira Code",monospace',
      fontSize: 12.5, lineHeight: 1.55, letterSpacing: 0.3,
      cursorBlink: true, cursorStyle: "bar",
      allowTransparency: true, scrollback: 3000, convertEol: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    setTimeout(() => { try { fit.fit(); } catch (_) {} }, 80);

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
        const t = tabsRef.current.find((x) => x.id === id);
        if (t?.sessionId) s?.pty.resize(t.sessionId, term.cols, term.rows);
      } catch (_) {}
    });
    ro.observe(el);

    term.writeln(`\x1b[1;37m  VISRODECK STUDIO\x1b[0m  \x1b[2mTerminal ${id}\x1b[0m`);
    term.writeln(`\x1b[2m  ────────────────────────────\x1b[0m\r\n`);

    // Input -> this tab session
    const dataSub = term.onData((data) => {
      const t = tabsRef.current.find((x) => x.id === id);
      if (t?.sessionId) s?.pty.write(t.sessionId, data);
    });

    instancesRef.current[id] = {
      term,
      fit,
      ro,
      unsubs: [() => dataSub.dispose()],
    };
  }, []);

  const tabsRef = useRef(tabs);
  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    activeIdRef.current = activeId;
    const active = instancesRef.current[activeId];
    if (active) {
      try { active.fit.fit(); } catch (_) {}
    }
  }, [activeId]);

  const termOutBuf = useRef({});
  const termFlushRef = useRef(null);
  useEffect(() => {
    const flush = () => {
      termFlushRef.current = null;
      const buf = termOutBuf.current;
      for (const tabId of Object.keys(buf)) {
        const str = buf[tabId];
        if (!str) continue;
        delete buf[tabId];
        const inst = instancesRef.current[Number(tabId)];
        try { inst?.term?.write(str); } catch (_) {}
      }
    };
    const unData = s?.pty.onData((payload) => {
      const { sessionId, data } = payload || {};
      if (!sessionId || !data) return;
      const tab = tabsRef.current.find((t) => t.sessionId === sessionId);
      if (!tab) return;
      const id = tab.id;
      termOutBuf.current[id] = (termOutBuf.current[id] || "") + data;
      if (!termFlushRef.current) termFlushRef.current = setTimeout(flush, 32);
    });
    const unExit = s?.pty.onExit((payload) => {
      const { sessionId, code } = payload || {};
      const tab = tabsRef.current.find((t) => t.sessionId === sessionId);
      if (!tab) return;
      const inst = instancesRef.current[tab.id];
      inst?.term?.writeln(`\r\n\x1b[2m[exited: ${Number(code ?? 0)}]\x1b[0m\r\n`);
    });
    return () => {
      if (termFlushRef.current) clearTimeout(termFlushRef.current);
      try { unData?.(); } catch (_) {}
      try { unExit?.(); } catch (_) {}
    };
  }, []);

  useEffect(() => () => {
    Object.values(instancesRef.current).forEach(inst => {
      inst.unsubs?.forEach(fn => { try { fn(); } catch (_) {} });
      inst.ro?.disconnect();
      inst.term?.dispose();
    });
    instancesRef.current = {};
  }, []);

  const createSessionForTab = async () => {
    try {
      const res = await s?.pty?.create?.();
      return res?.sessionId || null;
    } catch (_) {
      return null;
    }
  };

  useEffect(() => {
    // Ensure first tab has a session
    (async () => {
      if (tabsRef.current[0]?.sessionId) return;
      const sessionId = await createSessionForTab();
      if (!sessionId) return;
      setTabs((prev) => prev.map((t, idx) => (idx === 0 ? { ...t, sessionId } : t)));
    })();
  }, []);

  const addTab = async () => {
    const id = ++tabCounter;
    const sessionId = await createSessionForTab();
    setTabs((t) => [...t, { id, label: `bash ${id}`, sessionId }]);
    setActiveId(id);
  };

  const closeTab = (id) => {
    if (tabs.length === 1) return;
    const tab = tabs.find((t) => t.id === id);
    if (tab?.sessionId) {
      try {
        s?.pty?.dispose?.(tab.sessionId);
      } catch (_) {}
    }
    const inst = instancesRef.current[id];
    if (inst) {
      inst.unsubs.forEach(fn => { try { fn(); } catch (_) {} });
      inst.ro?.disconnect();
      inst.term?.dispose();
      delete instancesRef.current[id];
    }
    setTabs(prev => {
      const nextTabs = prev.filter(x => x.id !== id);
      setActiveId(prevActive => {
        if (prevActive !== id) return prevActive;
        return nextTabs[nextTabs.length - 1]?.id ?? 1;
      });
      return nextTabs;
    });
  };

  // Tab container refs
  const tabRefs = useRef({});
  const setTabRef = (id) => (el) => {
    if (el && !tabRefs.current[id]) {
      tabRefs.current[id] = el;
      initTerm(id, el);
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="mt-root">
        <div className="mt-tabs-row">
          {["terminal","output","problems","debug"].map(t => (
            <button key={t} className={`mt-panel-tab${panelTab===t?" on":""}`}
              onClick={() => setPanelTab(t)}>
              {t.toUpperCase()}
              {t === "output" && outputLines.length > 0 &&
                <span className="mt-badge">{outputLines.length}</span>}
              {t === "problems" && problems.length > 0 &&
                <span className="mt-badge err">{problems.length}</span>}
            </button>
          ))}

          {panelTab === "terminal" && (
            <>
              <div className="mt-divider"/>
              {tabs.map(tab => (
                <div key={tab.id}
                  className={`mt-term-tab${activeId===tab.id?" on":""}`}
                  onClick={() => setActiveId(tab.id)}>
                  <span className="mt-term-tab-dot"/>
                  <span>{tab.label}</span>
                  {tabs.length > 1 && (
                    <span className="mt-term-tab-x"
                      onClick={e => { e.stopPropagation(); closeTab(tab.id); }}>×</span>
                  )}
                </div>
              ))}
              <button className="mt-new-tab" onClick={addTab} title="New terminal">+</button>
            </>
          )}

          <div style={{ flex: 1 }}/>
          <div className={`mt-status${isRunning?" running":""}`}>
            <span/>{isRunning ? "RUNNING" : "READY"}
          </div>
        </div>

        <div className="mt-body">
          {panelTab === "terminal" && tabs.map(tab => (
            <div key={tab.id}
              ref={setTabRef(tab.id)}
              className="mt-term-host"
              style={{ display: activeId === tab.id ? "flex" : "none" }}
            />
          ))}

          {panelTab === "output" && (
            <div className="mt-log">
              {outputLines.length === 0
                ? <div className="mt-hint">No output yet — hit RUN</div>
                : outputLines.map((l, i) => (
                  <div key={i} className={`mt-row ${l.type}`}>
                    <span className="mt-badge-row">{l.type === "err" ? "ERR" : "OUT"}</span>
                    <span>{l.text}</span>
                  </div>
                ))}
            </div>
          )}

          {panelTab === "problems" && (
            <div className="mt-log">
              {problems.length === 0
                ? <div className="mt-hint">No problems detected</div>
                : problems.map((p, i) => (
                  <button key={`${p.file}:${p.line}:${i}`} className="mt-problem" onClick={() => onOpenProblem?.(p)}>
                    <span className="mt-problem-tag">{p.source === "runtime" ? "RUNTIME" : "LINT"}</span>
                    <span className="mt-problem-main">
                      <span className="mt-problem-file">{p.file}:{p.line}</span>
                      <span className="mt-problem-msg">{p.message}</span>
                    </span>
                  </button>
                ))}
            </div>
          )}

          {panelTab === "debug" && (
            <div className="mt-log">
              {debugLines.length === 0
                ? <div className="mt-hint">Debug events here</div>
                : debugLines.map((l, i) => (
                  <div key={i} className="mt-row dbg">
                    <span className="mt-badge-row">DBG</span>
                    <span>{l}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const CSS = `
.mt-root{height:240px;display:flex;flex-direction:column;flex-shrink:0;background:linear-gradient(180deg,#0d131f,#0a1019);}
.mt-tabs-row{display:flex;align-items:center;height:34px;background:#111a29;border-bottom:1px solid #2a3950;flex-shrink:0;overflow-x:auto;}
.mt-tabs-row::-webkit-scrollbar{height:0;}
.mt-panel-tab{display:flex;align-items:center;gap:5px;height:100%;padding:0 14px;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:600;letter-spacing:.12em;color:#6f85a6;background:transparent;border:none;border-right:1px solid #1c293b;cursor:pointer;transition:color .1s;outline:none;white-space:nowrap;flex-shrink:0;}
.mt-panel-tab:hover{color:#bfd0e9;}
.mt-panel-tab.on{color:#f0f6ff;border-bottom:2px solid #82a8df;background:#0f1725;}
.mt-badge{background:#1b2638;border:1px solid #30435f;font-size:8px;padding:1px 4px;border-radius:10px;color:#9eb3d2;}
.mt-badge.err{color:#e05c5c;border-color:#4a2525;background:#1d1313;}
.mt-divider{width:1px;height:18px;background:#2c3c55;margin:0 4px;flex-shrink:0;}
.mt-term-tab{display:flex;align-items:center;gap:5px;height:100%;padding:0 10px;font-family:'JetBrains Mono',monospace;font-size:10px;color:#7891b5;cursor:pointer;transition:all .1s;white-space:nowrap;flex-shrink:0;border-right:1px solid #1a2738;}
.mt-term-tab:hover{color:#d6e3f7;background:#141f31;}
.mt-term-tab.on{color:#eef5ff;background:#0f1725;border-bottom:2px solid #5be2a7;}
.mt-term-tab-dot{width:5px;height:5px;border-radius:50%;background:#5be2a7;flex-shrink:0;}
.mt-term-tab.on .mt-term-tab-dot{box-shadow:0 0 7px #5be2a7;}
.mt-term-tab-x{color:#536989;font-size:13px;line-height:1;margin-left:2px;padding:0 2px;transition:color .1s;}
.mt-term-tab-x:hover{color:#e05c5c;}
.mt-new-tab{height:100%;padding:0 10px;background:transparent;border:none;border-right:1px solid #1a2738;color:#5e7498;font-size:16px;cursor:pointer;transition:color .1s;outline:none;flex-shrink:0;}
.mt-new-tab:hover{color:#d5e3f7;background:#162338;}
.mt-status{display:flex;align-items:center;gap:5px;font-family:'JetBrains Mono',monospace;font-size:8px;font-weight:600;letter-spacing:.1em;padding:0 14px;color:#62799d;}
.mt-status span{width:5px;height:5px;border-radius:50%;background:#445975;display:block;}
.mt-status.running{color:#5be2a7;}
.mt-status.running span{background:#5be2a7;box-shadow:0 0 5px #5be2a7;}
.mt-body{flex:1;overflow:hidden;}
.mt-term-host{width:100%;height:100%;padding:6px 10px;box-sizing:border-box;flex-direction:column;pointer-events:auto;cursor:text;}
.mt-term-host .xterm{height:100%;}
.mt-term-host .xterm-viewport{background:transparent!important;}
.mt-term-host .xterm-screen{cursor:text!important;}
.mt-log{height:100%;overflow-y:auto;padding:8px 12px;box-sizing:border-box;}
.mt-log::-webkit-scrollbar{width:6px;}
.mt-log::-webkit-scrollbar-thumb{background:#2f425f;border-radius:10px;}
.mt-hint{font-family:'JetBrains Mono',monospace;font-size:10px;color:#3a3a40;padding:14px 0;}
.mt-row{display:flex;gap:10px;align-items:baseline;font-family:'JetBrains Mono',monospace;font-size:11px;padding:2px 0;border-bottom:1px solid #1a1a1d;line-height:1.5;}
.mt-row.err{color:#e05c5c;}
.mt-row.dbg{color:#3a3a40;}
.mt-badge-row{font-size:7px;font-weight:700;letter-spacing:.1em;color:#3a3a40;flex-shrink:0;width:22px;}
.mt-problem{width:100%;display:flex;gap:8px;align-items:flex-start;text-align:left;background:#101013;border:1px solid #232328;border-radius:4px;padding:7px 8px;margin-bottom:6px;color:#d6d6d8;cursor:pointer;}
.mt-problem:hover{border-color:#3a3a40;background:#151518;}
.mt-problem-tag{font-family:'JetBrains Mono',monospace;font-size:8px;color:#e08b8b;flex-shrink:0;padding-top:2px;}
.mt-problem-main{display:flex;flex-direction:column;gap:2px;min-width:0;}
.mt-problem-file{font-family:'JetBrains Mono',monospace;font-size:10px;color:#8d8d96;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.mt-problem-msg{font-family:'JetBrains Mono',monospace;font-size:10px;color:#cfcfd4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}
`;
