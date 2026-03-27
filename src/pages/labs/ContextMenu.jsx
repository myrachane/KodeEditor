// src/pages/labs/ContextMenu.jsx
import { useEffect, useRef } from "react";

const DIR_ITEMS = [
  { id:"new_file",      icon:"+",   label:"New File" },
  { id:"new_folder",    icon:"⊕",   label:"New Folder" },
  null,
  { id:"open_terminal", icon:">_",  label:"Open in Terminal" },
  { id:"rename",        icon:"✎",   label:"Rename" },
  { id:"copy_path",     icon:"⎘",   label:"Copy Path" },
  null,
  { id:"delete",        icon:"✕",   label:"Delete", danger:true },
];
const FILE_ITEMS = [
  { id:"open_terminal", icon:">_",  label:"Open in Terminal" },
  { id:"rename",        icon:"✎",   label:"Rename" },
  { id:"copy_path",     icon:"⎘",   label:"Copy Path" },
  null,
  { id:"new_file",      icon:"+",   label:"New File Here" },
  { id:"new_folder",    icon:"⊕",   label:"New Folder Here" },
  null,
  { id:"delete",        icon:"✕",   label:"Delete", danger:true },
];

export default function ContextMenu({ x, y, node, onAction, onClose }){
  const ref = useRef(null);
  const items = node?.type==="directory" ? DIR_ITEMS : FILE_ITEMS;

  useEffect(()=>{
    if(!ref.current) return;
    const r=ref.current.getBoundingClientRect();
    if(r.right>window.innerWidth)  ref.current.style.left=(window.innerWidth-r.width-4)+"px";
    if(r.bottom>window.innerHeight) ref.current.style.top=(window.innerHeight-r.height-4)+"px";
  },[x,y]);

  return (
    <>
      <style>{CSS}</style>
      <div ref={ref} className="ctx-root" style={{left:x,top:y}}
        onClick={e=>e.stopPropagation()} onContextMenu={e=>e.preventDefault()}>
        {node && (
          <div className="ctx-title">
            <span className="ctx-title-icon">{node.type==="directory"?"⊞":"◈"}</span>
            <span className="ctx-title-name">{node.name}</span>
          </div>
        )}
        {items.map((item,i)=>
          item===null
            ? <div key={"d"+i} className="ctx-div"/>
            : <button key={item.id} className={`ctx-item${item.danger?" danger":""}`}
                onClick={()=>onAction(item.id)}>
                <span className="ctx-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
        )}
      </div>
    </>
  );
}

const CSS=`
.ctx-root{position:fixed;z-index:9999;min-width:185px;background:#1c1c1f;border:1px solid #2a2a2e;border-radius:5px;box-shadow:0 8px 32px rgba(0,0,0,.8);padding:4px;animation:ctx-in .09s ease;}
@keyframes ctx-in{from{opacity:0;transform:scale(.96) translateY(-3px)}to{opacity:1;transform:scale(1) translateY(0)}}
.ctx-title{display:flex;align-items:center;gap:7px;padding:6px 10px 5px;border-bottom:1px solid #2a2a2e;margin-bottom:3px;}
.ctx-title-icon{font-size:10px;color:#555;}
.ctx-title-name{font-family:'JetBrains Mono',monospace;font-size:10px;color:#666;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px;}
.ctx-item{display:flex;align-items:center;gap:9px;width:100%;padding:6px 10px;background:transparent;border:none;border-radius:3px;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:11px;color:#d4d4d4;text-align:left;transition:background .08s;outline:none;}
.ctx-item:hover{background:#2a2a2e;color:#fff;}
.ctx-item.danger{color:#e05c5c;}
.ctx-item.danger:hover{background:rgba(224,92,92,.1);}
.ctx-icon{font-size:10px;color:#444;width:14px;text-align:center;flex-shrink:0;}
.ctx-item:hover .ctx-icon{color:#888;}
.ctx-div{height:1px;background:#222226;margin:3px 0;}
`;
