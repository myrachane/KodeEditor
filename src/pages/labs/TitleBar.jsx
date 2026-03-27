// src/pages/labs/TitleBar.jsx
// Custom frameless window titlebar — drag region + run + live resources + window controls

import { useState, useEffect, useRef } from "react";

const api = window.studio;

const INTERPRETER_LABELS = {
  auto: "AUTO",
  node: "NODE.JS",
  python: "PYTHON 3",
  ts: "TS-NODE",
  deno: "DENO",
  bun: "BUN",
};

function ResourceStrip() {
  const [stats, setStats] = useState({ cpuPercent: 0, memoryMB: 0 });
  const prevCpuRef = useRef(null);
  const prevTimeRef = useRef(Date.now());

  useEffect(() => {
    if (!api?.system?.stats) return;
    const tick = async () => {
      const res = await api.system.stats();
      if (!res?.ok) return;
      const now = Date.now();
      const prevTime = prevTimeRef.current;
      const elapsedSec = (now - prevTime) / 1000;
      prevTimeRef.current = now;
      const totalCpu = (res.cpuUser || 0) + (res.cpuSystem || 0);
      if (prevCpuRef.current != null && elapsedSec > 0.3) {
        const delta = totalCpu - prevCpuRef.current;
        const percent = Math.min(100, Math.round((delta / 1e6 / elapsedSec) * 100));
        setStats(s => ({ ...s, cpuPercent: percent, memoryMB: res.rssMB || 0 }));
      } else {
        setStats(s => ({ ...s, memoryMB: res.rssMB || 0 }));
      }
      prevCpuRef.current = totalCpu;
    };
    tick();
    const id = setInterval(tick, 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="tb-resource">
      <span className="tb-res-cpu" title="CPU usage">CPU {stats.cpuPercent}%</span>
      <span className="tb-res-sep">|</span>
      <span className="tb-res-mem" title="Memory (RSS)">MEM {stats.memoryMB} MB</span>
    </div>
  );
}

export default function TitleBar({
  workspace,
  isRunning,
  onRun,
  onStop,
  onChangeWorkspace,
  onSettings,
  onJane,
  interpreter = "node",
}) {
  const [maximized, setMaximized] = useState(false);
  const project = workspace ? workspace.split(/[\\/]/).pop() : null;

  useEffect(()=>{
    api?.win.isMaximized().then(v=>setMaximized(v));
  },[]);

  return (
    <>
      <style>{CSS}</style>
      <div className="tb-root">
        <div className="tb-drag">
          <span className="tb-logo">VISRODECK</span>
          <span className="tb-sep">/</span>
          <span className="tb-sub">STUDIO</span>
          {project && (
            <button className="tb-project" onClick={onChangeWorkspace}>
              <span className="tb-dot"/>
              {project}
            </button>
          )}
        </div>

        <div className="tb-center">
          <div className="tb-interp"><span className="tb-interp-dot"/>{INTERPRETER_LABELS[interpreter] || "NODE.JS"}</div>
          <button className="tb-run" onClick={onRun} disabled={isRunning}>
            {isRunning ? <><span className="tb-spin"/>RUNNING</> : <>▶ RUN</>}
          </button>
          <button className="tb-stop" onClick={onStop} disabled={!isRunning}>■ STOP</button>
          <button className="tb-settings" onClick={onSettings}>⚙ SETTINGS</button>
          <button className="tb-jane" onClick={onJane}>✦ JANE</button>
        </div>

        {api?.system?.stats && (
          <div className="tb-res-wrap">
            <ResourceStrip />
          </div>
        )}

        <div className="tb-winctrl">
          <button className="tb-wbtn tb-min" onClick={()=>api?.win.minimize()} title="Minimize">─</button>
          <button className="tb-wbtn tb-max" onClick={()=>{api?.win.maximize();setMaximized(m=>!m);}} title="Maximize">
            {maximized ? "❐" : "□"}
          </button>
          <button className="tb-wbtn tb-close" onClick={()=>api?.win.close()} title="Close">✕</button>
        </div>
      </div>
    </>
  );
}

const CSS = `
.tb-root {
  height: 42px;
  display: flex;
  align-items: center;
  background: #000000;
  border-bottom: 1px solid #253248;
  flex-shrink: 0;
  -webkit-app-region: drag;   /* makes it draggable */
  user-select: none;
}

/* Drag left side */
.tb-drag {
  display: flex; align-items: center; gap: 7px;
  padding: 0 14px; flex: 1;
  -webkit-app-region: drag;
}
.tb-logo {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px; font-weight: 700;
  letter-spacing: .2em; color: #edf4ff;
}
.tb-sep { color: #3a4d6b; font-size: 14px; }
.tb-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px; letter-spacing: .18em; color: #6b83a7;
}
.tb-project {
  display: flex; align-items: center; gap: 5px;
  font-family: 'JetBrains Mono', monospace; font-weight: 500;
  font-size: 10px; color: #9ab0d0;
  background: rgba(0, 0, 0, 0.8); border: 1px solid #2c3b51;
  padding: 4px 10px; border-radius: 999px;
  cursor: pointer; transition: border-color .15s; outline: none;
  -webkit-app-region: no-drag;
}
.tb-project:hover { border-color: #5e7ba8; color: #ebf3ff; }
.tb-dot { width: 5px; height: 5px; border-radius: 50%; background: #5be2a7; flex-shrink: 0; box-shadow: 0 0 6px #5be2a7; }

/* Center — no drag */
.tb-center {
  display: flex; align-items: center; gap: 6px;
  padding: 0 10px;
  -webkit-app-region: no-drag;
}
.tb-interp {
  display: flex; align-items: center; gap: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px; font-weight: 600; letter-spacing: .1em;
  color: #95abcb; background: #101826;
  border: 1px solid #283851; padding: 4px 9px; border-radius: 999px;
}
.tb-interp-dot { width: 4px; height: 4px; border-radius: 50%; background: #5be2a7; }

.tb-run {
  display: flex; align-items: center; gap: 4px;
  background: linear-gradient(180deg,#d2e3fb,#aec8e9); color: #0b1119;
  border: 1px solid #a1bddf;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px; font-weight: 700; letter-spacing: .08em;
  padding: 5px 12px; border-radius: 7px; cursor: pointer;
  transition: all .12s; outline: none;
}
.tb-run:hover:not(:disabled) { filter: brightness(1.06); }
.tb-run:disabled { opacity: .3; cursor: not-allowed; }

.tb-stop {
  background: transparent; color: #e05c5c;
  border: 1px solid rgba(224,92,92,.45);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px; font-weight: 700; letter-spacing: .08em;
  padding: 5px 10px; border-radius: 7px; cursor: pointer;
  transition: all .12s; outline: none;
}
.tb-stop:hover:not(:disabled) { background: rgba(224,92,92,.1); }
.tb-stop:disabled { opacity: .25; cursor: not-allowed; }

.tb-settings,
.tb-jane {
  background: rgba(16,24,36,.7); color: #8ea4c7;
  border: 1px solid #2a3a50;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px; font-weight: 600;
  padding: 5px 10px; border-radius: 7px; cursor: pointer;
  transition: all .12s; outline: none;
}
.tb-settings:hover,
.tb-jane:hover { color: #eff5ff; border-color: #5876a1; background:#152033; }

.tb-spin {
  display: inline-block; width: 7px; height: 7px;
  border: 1.5px solid #0a0a0b; border-top-color: transparent;
  border-radius: 50%; animation: tbspin .55s linear infinite;
}
@keyframes tbspin { to{transform:rotate(360deg)} }

/* Window controls */
.tb-winctrl {
  display: flex; align-items: center;
  padding-right: 2px;
  -webkit-app-region: no-drag;
}
.tb-wbtn {
  width: 42px; height: 42px;
  background: transparent; border: none;
  font-size: 11px; cursor: pointer;
  transition: background .12s; outline: none;
  display: flex; align-items: center; justify-content: center;
  color: #6e84a7; font-family: 'JetBrains Mono', monospace;
}
.tb-wbtn:hover { color: #ecf3ff; }
.tb-min:hover  { background: #152033; }
.tb-max:hover  { background: #152033; }
.tb-close:hover{ background: #c42b1c; color: #fff; }

.tb-res-wrap { -webkit-app-region: no-drag; padding: 0 12px; }
.tb-resource { display: flex; align-items: center; gap: 8px; font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #6b83a7; }
.tb-res-cpu { color: #7ad79c; }
.tb-res-sep { opacity: .5; }
.tb-res-mem { color: #79b8ff; }
`;
