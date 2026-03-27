// src/pages/labs/FileExplorer.jsx
import { useState } from "react";

const EXT_COLOR = {
  js:"#f5c542",jsx:"#61dafb",ts:"#1a6cc4",tsx:"#61dafb",
  json:"#cbcb41",md:"#e2e2e2",css:"#5b9cf6",html:"#e44d26",
  sh:"#3ddc84",py:"#3776ab",txt:"#888",svg:"#ffb13b",env:"#eee",
};
function extColor(n){ return EXT_COLOR[n.split(".").pop()?.toLowerCase()]||"#555"; }
function extIcon(name=""){
  const ext = name.split(".").pop()?.toLowerCase();
  return {
    js:"JS", jsx:"JSX", ts:"TS", tsx:"TSX", py:"PY", json:"{}", md:"MD",
    html:"<>", css:"CSS", sh:"SH", txt:"TXT", yml:"YML", yaml:"YML",
    png:"IMG", jpg:"IMG", jpeg:"IMG", svg:"SVG", ico:"ICO", lock:"LCK",
  }[ext] || "FILE";
}

function FileIcon({ name, isDir, open }){
  if(isDir) return <span style={{fontSize:9,color:"#555",marginRight:4,flexShrink:0,width:10,display:"inline-block"}}>{open?"▾":"▸"}</span>;
  return <span style={{color:extColor(name),fontSize:9,marginRight:6,flexShrink:0,minWidth:22,fontFamily:"'JetBrains Mono',monospace"}}>{extIcon(name)}</span>;
}

function TreeNode({ node, depth=0, activeFile, onSelect, onCtx, onExpandDir }){
  const [open, setOpen] = useState(false);
  if(node.type==="directory") return (
    <div>
      <div className="fe-row" style={{paddingLeft:depth*14+8}}
        onClick={()=>{
          const next = !open;
          setOpen(next);
          if(next && node.children === null) onExpandDir?.(node.path);
        }}
        onDragOver={(e)=>{ e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e)=>{ e.preventDefault(); e.stopPropagation(); onExpandDir?.(node.path); onCtx?.(null, { __dropTarget: node.path, __dropFiles: e.dataTransfer?.files }); }}
        onContextMenu={e=>{e.stopPropagation();onCtx(e,node);}}>
        <FileIcon name={node.name} isDir open={open}/>
        <span className="fe-dname">{node.name}</span>
      </div>
      {open && Array.isArray(node.children) && node.children.map(c=>(
        <TreeNode key={c.path} node={c} depth={depth+1}
          activeFile={activeFile} onSelect={onSelect} onCtx={onCtx} onExpandDir={onExpandDir}/>
      ))}
    </div>
  );
  const active = activeFile?.path===node.path;
  return (
    <div className={`fe-row fe-file${active?" active":""}`}
      style={{paddingLeft:depth*14+8}}
      onClick={()=>onSelect(node)}
      onContextMenu={e=>{e.stopPropagation();onCtx(e,node);}}>
      <FileIcon name={node.name}/>
      <span className="fe-fname">{node.name}</span>
    </div>
  );
}

export default function FileExplorer({
  tree,
  activeFile,
  onSelect,
  onContextMenu,
  workspace,
  onRootContextMenu,
  onExpandDir,
  onNewFile,
  onNewFolder,
  onRefresh,
  onImportDrop,
}){
  const [query, setQuery] = useState("");
  const proj = workspace ? workspace.split(/[\\/]/).pop() : "—";
  const q = query.trim().toLowerCase();

  const filterTree = (nodes) => {
    if (!q) return nodes;
    const out = [];
    for (const n of nodes) {
      if (n.type === "directory") {
        const children = Array.isArray(n.children) ? filterTree(n.children) : n.children;
        const matches = n.name.toLowerCase().includes(q);
        if (matches || (Array.isArray(children) && children.length > 0)) {
          out.push({ ...n, children });
        }
      } else if (n.name.toLowerCase().includes(q)) {
        out.push(n);
      }
    }
    return out;
  };
  const shownTree = filterTree(tree);

  return (
    <>
      <style>{CSS}</style>
      <aside
        className="fe-root"
        onContextMenu={onRootContextMenu}
        onDragOver={(e)=>{ e.preventDefault(); }}
        onDrop={(e)=>{
          e.preventDefault();
          onImportDrop?.(e.dataTransfer?.files, workspace);
        }}
      >
        <div className="fe-head">
          <span className="fe-label">EXPLORER</span>
          <div className="fe-proj-row">
            <span className="fe-proj" title={workspace}>{proj}</span>
            <div className="fe-actions">
              <button className="fe-act" onClick={e => { e.stopPropagation(); onNewFile?.(); }} title="New File">+</button>
              <button className="fe-act" onClick={e => { e.stopPropagation(); onNewFolder?.(); }} title="New Folder">⊕</button>
              <button className="fe-act" onClick={e => { e.stopPropagation(); onRefresh?.(); }} title="Refresh">⟳</button>
            </div>
          </div>
          <input
            className="fe-search"
            placeholder="Search files..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className="fe-body">
          {shownTree.length===0
            ? <div className="fe-empty"><span>No files</span><small>Right-click to create</small></div>
            : shownTree.map(n=>(
              <TreeNode key={n.path} node={n}
                activeFile={activeFile}
                onSelect={onSelect}
                onCtx={(e, node) => {
                  if (node?.__dropTarget) {
                    onImportDrop?.(node.__dropFiles, node.__dropTarget);
                    return;
                  }
                  onContextMenu?.(e, node);
                }}
                onExpandDir={onExpandDir}
              />
            ))
          }
        </div>
      </aside>
    </>
  );
}

const CSS=`
.fe-root{width:248px;flex-shrink:0;background:linear-gradient(180deg,#111827,#0f1521);border-right:1px solid #000000;display:flex;flex-direction:column;overflow:hidden;backdrop-filter:blur(8px);}
.fe-head{padding:12px 12px 10px;border-bottom:1px solid #000206;flex-shrink:0;background:rgba(8,12,18,.35);}
.fe-label{display:block;font-family:'JetBrains Mono',monospace;font-size:8px;font-weight:700;letter-spacing:.18em;color:#5d7394;text-transform:uppercase;margin-bottom:6px;}
.fe-proj-row{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.fe-proj{display:block;font-family:'JetBrains Mono',monospace;font-size:11px;color:#cfdbef;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.fe-actions{display:flex;gap:5px;flex-shrink:0;}
.fe-act{width:20px;height:20px;border:1px solid #2b394f;background:#111a28;color:#8ea5c8;border-radius:5px;font-family:'JetBrains Mono',monospace;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
.fe-act:hover{color:#e9f1ff;border-color:#4a6285;background:#162236;}
.fe-search{width:100%;margin-top:10px;background:#0b111b;border:1px solid #000000;color:#d4e1f4;font-family:'JetBrains Mono',monospace;font-size:10px;padding:7px 9px;border-radius:6px;outline:none;}
.fe-search:focus{border-color:#4f6f9a;box-shadow:0 0 0 2px rgba(90,129,182,.2);}
.fe-search::placeholder{color:#5f7392;}
.fe-body{flex:1;overflow-y:auto;padding:6px 0;}
.fe-body::-webkit-scrollbar{width:6px;}
.fe-body::-webkit-scrollbar-thumb{background:#24334a;border-radius:8px;}
.fe-empty{padding:24px 14px;text-align:center;}
.fe-empty span{display:block;font-family:'JetBrains Mono',monospace;font-size:11px;color:#8ca4c7;margin-bottom:5px;}
.fe-empty small{font-family:'JetBrains Mono',monospace;font-size:9px;color:#617897;}
.fe-row{display:flex;align-items:center;min-height:24px;padding-right:8px;cursor:pointer;transition:background .12s, color .12s;border-radius:4px;margin:0 6px;}
.fe-row:hover{background:#182436;}
.fe-file.active{background:#1d2d44;box-shadow:inset 0 0 0 1px #000000;}
.fe-dname{font-family:'JetBrains Mono',monospace;font-size:11px;color:#afc1da;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.fe-fname{font-family:'JetBrains Mono',monospace;font-size:11px;color:#e7eefb;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
`;
