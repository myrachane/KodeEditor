import { useEffect, useMemo, useRef, useState } from "react";

const s = typeof window !== "undefined" ? window.studio : null;

export default function SearchPanel({ workspace, onOpenResult }) {
  const [q, setQ] = useState("");
  const [replaceQ, setReplaceQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus?.(), 0);
  }, []);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of results || []) {
      const key = r.path;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    return Array.from(map.entries()).map(([path, items]) => ({ path, items }));
  }, [results]);

  const runSearch = async () => {
    if (!workspace) return;
    const needle = q.trim();
    if (!needle) {
      setResults([]);
      setError("");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await s?.search?.query?.(needle, { maxResults: 220 });
      if (!res?.ok) setError(res?.error || "Search failed");
      setResults(res?.results || []);
    } catch (e) {
      setError(e?.message || "Search failed");
      setResults([]);
    } finally {
      setBusy(false);
    }
  };

  const replaceAll = async () => {
    if (!workspace) return;
    const needle = q.trim();
    if (!needle) return;
    const repl = replaceQ ?? "";
    const paths = Array.from(new Set((results || []).map((r) => r.path)));
    if (paths.length === 0) return;
    if (!window.confirm(`Replace all in ${paths.length} file(s)?`)) return;
    setBusy(true);
    setError("");
    try {
      for (const p of paths) {
        const r = await s?.fs?.read?.(p);
        const content = r?.content ?? "";
        if (!content.includes(needle)) continue;
        const next = content.split(needle).join(repl);
        await s?.fs?.write?.(p, next);
      }
      await runSearch();
    } catch (e) {
      setError(e?.message || "Replace failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <aside className="spx-root">
        <div className="spx-head">
          <span className="spx-label">SEARCH</span>
          <input
            ref={inputRef}
            className="spx-input"
            placeholder="Search in workspace..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
          />
          <div className="spx-row">
            <input
              className="spx-input"
              placeholder="Replace..."
              value={replaceQ}
              onChange={(e) => setReplaceQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && replaceAll()}
            />
            <button className="spx-btn" onClick={runSearch} disabled={busy}>
              {busy ? "..." : "Find"}
            </button>
            <button className="spx-btn pri" onClick={replaceAll} disabled={busy || !q.trim()}>
              Replace
            </button>
          </div>
          {error && <div className="spx-err">{error}</div>}
          <div className="spx-meta">
            <span>{results.length} matches</span>
          </div>
        </div>

        <div className="spx-body">
          {grouped.length === 0 ? (
            <div className="spx-empty">
              <span>{q.trim() ? "No results" : "Type to search"}</span>
              <small>Shortcut: Ctrl+Shift+F</small>
            </div>
          ) : (
            grouped.map((g) => (
              <div key={g.path} className="spx-group">
                <div className="spx-file" title={g.path}>
                  {g.path.split(/[\\/]/).slice(-2).join("/")}
                  <small>{g.items.length}</small>
                </div>
                {g.items.slice(0, 60).map((r, idx) => (
                  <button
                    key={`${r.path}:${r.line}:${r.column}:${idx}`}
                    className="spx-hit"
                    onClick={() => onOpenResult?.(r.path, r.line, r.column)}
                  >
                    <span className="spx-lc">
                      {r.line}:{r.column}
                    </span>
                    <span className="spx-prev">{r.preview}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}

const CSS = `
.spx-root{width:248px;flex-shrink:0;background:linear-gradient(180deg,#111827,#0f1521);border-right:1px solid #2b394f;display:flex;flex-direction:column;overflow:hidden;backdrop-filter:blur(8px);}
.spx-head{padding:12px 12px 10px;border-bottom:1px solid #1f2b3d;flex-shrink:0;background:rgba(8,12,18,.35);}
.spx-label{display:block;font-family:'JetBrains Mono',monospace;font-size:8px;font-weight:700;letter-spacing:.18em;color:#5d7394;text-transform:uppercase;margin-bottom:6px;}
.spx-input{width:100%;margin-top:8px;background:#0b111b;border:1px solid #29384d;color:#d4e1f4;font-family:'JetBrains Mono',monospace;font-size:10px;padding:7px 9px;border-radius:6px;outline:none;}
.spx-input:focus{border-color:#4f6f9a;box-shadow:0 0 0 2px rgba(90,129,182,.2);}
.spx-row{display:flex;gap:6px;align-items:center;margin-top:8px;}
.spx-btn{height:28px;padding:0 10px;border:1px solid #2b394f;background:#111a28;color:#8ea5c8;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:10px;cursor:pointer;flex-shrink:0;}
.spx-btn:hover{color:#e9f1ff;border-color:#4a6285;background:#162236;}
.spx-btn.pri{background:#b3c6df;color:#0b1119;border-color:#a1b7d6;font-weight:800;}
.spx-btn:disabled{opacity:.5;cursor:not-allowed;}
.spx-err{margin-top:8px;border:1px solid #57343c;background:#1a1013;color:#f3b1bb;border-radius:6px;padding:7px 9px;font-family:'JetBrains Mono',monospace;font-size:9px;}
.spx-meta{margin-top:8px;font-family:'JetBrains Mono',monospace;font-size:9px;color:#6f87aa;}
.spx-body{flex:1;overflow:auto;padding:8px 0;}
.spx-body::-webkit-scrollbar{width:6px;}
.spx-body::-webkit-scrollbar-thumb{background:#24334a;border-radius:8px;}
.spx-empty{padding:24px 14px;text-align:center;}
.spx-empty span{display:block;font-family:'JetBrains Mono',monospace;font-size:11px;color:#8ca4c7;margin-bottom:5px;}
.spx-empty small{font-family:'JetBrains Mono',monospace;font-size:9px;color:#617897;}
.spx-group{padding:0 6px 10px;}
.spx-file{display:flex;justify-content:space-between;align-items:center;margin:10px 6px 6px;font-family:'JetBrains Mono',monospace;font-size:10px;color:#9bb2d1;}
.spx-file small{font-size:9px;color:#6e86aa;border:1px solid #2b3a52;background:#0c1320;border-radius:999px;padding:1px 6px;}
.spx-hit{width:calc(100% - 12px);margin:0 6px 6px;display:flex;gap:8px;align-items:baseline;text-align:left;background:#101a29;border:1px solid #22344e;border-radius:6px;padding:7px 8px;color:#dbe5f1;cursor:pointer;}
.spx-hit:hover{border-color:#3c587d;background:#132033;}
.spx-lc{font-family:'JetBrains Mono',monospace;font-size:9px;color:#89a2c8;flex-shrink:0;width:48px;}
.spx-prev{font-family:'JetBrains Mono',monospace;font-size:10px;color:#dbe5f1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}
`;

