// src/pages/labs/SettingsPanel.jsx — Redesigned settings + About + Dependencies
import { useState } from "react";

function getBuildInfo() {
  const v = typeof window !== "undefined" && window.studio?.versions ? window.studio.versions : {};
  return {
    version: "0.5.0",
    productName: "Visrodeck Studio",
    vendor: "Visrodeck Technology",
    digitalSignature: "Visrodeck Technology",
    license: "Proprietary — Visrodeck Technology. All rights reserved.",
  };
}

const THEMES = [
  { id:"dark",    label:"Dark",         bg:"#0a0a0b", accent:"#fff"    },
  { id:"light",   label:"Light",        bg:"#eef3fb", accent:"#24496f" },
  { id:"darker",  label:"Darker",       bg:"#050506", accent:"#3ddc84" },
  { id:"midnight",label:"Midnight Blue",bg:"#060812", accent:"#5b9cf6" },
  { id:"carbon",  label:"Carbon",       bg:"#0d0d0d", accent:"#e8c06a" },
];

const INTERPRETERS = [
  { id:"auto",   label:"Auto",      cmd:"smart detect",icon:"⚡", color:"#4ec9c9" },
  { id:"node",   label:"Node.js",   cmd:"node",   icon:"⬡", color:"#68c142" },
  { id:"python", label:"Python 3",  cmd:"python3",icon:"🐍", color:"#3776ab" },
  { id:"ts",     label:"ts-node",   cmd:"ts-node",icon:"⬡", color:"#3178c6" },
  { id:"deno",   label:"Deno",      cmd:"deno run",icon:"🦕",color:"#fff" },
  { id:"bun",    label:"Bun",       cmd:"bun",    icon:"🥟", color:"#f5c542" },
];

const EXTENSIONS = [
  { id:"prettier", label:"Prettier",        desc:"Code formatter",           enabled:true  },
  { id:"eslint",   label:"ESLint",          desc:"JS/TS linting",            enabled:true  },
  { id:"gitblame", label:"Git Blame",       desc:"Inline git annotations",   enabled:false },
  { id:"bracket",  label:"Bracket Pairs",   desc:"Colorized bracket pairs",  enabled:true  },
  { id:"minimap",  label:"Minimap",         desc:"Editor overview ruler",    enabled:false },
  { id:"autosave", label:"Auto Save",       desc:"Save on focus loss",       enabled:false },
  { id:"wordwrap", label:"Word Wrap",       desc:"Wrap long lines",          enabled:true  },
  { id:"ligatures",label:"Font Ligatures",  desc:"JetBrains Mono ligatures", enabled:true  },
];

const KEYBINDINGS = [
  { action:"Run file",      key:"Ctrl+Enter" },
  { action:"Save file",     key:"Ctrl+S"     },
  { action:"Command palette",key:"Ctrl+P"   },
  { action:"Jane AI",       key:"Ctrl+J"     },
  { action:"Toggle map",    key:"Ctrl+M"     },
  { action:"New terminal",  key:"Ctrl+`"     },
  { action:"Close tab",     key:"Ctrl+W"     },
  { action:"Settings",      key:"Ctrl+,"     },
];

export default function SettingsPanel({
  onClose,
  settings,
  onSave,
  gitInfo,
  debugLines = [],
  dbStatus = { state: "idle", message: "" },
  onTestDb,
  account,
  onSignIn,
  onSignOut,
  workspace,
  onInstallDependencies,
}){
  const [tab,setTab]      = useState("about");
  const [local,setLocal]  = useState(settings);
  const [exts,setExts]    = useState(EXTENSIONS);
  const [db,setDb] = useState({ host: "127.0.0.1", port: "5432", timeoutMs: "2500" });
  const [signin,setSignin] = useState({ email: account?.email || "", name: account?.name || "" });
  const [depsLog, setDepsLog] = useState("");

  const buildInfo = getBuildInfo();
  const set = (key,val) => setLocal(s=>({...s,[key]:val}));
  const toggleExt = id => setExts(e=>e.map(x=>x.id===id?{...x,enabled:!x.enabled}:x));

  const runInstall = (cmd) => {
    setDepsLog(`Running: ${cmd}…`);
    onInstallDependencies?.(cmd);
    setTab("dependencies");
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="sp-overlay" onClick={onClose}>
        <div className="sp-panel" onClick={e=>e.stopPropagation()}>
          <div className="sp-header">
            <span className="sp-title">Settings</span>
            <button className="sp-close" onClick={onClose}>✕</button>
          </div>

          <div className="sp-body">
            <div className="sp-sidebar">
              {[
                {id:"about",icon:"ℹ",label:"About"},
                {id:"appearance",icon:"◑",label:"Appearance"},
                {id:"editor",    icon:"✎",label:"Editor"},
                {id:"interpreter",icon:"▶",label:"Interpreters"},
                {id:"dependencies",icon:"↓",label:"Dependencies"},
                {id:"database", icon:"🛢",label:"Database"},
                {id:"source", icon:"⑂",label:"Source Control"},
                {id:"debug", icon:"🐞",label:"Debug"},
                {id:"account", icon:"◎",label:"Account"},
                {id:"extensions",icon:"⊞",label:"Extensions"},
                {id:"keybindings",icon:"⌨",label:"Keybindings"},
              ].map(t=>(
                <button key={t.id} className={`sp-stab${tab===t.id?" on":""}`}
                  onClick={()=>setTab(t.id)}>
                  <span className="sp-stab-icon">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            <div className="sp-content">

              {/* ABOUT */}
              {tab==="about"&&(
                <div className="sp-section sp-about">
                  <div className="sp-about-hero">
                    <span className="sp-about-logo">VISRODECK</span>
                    <span className="sp-about-ver">Version {buildInfo.version}</span>
                  </div>
                  <div className="sp-sec-title">User account</div>
                  <div className="sp-about-block">
                    {account ? (
                      <div className="sp-kb-row"><span className="sp-kb-action">Signed in</span><span>{account.name} · {account.email}</span></div>
                    ) : (
                      <div className="sp-kb-row"><span className="sp-kb-action">Status</span><span>Not signed in</span></div>
                    )}
                  </div>
                  <div className="sp-sec-title">License</div>
                  <div className="sp-about-block sp-about-license">{buildInfo.license}</div>
                  <div className="sp-sec-title">Digital signature</div>
                  <div className="sp-about-block sp-about-sig">{buildInfo.digitalSignature}</div>
                  <div className="sp-sec-title">Build info</div>
                  <div className="sp-about-build">
                    <div className="sp-about-build-row"><span>Version</span><kbd>{buildInfo.version}</kbd></div>
                    <div className="sp-about-build-row"><span>Product</span><kbd>{buildInfo.productName}</kbd></div>
                    <div className="sp-about-build-row"><span>Vendor</span><kbd>{buildInfo.vendor}</kbd></div>
                    <div className="sp-about-build-row"><span>Electron</span><kbd>{buildInfo.electron}</kbd></div>
                    <div className="sp-about-build-row"><span>Chromium</span><kbd>{buildInfo.chrome}</kbd></div>
                    <div className="sp-about-build-row"><span>Node.js</span><kbd>{buildInfo.node}</kbd></div>
                  </div>
                </div>
              )}

              {/* DEPENDENCIES */}
              {tab==="dependencies"&&(
                <div className="sp-section">
                  <div className="sp-sec-title">Download / Install dependencies</div>
                  <p className="sp-deps-desc">Install project dependencies for the current workspace. Run in terminal.</p>
                  <div className="sp-deps-actions">
                    <button className="sp-deps-btn" onClick={()=>runInstall("npm install", "npm")} disabled={!workspace}>
                      npm install
                    </button>
                    <button className="sp-deps-btn" onClick={()=>runInstall("pnpm install", "pnpm")} disabled={!workspace}>
                      pnpm install
                    </button>
                    <button className="sp-deps-btn" onClick={()=>runInstall("yarn install", "yarn")} disabled={!workspace}>
                      yarn install
                    </button>
                    <button className="sp-deps-btn" onClick={()=>runInstall("python -m pip install -r requirements.txt", "pip")} disabled={!workspace}>
                      pip install -r requirements.txt
                    </button>
                  </div>
                  {!workspace && <p className="sp-deps-hint">Open a workspace first.</p>}
                  {depsLog && <div className="sp-deps-log">{depsLog}</div>}
                </div>
              )}

              {/* APPEARANCE */}
              {tab==="appearance"&&(
                <div className="sp-section">
                  <div className="sp-sec-title">THEME</div>
                  <div className="sp-themes">
                    {THEMES.map(t=>(
                      <button key={t.id} className={`sp-theme${local.theme===t.id?" on":""}`}
                        onClick={()=>set("theme",t.id)}>
                        <span className="sp-theme-swatch" style={{background:t.bg,boxShadow:`inset 0 0 0 1px ${t.accent}44`}}>
                          <span style={{width:8,height:8,borderRadius:"50%",background:t.accent,display:"block",margin:"auto"}}/>
                        </span>
                        <span className="sp-theme-name">{t.label}</span>
                        {local.theme===t.id&&<span className="sp-theme-check">✓</span>}
                      </button>
                    ))}
                  </div>

                  <div className="sp-sec-title" style={{marginTop:20}}>FONT SIZE</div>
                  <div className="sp-slider-row">
                    <span className="sp-slider-val">{local.fontSize}px</span>
                    <input type="range" min="10" max="20" step="1"
                      value={local.fontSize} onChange={e=>set("fontSize",+e.target.value)}
                      className="sp-slider"/>
                    <span className="sp-slider-lab">10–20</span>
                  </div>

                  <div className="sp-sec-title" style={{marginTop:20}}>LINE HEIGHT</div>
                  <div className="sp-slider-row">
                    <span className="sp-slider-val">{local.lineHeight.toFixed(1)}</span>
                    <input type="range" min="1.2" max="2.0" step="0.1"
                      value={local.lineHeight} onChange={e=>set("lineHeight",+e.target.value)}
                      className="sp-slider"/>
                    <span className="sp-slider-lab">1.2–2.0</span>
                  </div>

                  <div className="sp-sec-title" style={{marginTop:20}}>FONT FAMILY</div>
                  <select className="sp-select" value={local.fontFamily}
                    onChange={e=>set("fontFamily",e.target.value)}>
                    <option value="JetBrains Mono">JetBrains Mono</option>
                    <option value="Fira Code">Fira Code</option>
                    <option value="Cascadia Code">Cascadia Code</option>
                    <option value="Source Code Pro">Source Code Pro</option>
                    <option value="Inconsolata">Inconsolata</option>
                  </select>
                </div>
              )}

              {/* EDITOR */}
              {tab==="editor"&&(
                <div className="sp-section">
                    {[
                    {k:"minimap",      label:"Minimap",           desc:"Show overview ruler"},
                    {k:"wordWrap",     label:"Word Wrap",          desc:"Wrap long lines"},
                    {k:"lineNumbers",  label:"Line Numbers",       desc:"Show line numbers"},
                    {k:"bracketPairs", label:"Bracket Colorization",desc:"Color matching brackets"},
                    {k:"smoothScroll", label:"Smooth Scrolling",   desc:"Animated scrolling"},
                    {k:"autoSave",     label:"Auto Save",          desc:"Save on focus change"},
                    {k:"formatOnSave", label:"Format on Save",     desc:"Run formatter on save"},
                    {k:"cursorBlink",  label:"Cursor Blink",       desc:"Animate cursor"},
                    {k:"safeExecute",  label:"Safe Execute Mode",  desc:"Show risk profile before run"},
                    {k:"safeExecute",  label:"Safe Execute Mode",  desc:"Show risk profile before run"},
                    {k:"isolateRun",   label:"Workspace Isolation",desc:"Clone workspace before command run"},
                    {k:"runParallel", label:"Run in parallel",    desc:"Allow multiple run commands in separate sessions"},
                    ].map(item=>(
                    <div key={item.k} className="sp-toggle-row">
                      <div>
                        <div className="sp-toggle-label">{item.label}</div>
                        <div className="sp-toggle-desc">{item.desc}</div>
                      </div>
                      <button className={`sp-toggle${item.k==="autoSave" ? true : local[item.k]?" on":""}`}
                        onClick={()=> item.k==="autoSave" ? set("autoSave", true) : set(item.k,!local[item.k])}>
                        <span className="sp-toggle-thumb"/>
                      </button>
                    </div>
                  ))}

                  <div className="sp-sec-title" style={{marginTop:20}}>TAB SIZE</div>
                  <div className="sp-radio-row">
                    {[2,4,8].map(n=>(
                      <button key={n} className={`sp-radio${local.tabSize===n?" on":""}`}
                        onClick={()=>set("tabSize",n)}>{n}</button>
                    ))}
                  </div>

                  <div className="sp-sec-title" style={{marginTop:20}}>CURSOR STYLE</div>
                  <div className="sp-radio-row">
                    {["bar","block","underline"].map(c=>(
                      <button key={c} className={`sp-radio${local.cursorStyle===c?" on":""}`}
                        onClick={()=>set("cursorStyle",c)}>{c}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* INTERPRETERS */}
              {tab==="interpreter"&&(
                <div className="sp-section">
                  <div className="sp-sec-title">ACTIVE INTERPRETER</div>
                  <div className="sp-interps">
                    {INTERPRETERS.map(it=>(
                      <button key={it.id}
                        className={`sp-interp${local.interpreter===it.id?" on":""}`}
                        onClick={()=>set("interpreter",it.id)}>
                        <span className="sp-interp-icon" style={{fontSize:16}}>{it.icon}</span>
                        <div className="sp-interp-info">
                          <span className="sp-interp-name" style={{color:local.interpreter===it.id?it.color:"#e2e2e2"}}>{it.label}</span>
                          <span className="sp-interp-cmd">{it.cmd}</span>
                        </div>
                        {local.interpreter===it.id&&<span className="sp-interp-active">●</span>}
                      </button>
                    ))}
                  </div>
                  <div className="sp-hint">
                    The selected interpreter is used when you hit <kbd>RUN</kbd>. Make sure the executable is in your PATH.
                  </div>
                </div>
              )}

              {tab==="database"&&(
                <div className="sp-section">
                  <div className="sp-sec-title">DATABASE CONNECTION</div>
                  <div className="sp-kb-row">
                    <span className="sp-kb-action">Host</span>
                    <input className="sp-input" value={db.host} onChange={e=>setDb(v=>({...v,host:e.target.value}))}/>
                  </div>
                  <div className="sp-kb-row">
                    <span className="sp-kb-action">Port</span>
                    <input className="sp-input" value={db.port} onChange={e=>setDb(v=>({...v,port:e.target.value}))}/>
                  </div>
                  <div className="sp-kb-row">
                    <span className="sp-kb-action">Timeout (ms)</span>
                    <input className="sp-input" value={db.timeoutMs} onChange={e=>setDb(v=>({...v,timeoutMs:e.target.value}))}/>
                  </div>
                  <div className="sp-footer-mini">
                    <button className="sp-save" onClick={()=>onTestDb?.({
                      host: db.host,
                      port: Number(db.port || 0),
                      timeoutMs: Number(db.timeoutMs || 2500),
                    })}>Test Connection</button>
                  </div>
                  <div className={`sp-db-status ${dbStatus.state}`}>{dbStatus.message || "Idle"}</div>
                </div>
              )}

              {tab==="source"&&(
                <div className="sp-section">
                  <div className="sp-sec-title">SOURCE CONTROL</div>
                  <div className="sp-kb-row"><span className="sp-kb-action">Branch</span><kbd className="sp-kbd">{gitInfo?.branch || "no-git"}</kbd></div>
                  <div className="sp-kb-row"><span className="sp-kb-action">Changed Files</span><kbd className="sp-kbd">{gitInfo?.changed ?? 0}</kbd></div>
                  <div className="sp-kb-row"><span className="sp-kb-action">Ahead</span><kbd className="sp-kbd">{gitInfo?.ahead ?? 0}</kbd></div>
                  <div className="sp-kb-row"><span className="sp-kb-action">Behind</span><kbd className="sp-kbd">{gitInfo?.behind ?? 0}</kbd></div>
                </div>
              )}

              {tab==="debug"&&(
                <div className="sp-section">
                  <div className="sp-sec-title">DEBUG STREAM</div>
                  <div className="sp-debug-log">
                    {(debugLines.length ? debugLines : ["No debug events yet"]).slice(-120).map((line, i)=>(
                      <div key={i} className="sp-debug-row">{line}</div>
                    ))}
                  </div>
                </div>
              )}

              {tab==="account"&&(
                <div className="sp-section">
                  <div className="sp-sec-title">VISRODECK ACCOUNT</div>
                  {account ? (
                    <>
                      <div className="sp-kb-row"><span className="sp-kb-action">Signed in as</span><kbd className="sp-kbd">{account.name} · {account.email}</kbd></div>
                      <div className="sp-footer-mini"><button className="sp-cancel" onClick={onSignOut}>Sign Out</button></div>
                    </>
                  ) : (
                    <>
                      <div className="sp-kb-row"><span className="sp-kb-action">Name</span><input className="sp-input" value={signin.name} onChange={e=>setSignin(v=>({...v,name:e.target.value}))}/></div>
                      <div className="sp-kb-row"><span className="sp-kb-action">Email</span><input className="sp-input" value={signin.email} onChange={e=>setSignin(v=>({...v,email:e.target.value}))}/></div>
                      <div className="sp-footer-mini"><button className="sp-save" onClick={()=>{
                        if(!signin.email || !signin.name) return;
                        onSignIn?.({ name: signin.name.trim(), email: signin.email.trim(), tier: "free" });
                      }}>Sign In</button></div>
                    </>
                  )}
                </div>
              )}

              {/* EXTENSIONS */}
              {tab==="extensions"&&(
                <div className="sp-section">
                  <div className="sp-sec-title">BUILT-IN EXTENSIONS</div>
                  {exts.map(ext=>(
                    <div key={ext.id} className="sp-ext-row">
                      <div className="sp-ext-info">
                        <span className="sp-ext-name">{ext.label}</span>
                        <span className="sp-ext-desc">{ext.desc}</span>
                      </div>
                      <button className={`sp-toggle${ext.enabled?" on":""}`}
                        onClick={()=>toggleExt(ext.id)}>
                        <span className="sp-toggle-thumb"/>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* KEYBINDINGS */}
              {tab==="keybindings"&&(
                <div className="sp-section">
                  <div className="sp-sec-title">KEYBOARD SHORTCUTS</div>
                  {KEYBINDINGS.map(kb=>(
                    <div key={kb.action} className="sp-kb-row">
                      <span className="sp-kb-action">{kb.action}</span>
                      <kbd className="sp-kbd">{kb.key}</kbd>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>

          <div className="sp-footer">
            <button className="sp-cancel" onClick={onClose}>Cancel</button>
            <button className="sp-save" onClick={()=>{ onSave(local); onClose(); }}>Save Changes</button>
          </div>
        </div>
      </div>
    </>
  );
}

const CSS=`
.sp-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(8px);z-index:1000;display:flex;align-items:center;justify-content:center;animation:sp-fade .2s ease;}
@keyframes sp-fade{from{opacity:0}to{opacity:1}}
.sp-panel{width:min(800px,92vw);max-height:88vh;background:linear-gradient(180deg,#0f1622,#0b1118);border:1px solid #263548;border-radius:14px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.85);animation:sp-in .2s ease;}
@keyframes sp-in{from{opacity:0;transform:scale(.97) translateY(-8px)}to{opacity:1;transform:scale(1) translateY(0)}}
.sp-header{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid #1e2d3d;flex-shrink:0;background:rgba(15,22,34,.6);}
.sp-title{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;letter-spacing:.12em;color:#e8f0fc;}
.sp-close{background:transparent;border:none;color:#6e8ab5;font-size:16px;cursor:pointer;padding:6px 10px;border-radius:8px;transition:all .12s;outline:none;}
.sp-close:hover{color:#e8f0fc;background:#1a2840;}
.sp-body{display:flex;flex:1;overflow:hidden;}
.sp-sidebar{width:200px;border-right:1px solid #1a2636;padding:10px 0;flex-shrink:0;background:rgba(10,16,26,.8);}
.sp-stab{display:flex;align-items:center;gap:10px;width:100%;padding:10px 16px;background:transparent;border:none;border-radius:0;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:11px;color:#7a94b8;text-align:left;transition:all .1s;outline:none;}
.sp-stab:hover{color:#c8dcf8;background:#152235;}
.sp-stab.on{color:#f0f6fc;background:#1c2f47;border-right:3px solid #58a6ff;}
.sp-stab-icon{font-size:14px;width:18px;text-align:center;}
.sp-content{flex:1;overflow-y:auto;padding:24px;}
.sp-content::-webkit-scrollbar{width:6px;}
.sp-content::-webkit-scrollbar-thumb{background:#2d3f55;border-radius:3px;}
.sp-section{display:flex;flex-direction:column;gap:0;}
.sp-sec-title{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;letter-spacing:.15em;color:#6b8ab8;margin-bottom:10px;margin-top:18px;text-transform:uppercase;}
.sp-sec-title:first-child{margin-top:0;}
.sp-about-hero{margin-bottom:20px;}
.sp-about-logo{font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:700;letter-spacing:.2em;color:#58a6ff;}
.sp-about-ver{display:block;font-size:11px;color:#8b949e;margin-top:4px;}
.sp-about-block{background:rgba(22,32,50,.6);border:1px solid #263548;border-radius:8px;padding:12px 14px;margin-bottom:4px;}
.sp-about-license,.sp-about-sig{font-size:11px;color:#b1c4dc;}
.sp-about-build{display:flex;flex-direction:column;gap:6px;margin-top:4px;}
.sp-about-build-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1e2d3d;}
.sp-about-build-row span{font-size:11px;color:#8b949e;}
.sp-about-build-row kbd{font-size:11px;background:#161f2e;border:1px solid #2a3f5e;padding:4px 10px;border-radius:4px;color:#e6edf3;}
.sp-deps-desc{font-size:11px;color:#8b949e;margin-bottom:14px;}
.sp-deps-actions{display:flex;flex-wrap:wrap;gap:10px;}
.sp-deps-btn{background:linear-gradient(180deg,#238636,#2ea043);border:1px solid #2ea043;color:#fff;font-family:'JetBrains Mono',monospace;font-size:11px;padding:8px 16px;border-radius:8px;cursor:pointer;outline:none;}
.sp-deps-btn:hover:not(:disabled){filter:brightness(1.1);}
.sp-deps-btn:disabled{opacity:.5;cursor:not-allowed;}
.sp-deps-hint{font-size:10px;color:#6e7681;margin-top:10px;}
.sp-deps-log{font-size:10px;color:#7ad79c;margin-top:12px;padding:8px;background:rgba(35,134,54,.15);border-radius:6px;}
/* Themes */
.sp-themes{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:4px;}
.sp-theme{display:flex;align-items:center;gap:10px;background:#111b2d;border:1px solid #2b3f5d;border-radius:8px;padding:10px;cursor:pointer;transition:all .12s;outline:none;}
.sp-theme:hover{border-color:#5d7ea9;}
.sp-theme.on{border-color:#9ec1e9;}
.sp-theme-swatch{width:32px;height:32px;border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.sp-theme-name{font-family:'JetBrains Mono',monospace;font-size:11px;color:#9ab0d0;flex:1;text-align:left;}
.sp-theme.on .sp-theme-name{color:#eef5ff;}
.sp-theme-check{font-size:11px;color:#3ddc84;}
/* Slider */
.sp-slider-row{display:flex;align-items:center;gap:10px;margin-bottom:4px;}
.sp-slider-val{font-family:'JetBrains Mono',monospace;font-size:11px;color:#e2e2e2;width:36px;flex-shrink:0;}
.sp-slider{flex:1;accent-color:#fff;height:3px;cursor:pointer;}
.sp-slider-lab{font-family:'JetBrains Mono',monospace;font-size:9px;color:#444;width:42px;text-align:right;}
/* Select */
.sp-select{background:#0f1726;border:1px solid #2d4060;color:#e8f0fc;font-family:'JetBrains Mono',monospace;font-size:11px;padding:7px 10px;border-radius:8px;outline:none;width:100%;cursor:pointer;}
/* Toggle */
.sp-toggle-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #1c2b44;}
.sp-toggle-label{font-family:'JetBrains Mono',monospace;font-size:11px;color:#e8f0fc;margin-bottom:2px;}
.sp-toggle-desc{font-family:'JetBrains Mono',monospace;font-size:9px;color:#7e95b8;}
.sp-toggle{width:38px;height:21px;background:#1a2840;border:1px solid #2f4567;border-radius:12px;cursor:pointer;position:relative;transition:all .2s;outline:none;padding:0;}
.sp-toggle.on{background:#b2c8e8;border-color:#a6bfdf;}
.sp-toggle-thumb{position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:#6f87ab;transition:all .2s;}
.sp-toggle.on .sp-toggle-thumb{left:19px;background:#0f1726;}
/* Radio */
.sp-radio-row{display:flex;gap:6px;}
.sp-radio{background:#161618;border:1px solid #2a2a2e;color:#555;font-family:'JetBrains Mono',monospace;font-size:11px;padding:5px 14px;border-radius:3px;cursor:pointer;transition:all .12s;outline:none;}
.sp-radio:hover{border-color:#444;color:#888;}
.sp-radio.on{background:#fff;border-color:#fff;color:#0a0a0b;}
/* Interpreters */
.sp-interps{display:flex;flex-direction:column;gap:6px;margin-bottom:14px;}
.sp-interp{display:flex;align-items:center;gap:12px;background:#161618;border:1px solid #2a2a2e;border-radius:4px;padding:10px 14px;cursor:pointer;transition:all .12s;outline:none;text-align:left;}
.sp-interp:hover{border-color:#444;}
.sp-interp.on{border-color:#ffffff44;background:#1c1c1f;}
.sp-interp-icon{flex-shrink:0;}
.sp-interp-info{flex:1;}
.sp-interp-name{display:block;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;margin-bottom:2px;}
.sp-interp-cmd{display:block;font-family:'JetBrains Mono',monospace;font-size:9px;color:#555;}
.sp-interp-active{color:#3ddc84;font-size:10px;}
.sp-hint{font-family:'JetBrains Mono',monospace;font-size:10px;color:#444;line-height:1.6;padding:10px;background:#0a0a0b;border:1px solid #1a1a1d;border-radius:3px;}
.sp-hint kbd{background:#1c1c1f;border:1px solid #2a2a2e;padding:1px 5px;border-radius:2px;color:#888;}
/* Extensions */
.sp-ext-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #1a1a1d;}
.sp-ext-name{display:block;font-family:'JetBrains Mono',monospace;font-size:11px;color:#e2e2e2;margin-bottom:2px;}
.sp-ext-desc{display:block;font-family:'JetBrains Mono',monospace;font-size:9px;color:#444;}
/* Keybindings */
.sp-kb-row{display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid #1a1a1d;}
.sp-kb-action{font-family:'JetBrains Mono',monospace;font-size:11px;color:#888;}
.sp-kbd{font-family:'JetBrains Mono',monospace;font-size:10px;color:#e2e2e2;background:#1c1c1f;border:1px solid #2a2a2e;padding:3px 8px;border-radius:3px;}
.sp-input{width:220px;background:#0a0a0b;border:1px solid #2a2a2e;color:#e2e2e2;font-family:'JetBrains Mono',monospace;font-size:10px;padding:5px 7px;border-radius:3px;outline:none;}
.sp-input:focus{border-color:#4a5d77;}
.sp-footer-mini{display:flex;justify-content:flex-end;margin-top:12px;}
.sp-db-status{margin-top:8px;font-family:'JetBrains Mono',monospace;font-size:10px;padding:7px;border:1px solid #2a2a2e;border-radius:3px;background:#0a0a0b;color:#888;}
.sp-db-status.ok{color:#7ad79c;border-color:#2f5740;}
.sp-db-status.error{color:#e08a8a;border-color:#593131;}
.sp-db-status.checking{color:#d9c085;border-color:#5a4e2d;}
.sp-debug-log{max-height:280px;overflow:auto;border:1px solid #1a1a1d;border-radius:4px;background:#0a0a0b;}
.sp-debug-row{font-family:'JetBrains Mono',monospace;font-size:10px;color:#8b94a2;padding:6px 8px;border-bottom:1px solid #15181d;word-break:break-word;}
/* Footer */
.sp-footer{display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid #233552;flex-shrink:0;}
.sp-cancel{background:#111b2d;border:1px solid #2b405f;color:#89a2c8;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;padding:7px 16px;border-radius:8px;cursor:pointer;transition:all .12s;outline:none;}
.sp-cancel:hover{color:#e8f0fc;border-color:#5d7ea9;}
.sp-save{background:linear-gradient(180deg,#d4e4fb,#aec8ea);border:1px solid #a5c0e4;color:#0a121d;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;padding:7px 18px;border-radius:8px;cursor:pointer;transition:all .12s;outline:none;}
.sp-save:hover{filter:brightness(1.06);}
`;
