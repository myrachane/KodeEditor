// src/pages/labs/WorkspaceSetup.jsx
import { useState } from "react";

export default function WorkspaceSetup({ onSelect, onBrowse }){
  const [path,setPath]=useState("");
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);

  const browse = async()=>{
    setLoading(true);try{await onBrowse();}finally{setLoading(false);}
  };
  const open = ()=>{
    const p=path.trim();
    if(!p){setErr("Enter a directory path.");return;}
    setErr(""); onSelect(p);
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="ws-root">
        <div className="ws-card">
          <div className="ws-hdr">
            <div className="ws-brand">
              <span className="ws-logo">VISRODECK</span>
              <span className="ws-sep">/</span>
              <span className="ws-sub">STUDIO</span>
            </div>
            <span className="ws-badge">DESKTOP</span>
          </div>
          <div className="ws-body">
            <h1 className="ws-title">Open Workspace</h1>
            <p className="ws-desc">Select a local project directory. Dependencies install automatically.</p>
            <div className="ws-row">
              <div className="ws-iw">
                <span className="ws-iicon">⌂</span>
                <input className="ws-input" type="text" placeholder="/path/to/project"
                  value={path} onChange={e=>setPath(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&open()}/>
              </div>
              <button className="ws-btn ws-browse" onClick={browse} disabled={loading}>
                {loading?<span className="ws-spin"/>:"Browse"}
              </button>
            </div>
            {err&&<div className="ws-err">{err}</div>}
            <div className="ws-actions">
              <button className="ws-btn ws-open" onClick={open} disabled={!path.trim()}>
                Open Workspace →
              </button>
            </div>
            <div className="ws-info">
              <span className="ws-info-dot"/>
              Native terminal · File explorer · Node graph · Multi-tab
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap');
.ws-root{min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:'Space Grotesk',sans-serif;padding:24px;-webkit-app-region:drag;background:
linear-gradient(rgba(255,255,255,.016) 1px, transparent 1px),
linear-gradient(90deg, rgba(255,255,255,.016) 1px, transparent 1px),
radial-gradient(circle at top left, rgba(84,120,173,.16), transparent 38%),
#000205;background-size:24px 24px,24px 24px,100% 100%,auto;}
.ws-card{width:100%;max-width:560px;background:rgba(0, 0, 0, 0.8);border:1px solid #2b3b54;border-radius:14px;overflow:hidden;-webkit-app-region:no-drag;backdrop-filter:blur(10px);box-shadow:0 24px 72px rgba(0,0,0,.45);}
.ws-hdr{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid #233248;}
.ws-brand{display:flex;align-items:baseline;gap:7px;}
.ws-logo{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;letter-spacing:.2em;color:#eef5ff;}
.ws-sep{color:#4f6486;}
.ws-sub{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.15em;color:#7a94ba;}
.ws-badge{font-family:'JetBrains Mono',monospace;font-size:8px;font-weight:700;letter-spacing:.15em;color:#5be2a7;border:1px solid rgba(91,226,167,.3);padding:4px 9px;border-radius:20px;background:#102024;}
.ws-body{padding:30px 24px 24px;}
.ws-title{font-size:28px;font-weight:700;letter-spacing:-.03em;color:#eef5ff;margin-bottom:8px;}
.ws-desc{font-size:13px;color:#8da4c7;margin-bottom:22px;line-height:1.6;}
.ws-row{display:flex;gap:8px;margin-bottom:10px;}
.ws-iw{flex:1;position:relative;display:flex;align-items:center;}
.ws-iicon{position:absolute;left:10px;font-size:12px;color:#5e779a;pointer-events:none;}
.ws-input{width:100%;background:#0e1522;border:1px solid #2d3f5a;color:#e8f0fc;font-family:'JetBrains Mono',monospace;font-size:11px;padding:10px 10px 10px 30px;border-radius:8px;outline:none;transition:border-color .15s, box-shadow .15s;}
.ws-input:focus{border-color:#5a7ead;box-shadow:0 0 0 3px rgba(95,134,189,.22);}
.ws-input::placeholder{color:#6f87aa;}
.ws-err{font-family:'JetBrains Mono',monospace;font-size:10px;color:#f5b6be;padding:8px 10px;background:rgba(110,27,44,.3);border:1px solid rgba(224,92,92,.35);border-radius:6px;margin-bottom:10px;}
.ws-actions{margin-top:18px;display:flex;justify-content:flex-end;}
.ws-btn{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;letter-spacing:.08em;padding:9px 14px;border-radius:8px;cursor:pointer;border:1px solid;transition:all .12s;outline:none;display:flex;align-items:center;gap:5px;}
.ws-btn:disabled{opacity:.3;cursor:not-allowed;}
.ws-browse{background:#132033;color:#9db4d5;border-color:#2f4464;}
.ws-browse:hover:not(:disabled){color:#eff5ff;border-color:#5e80b1;background:#192a42;}
.ws-open{background:linear-gradient(180deg,#d4e4fb,#aec8ea);color:#0a121d;border-color:#a5c0e4;font-size:12px;padding:10px 20px;font-weight:700;}
.ws-open:hover:not(:disabled){filter:brightness(1.06);}
.ws-info{display:flex;align-items:center;gap:6px;margin-top:16px;font-family:'JetBrains Mono',monospace;font-size:9px;color:#6c85aa;}
.ws-info-dot{width:5px;height:5px;border-radius:50%;background:#5be2a7;flex-shrink:0;box-shadow:0 0 6px #5be2a7;}
.ws-spin{display:inline-block;width:9px;height:9px;border:1.5px solid #5f7798;border-top-color:#dce8fb;border-radius:50%;animation:wsspin .6s linear infinite;}
@keyframes wsspin{to{transform:rotate(360deg)}}
`;
