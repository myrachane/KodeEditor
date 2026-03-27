// src/pages/labs/MapPanel.jsx  — Interactive force-directed node graph
import { useEffect, useRef, useMemo, useState } from "react";

const EXT_COLOR={js:"#f5c542",jsx:"#ffffff",ts:"#3178c6",tsx:"#61dafb",json:"#cbcb41",md:"#fff",css:"#5b9cf6",html:"#e44d26",sh:"#3ddc84",py:"#3776ab",default:"#666666"};
const getExt=n=>n?.split(".").pop()?.toLowerCase()||"";
const getCol=n=>EXT_COLOR[getExt(n)]||EXT_COLOR.default;
const MAX_GRAPH_FILES = 60;
const MAX_DRAW_EDGES = 220;
const GRAPH_STEPS = 10;

function withAlpha(color, alpha) {
  const c = String(color || "").trim();
  const a = String(alpha || "ff").replace(/[^0-9a-f]/gi, "").slice(0, 2).padEnd(2, "f");
  if (/^#[0-9a-f]{3}$/i.test(c)) {
    const r = c[1], g = c[2], b = c[3];
    return `#${r}${r}${g}${g}${b}${b}${a}`;
  }
  if (/^#[0-9a-f]{6}$/i.test(c)) return `${c}${a}`;
  if (/^#[0-9a-f]{8}$/i.test(c)) return `#${c.slice(1, 7)}${a}`;
  return `#666666${a}`;
}

function flatFiles(nodes,res=[]){
  for(const n of nodes){
    if(n.type==="file" && !n.meta?.truncated) res.push(n);
    if(n.children) flatFiles(n.children,res);
  }
  return res;
}
function countAll(nodes,r={f:0,d:0}){
  for(const n of nodes){ n.type==="file"?r.f++:r.d++; if(n.children)countAll(n.children,r); }
  return r;
}

function buildGraph(tree,W,H){
  const allFiles=flatFiles(tree);
  if(!allFiles.length) return{nodes:[],edges:[],meta:{sampled:false,totalFiles:0}};
  const sampled = allFiles.length > MAX_GRAPH_FILES;
  const files = sampled
    ? allFiles.filter((_, idx) => idx % Math.ceil(allFiles.length / MAX_GRAPH_FILES) === 0).slice(0, MAX_GRAPH_FILES)
    : allFiles;
  const byDir={};
  for(const f of files){ const d=f.path.split(/[\\/]/).slice(0,-1).join("/"); (byDir[d]||(byDir[d]=[])).push(f); }
  const nodes=[];
  const dirs=Object.keys(byDir);
  const cx=W/2,cy=H/2;
  dirs.forEach((dir,di)=>{
    const angle=di*(2*Math.PI/dirs.length);
    const r=Math.min(W,H)*0.28;
    const cx2=cx+r*Math.cos(angle), cy2=cy+r*Math.sin(angle);
    const fs=byDir[dir];
    fs.forEach((f,fi)=>{
      const a2=(2*Math.PI/fs.length)*fi;
      const r2=fs.length>1?30:0;
      nodes.push({id:f.path,name:f.name,path:f.path,
        x:cx2+r2*Math.cos(a2)+(Math.random()-.5)*16,
        y:cy2+r2*Math.sin(a2)+(Math.random()-.5)*16,
        vx:0,vy:0,color:getCol(f.name),dir,ext:getExt(f.name),r:5});
    });
  });
  const edges=[];
  const nm={};for(const n of nodes)nm[n.id]=n;
  for(const dir of dirs){
    const fs=byDir[dir];
    if(fs.length>1){ const hub=fs[0]; for(let i=1;i<fs.length;i++) edges.push({from:hub.path,to:fs[i].path,s:.8}); }
  }
  const byExt={};
  for(const n of nodes){ (byExt[n.ext]||(byExt[n.ext]=[])).push(n); }
  for(const ext of Object.keys(byExt)){
    const g=byExt[ext];
    if(g.length>1&&g.length<10) for(let i=0;i<g.length-1;i++) edges.push({from:g[i].id,to:g[i+1].id,s:.25});
  }
  return{nodes,edges,meta:{sampled,totalFiles:allFiles.length}};
}

function forceLayout(nodes,edges,W,H,steps=100){
  const nm={};for(const n of nodes)nm[n.id]=n;
  for(let s=0;s<steps;s++){
    const k=.9-s/steps*.65;
    for(let i=0;i<nodes.length;i++) for(let j=i+1;j<nodes.length;j++){
      const a=nodes[i],b=nodes[j];
      let dx=a.x-b.x,dy=a.y-b.y;
      const d=Math.sqrt(dx*dx+dy*dy)||1;
      const f=1000/(d*d);
      const fx=f*dx/d,fy=f*dy/d;
      a.vx+=fx;a.vy+=fy;b.vx-=fx;b.vy-=fy;
    }
    for(const e of edges){
      const a=nm[e.from],b=nm[e.to];if(!a||!b)continue;
      const dx=b.x-a.x,dy=b.y-a.y,d=Math.sqrt(dx*dx+dy*dy)||1;
      const f=(d-85)*.04*e.s;
      a.vx+=f*dx/d;a.vy+=f*dy/d;b.vx-=f*dx/d;b.vy-=f*dy/d;
    }
    for(const n of nodes){
      n.vx+=(W/2-n.x)*.012;n.vy+=(H/2-n.y)*.012;
      n.x+=n.vx*k;n.y+=n.vy*k;
      n.vx*=.5;n.vy*=.5;
      n.x=Math.max(18,Math.min(W-18,n.x));
      n.y=Math.max(18,Math.min(H-18,n.y));
    }
  }
  return nodes;
}

export default function MapPanel({ workspace, activeFile, tree, executionGraph = { nodes: [], edges: [] } }){
  const canvasRef=useRef(null);
  const wrapRef=useRef(null);
  const [hover,setHover]=useState(null);
  const [graph,setGraph]=useState({nodes:[],edges:[],meta:{sampled:false,totalFiles:0}});
  const [view,setView]=useState("graph");
  const [renderError,setRenderError]=useState(null);
  const sizeRef=useRef({w:280,h:300});
  const hoverRef=useRef(null);
  const rafRef=useRef(null);

  useEffect(()=>{
    const el=wrapRef.current;if(!el)return;
    const w=el.clientWidth||280,h=el.clientHeight||300;
    if (w < 40 || h < 40) return;
    sizeRef.current={w,h};
    setRenderError(null);
    if(!tree.length){setGraph({nodes:[],edges:[],meta:{sampled:false,totalFiles:0}});return;}
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      try {
        const built = buildGraph(tree,w,h);
        const steps = Math.min(GRAPH_STEPS, Math.max(6, 14 - Math.floor((built.nodes.length || 0) / 15)));
        const laid = forceLayout([...built.nodes], built.edges, w, h, steps);
        if (!cancelled) setGraph({ nodes: laid, edges: built.edges, meta: built.meta });
      } catch (error) {
        if (!cancelled) {
          setRenderError(error?.message || "Map render failed");
          setGraph({nodes:[],edges:[],meta:{sampled:false,totalFiles:0}});
        }
      }
    });
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  },[tree]);

  // Canvas draw
  useEffect(()=>{
    if(view!=="graph") return;
    const canvas=canvasRef.current;if(!canvas)return;
    const{w,h}=sizeRef.current;
    canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext("2d");
    ctx.fillStyle="#0f1013";ctx.fillRect(0,0,w,h);
    const{nodes,edges}=graph;
    if(renderError){
      ctx.fillStyle="#121722";ctx.fillRect(0,0,w,h);
      ctx.fillStyle="#d8dee8";ctx.font="600 12px 'JetBrains Mono',monospace";
      ctx.textAlign="center";ctx.fillText("Map temporarily unavailable",w/2,h/2-8);
      ctx.fillStyle="#8f99aa";ctx.font="10px 'JetBrains Mono',monospace";
      ctx.fillText("Switch to TYPES/STATS view or retry",w/2,h/2+12);
      return;
    }
    if(!nodes.length){
      ctx.strokeStyle="rgba(255,255,255,.03)";
      for(let x=0;x<w;x+=22){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
      for(let y=0;y<h;y+=22){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
      ctx.fillStyle="#b4b4b9";
      ctx.font="500 12px 'JetBrains Mono',monospace";
      ctx.textAlign="center";
      ctx.fillText("No map data yet",w/2,h/2-8);
      ctx.fillStyle="#6a6a72";
      ctx.font="10px 'JetBrains Mono',monospace";
      ctx.fillText("Expand folders/files in Explorer to build graph",w/2,h/2+14);
      return;
    }
    const nm={};for(const n of nodes)nm[n.id]=n;
    const drawEdges = edges.length > MAX_DRAW_EDGES ? edges.slice(0, MAX_DRAW_EDGES) : edges;

    // Edges
    for(const e of drawEdges){
      const a=nm[e.from],b=nm[e.to];if(!a||!b)continue;
      const isA=activeFile&&(a.id===activeFile.path||b.id===activeFile.path);
      const isH=hover&&(a.id===hover.id||b.id===hover.id);
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
      if(isA){ctx.strokeStyle="#4ec9c9cc";ctx.lineWidth=1.2;}
      else if(isH){ctx.strokeStyle="#5b9cf699";ctx.lineWidth=.9;}
      else{ctx.strokeStyle="#2a2a3a55";ctx.lineWidth=.55;}
      ctx.stroke();
    }

    // Nodes
    for(const n of nodes){
      const isA=activeFile?.path===n.id;
      const isH=hover?.id===n.id;
      const r=isA?9:isH?7:5;
      if(isA||isH){
        const g=ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,r*4);
        g.addColorStop(0,withAlpha(n.color,"44"));g.addColorStop(1,"transparent");
        ctx.beginPath();ctx.arc(n.x,n.y,r*4,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
      }
      ctx.beginPath();ctx.arc(n.x,n.y,r,0,Math.PI*2);
      if(isA){ctx.fillStyle="#4ec9c9";}
      else if(isH){ctx.fillStyle=n.color;}
      else{ctx.fillStyle=withAlpha(n.color,"bb");}
      ctx.fill();
      ctx.beginPath();ctx.arc(n.x,n.y,r,0,Math.PI*2);
      ctx.strokeStyle=isA?"#4ec9c9":withAlpha(n.color,"77");ctx.lineWidth=isA?1.5:.8;ctx.stroke();
      if(isA||isH||nodes.length<25){
        ctx.font=`${isA||isH?"500 ":""}${isA?11:10}px 'JetBrains Mono',monospace`;
        ctx.textAlign="center";
        ctx.fillStyle=isA?"#fff":isH?"#e2e2e2":"#888";
        ctx.fillText(n.name,n.x,n.y+r+11);
      }
    }
  },[graph,hover,activeFile,renderError]);

  const handleMM=e=>{
    const c=canvasRef.current;if(!c)return;
    const rc=c.getBoundingClientRect();
    const mx=e.clientX-rc.left,my=e.clientY-rc.top;
    let found=null;
    for(const n of graph.nodes){const dx=n.x-mx,dy=n.y-my;if(Math.sqrt(dx*dx+dy*dy)<14){found=n;break;}}
    const prevId = hoverRef.current?.id || null;
    const nextId = found?.id || null;
    if(prevId === nextId) return;
    hoverRef.current = found || null;
    if(rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setHover(found || null);
      c.style.cursor = found ? "pointer" : "default";
    });
  };

  useEffect(()=>{
    const el=wrapRef.current;if(!el)return;
    const ro=new ResizeObserver(()=>{
      const w=el.clientWidth||280,h=el.clientHeight||300;
      sizeRef.current={w,h};
      if(canvasRef.current){canvasRef.current.width=w;canvasRef.current.height=h;}
    });
    ro.observe(el);return()=>{
      ro.disconnect();
      if(rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  },[]);

  const counts=useMemo(()=>countAll(tree),[tree]);
  const files=useMemo(()=>flatFiles(tree),[tree]);
  const byExt=useMemo(()=>{
    const m={};
    for(const f of files){const e=getExt(f.name)||"other";(m[e]||(m[e]=0));m[e]++;}
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,8);
  },[files]);
  const total=byExt.reduce((s,[,c])=>s+c,0)||1;

  return (
    <>
      <style>{MAPCSS}</style>
      <div className="mp-root">
        <div className="mp-header">
          <span className="mp-title">MAP</span>
          <div className="mp-views">
            {["graph","types","stats","exec"].map(v=>(
              <button key={v} className={`mp-vbtn${view===v?" on":""}`} onClick={()=>setView(v)}>
                {v.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="mp-body">
          {/* GRAPH */}
          <div style={{display:view==="graph"?"flex":"none",flexDirection:"column",flex:1,minHeight:0}}>
            <div className="mp-canvas-wrap" ref={view==="graph"?wrapRef:undefined}
              style={{flex:1,position:"relative",overflow:"hidden",minHeight:0}}>
              <canvas ref={canvasRef} onMouseMove={handleMM} onMouseLeave={()=>setHover(null)}
                style={{display:"block",width:"100%",height:"100%"}}/>
              {(graph.meta?.sampled || graph.meta?.totalFiles) && (
                <div className="mp-graph-note">
                  {graph.meta.sampled ? `Sampled: ${graph.nodes.length}/${graph.meta.totalFiles} files` : `${graph.meta.totalFiles} files`}
                  {" · "}Lines = same folder / same type
                </div>
              )}
              {hover&&(
                <div className="mp-tooltip" style={{
                  left:Math.min(hover.x+14,(sizeRef.current.w||280)-130),
                  top:Math.max(hover.y-32,4)}}>
                  <span className="mp-tt-dot" style={{background:hover.color}}/>
                  <div><div className="mp-tt-name">{hover.name}</div>
                  <div className="mp-tt-ext">.{hover.ext}</div></div>
                </div>
              )}
            </div>
            <div className="mp-legend">
              {Object.entries(EXT_COLOR).filter(([k])=>k!=="default").slice(0,6).map(([ext,col])=>(
                <div key={ext} className="mp-leg-item">
                  <span className="mp-leg-dot" style={{background:col}}/><span>.{ext}</span>
                </div>
              ))}
            </div>
          </div>

          {/* TYPES */}
          {view==="types"&&(
            <div className="mp-types">
              <div className="mp-types-count">{files.length} files</div>
              {byExt.map(([ext,cnt])=>{
                const pct=Math.round(cnt/total*100);
                const col=EXT_COLOR[ext]||EXT_COLOR.default;
                return(
                  <div key={ext} className="mp-type-row">
                    <span className="mp-type-dot" style={{background:col}}/>
                    <span className="mp-type-ext">.{ext}</span>
                    <div className="mp-type-track"><div className="mp-type-bar" style={{width:pct+"%",background:col+"55",borderColor:col}}/></div>
                    <span className="mp-type-cnt">{cnt}</span>
                  </div>
                );
              })}
              {byExt.length>0&&(
                <div className="mp-donut-wrap">
                  <svg viewBox="0 0 80 80" style={{width:80,height:80}}>
                    {(()=>{let cum=0;const r=30,circ=2*Math.PI*r;
                      return byExt.map(([ext,cnt])=>{
                        const pct=cnt/total;const col=EXT_COLOR[ext]||EXT_COLOR.default;
                        const off=circ*(1-cum);const dash=circ*pct-1.5;cum+=pct;
                        return<circle key={ext} cx="40" cy="40" r={r} fill="none" stroke={col} strokeWidth="10"
                          strokeDasharray={`${dash} ${circ}`} strokeDashoffset={off}
                          transform="rotate(-90 40 40)" opacity=".8"/>;
                      });
                    })()}
                    <circle cx="40" cy="40" r="22" fill="#111113"/>
                    <text x="40" y="43" textAnchor="middle" fill="#888" fontSize="9" fontFamily="'JetBrains Mono',monospace">{files.length}</text>
                    <text x="40" y="52" textAnchor="middle" fill="#444" fontSize="6" fontFamily="'JetBrains Mono',monospace">FILES</text>
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* STATS */}
          {view==="stats"&&(
            <div className="mp-stats">
              <div className="mp-stat-grid">
                {[{l:"FILES",v:counts.f,c:"#5b9cf6"},{l:"DIRS",v:counts.d,c:"#3ddc84"},
                  {l:"TYPES",v:byExt.length,c:"#e8c06a"},{l:"NODES",v:graph.nodes.length,c:"#b87fd4"}]
                  .map(s=>(
                    <div key={s.l} className="mp-stat-card">
                      <span className="mp-stat-val" style={{color:s.c}}>{s.v}</span>
                      <span className="mp-stat-lbl">{s.l}</span>
                    </div>
                  ))}
              </div>
              {activeFile&&(
                <div className="mp-active-card">
                  <div className="mp-ac-lbl">ACTIVE FILE</div>
                  <div className="mp-ac-name" style={{color:getCol(activeFile.name)}}>{activeFile.name}</div>
                  <div className="mp-ac-path">{activeFile.path}</div>
                  <div className="mp-ac-row">
                    <span className="mp-ac-ext">.{getExt(activeFile.name)}</span>
                    {activeFile.dirty&&<span className="mp-ac-dirty">● UNSAVED</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {view==="exec"&&(
            <div className="mp-stats">
              <div className="mp-sec-title">EXECUTION GRAPH</div>
              {executionGraph?.edges?.length
                ? executionGraph.edges.slice(-28).map((edge, idx) => (
                  <div key={`${edge.from}:${edge.to}:${idx}`} className="mp-exec-row">
                    <span className="mp-exec-node">{edge.from}</span>
                    <span className="mp-exec-arrow">→ {edge.label} →</span>
                    <span className="mp-exec-node">{edge.to}</span>
                  </div>
                ))
                : <div className="mp-types-count">No runtime flow yet. Run a command to capture process edges.</div>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const MAPCSS=`
.mp-root{width:292px;flex-shrink:0;display:flex;flex-direction:column;background:linear-gradient(180deg,#0f1726,#0c1422);border-left:1px solid #2a3b54;overflow:hidden;backdrop-filter:blur(8px);}
.mp-header{display:flex;align-items:center;justify-content:space-between;height:36px;padding:0 12px;background:#101a2a;border-bottom:1px solid #223149;flex-shrink:0;}
.mp-title{font-family:'JetBrains Mono',monospace;font-size:8px;font-weight:700;letter-spacing:.18em;color:#5e769a;}
.mp-views{display:flex;gap:2px;}
.mp-vbtn{font-family:'JetBrains Mono',monospace;font-size:8px;font-weight:600;letter-spacing:.1em;color:#677fa3;background:transparent;border:1px solid transparent;padding:3px 8px;border-radius:6px;cursor:pointer;transition:all .1s;outline:none;}
.mp-vbtn:hover{color:#c6d6ed;background:#152136;}
.mp-vbtn.on{color:#f2f8ff;border-color:#3d567a;background:#1a2941;}
.mp-body{flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0;}
.mp-canvas-wrap{position:relative;}
.mp-graph-note{position:absolute;left:8px;top:8px;font-family:'JetBrains Mono',monospace;font-size:8px;color:#91a8cc;background:#101a2acc;border:1px solid #2b3e5b;padding:4px 7px;border-radius:6px;}
.mp-tooltip{position:absolute;pointer-events:none;display:flex;align-items:center;gap:7px;background:#182338;border:1px solid #2f4464;border-radius:6px;padding:5px 9px;box-shadow:0 8px 24px rgba(0,0,0,.45);z-index:10;}
.mp-tt-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.mp-tt-name{font-family:'JetBrains Mono',monospace;font-size:11px;color:#eef5ff;font-weight:500;}
.mp-tt-ext{font-family:'JetBrains Mono',monospace;font-size:9px;color:#8fa7ca;}
.mp-legend{display:flex;flex-wrap:wrap;gap:6px;padding:8px 10px;border-top:1px solid #223149;flex-shrink:0;background:#0d1522;}
.mp-leg-item{display:flex;align-items:center;gap:4px;font-family:'JetBrains Mono',monospace;font-size:9px;color:#8199bc;}
.mp-leg-dot{width:5px;height:5px;border-radius:50%;}
.mp-types,.mp-stats{padding:10px 10px;overflow-y:auto;flex:1;}
.mp-types::-webkit-scrollbar,.mp-stats::-webkit-scrollbar{width:6px;}
.mp-types::-webkit-scrollbar-thumb,.mp-stats::-webkit-scrollbar-thumb{background:#2f4464;border-radius:8px;}
.mp-types-count{font-family:'JetBrains Mono',monospace;font-size:9px;color:#7d96ba;margin-bottom:10px;}
.mp-type-row{display:flex;align-items:center;gap:7px;margin-bottom:5px;}
.mp-type-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0;}
.mp-type-ext{font-family:'JetBrains Mono',monospace;font-size:9px;color:#a8bcda;width:32px;flex-shrink:0;}
.mp-type-track{flex:1;height:5px;background:#1a273a;border-radius:999px;overflow:hidden;}
.mp-type-bar{height:100%;border-radius:2px;border-top:1px solid;transition:width .3s ease;}
.mp-type-cnt{font-family:'JetBrains Mono',monospace;font-size:9px;color:#8199bc;width:14px;text-align:right;flex-shrink:0;}
.mp-donut-wrap{display:flex;justify-content:center;padding:14px 0 6px;}
.mp-stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px;}
.mp-stat-card{background:#10192a;border:1px solid #293d5b;border-radius:8px;padding:10px;display:flex;flex-direction:column;align-items:center;gap:3px;}
.mp-stat-val{font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:600;line-height:1;}
.mp-stat-lbl{font-family:'JetBrains Mono',monospace;font-size:7px;font-weight:700;letter-spacing:.15em;color:#617b9f;}
.mp-active-card{background:#111b2d;border:1px solid #2e4465;border-radius:8px;padding:10px;}
.mp-ac-lbl{font-family:'JetBrains Mono',monospace;font-size:7px;font-weight:700;letter-spacing:.15em;color:#6d86ab;margin-bottom:5px;}
.mp-ac-name{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;margin-bottom:3px;}
.mp-ac-path{font-family:'JetBrains Mono',monospace;font-size:8px;color:#829ac0;margin-bottom:5px;word-break:break-all;}
.mp-ac-row{display:flex;align-items:center;gap:8px;}
.mp-ac-ext{font-family:'JetBrains Mono',monospace;font-size:9px;color:#9db3d3;background:#172337;border:1px solid #314865;padding:1px 5px;border-radius:8px;}
.mp-ac-dirty{font-family:'JetBrains Mono',monospace;font-size:8px;color:#e8c06a;letter-spacing:.06em;}
.mp-sec-title{font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:.16em;color:#55657f;margin-bottom:8px;}
.mp-exec-row{display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid #23344f;overflow:hidden;}
.mp-exec-node{font-family:'JetBrains Mono',monospace;font-size:9px;color:#9eb2d1;max-width:88px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.mp-exec-arrow{font-family:'JetBrains Mono',monospace;font-size:8px;color:#607395;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
`;
