import { useEffect, useState, useCallback } from "react";
import Editor from "@monaco-editor/react";

const s = typeof window !== "undefined" ? window.studio : null;

export default function ScmPanel({ workspace, onOpenFile }) {
  const [changedFiles, setChangedFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [diff, setDiff] = useState("");
  const [commitMsg, setCommitMsg] = useState("");
  const [branch, setBranch] = useState("no-git");

  const refresh = useCallback(async () => {
    if (!workspace || !s?.git?.changedFiles) return;
    setBusy(true);
    try {
      const res = await s.git.changedFiles();
      if (res?.ok) {
        setChangedFiles(res.files || []);
      }
      const statusRes = await s.git.status();
      if (statusRes?.ok) {
        setBranch(statusRes.branch || "no-git");
      }
    } catch (e) {
      console.error("[scm] refresh failed:", e);
    } finally {
      setBusy(false);
    }
  }, [workspace]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [refresh]);

  const loadDiff = useCallback(async (filePath) => {
    if (!filePath || !s?.git?.diff) return;
    setBusy(true);
    try {
      const res = await s.git.diff(filePath);
      if (res?.ok) {
        setDiff(res.diff || "");
        setSelectedFile(filePath);
      } else {
        setDiff("");
        setSelectedFile(null);
      }
    } catch (e) {
      console.error("[scm] diff failed:", e);
      setDiff("");
    } finally {
      setBusy(false);
    }
  }, []);

  const handleStage = async (filePath) => {
    if (!s?.git?.stage) return;
    setBusy(true);
    try {
      await s.git.stage(filePath);
      await refresh();
      if (selectedFile === filePath) await loadDiff(filePath);
    } catch (e) {
      console.error("[scm] stage failed:", e);
    } finally {
      setBusy(false);
    }
  };

  const handleUnstage = async (filePath) => {
    if (!s?.git?.unstage) return;
    setBusy(true);
    try {
      await s.git.unstage(filePath);
      await refresh();
      if (selectedFile === filePath) await loadDiff(filePath);
    } catch (e) {
      console.error("[scm] unstage failed:", e);
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async () => {
    if (!commitMsg.trim() || !s?.git?.commit) return;
    setBusy(true);
    try {
      const res = await s.git.commit(commitMsg.trim());
      if (res?.ok) {
        setCommitMsg("");
        await refresh();
        setDiff("");
        setSelectedFile(null);
      }
    } catch (e) {
      console.error("[scm] commit failed:", e);
    } finally {
      setBusy(false);
    }
  };

  const staged = changedFiles.filter((f) => f.staged && !f.unstaged);
  const unstaged = changedFiles.filter((f) => !f.staged || f.unstaged);

  return (
    <>
      <style>{CSS}</style>
      <aside className="scm-root">
        <div className="scm-head">
          <span className="scm-label">SOURCE CONTROL</span>
          <div className="scm-branch">{branch}</div>
          <button className="scm-refresh" onClick={refresh} disabled={busy} title="Refresh">
            ⟳
          </button>
        </div>

        <div className="scm-body">
          {staged.length > 0 && (
            <div className="scm-section">
              <div className="scm-section-title">STAGED CHANGES ({staged.length})</div>
              {staged.map((f) => (
                <div key={f.path} className="scm-file">
                  <span className="scm-file-name" onClick={() => loadDiff(f.path)} title={f.path}>
                    {f.path.split(/[\\/]/).pop()}
                  </span>
                  <div className="scm-file-actions">
                    <button className="scm-btn" onClick={() => handleUnstage(f.path)} disabled={busy}>
                      U
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {unstaged.length > 0 && (
            <div className="scm-section">
              <div className="scm-section-title">CHANGES ({unstaged.length})</div>
              {unstaged.map((f) => (
                <div key={f.path} className="scm-file">
                  <span className="scm-file-name" onClick={() => loadDiff(f.path)} title={f.path}>
                    {f.path.split(/[\\/]/).pop()}
                  </span>
                  <div className="scm-file-actions">
                    <button className="scm-btn" onClick={() => handleStage(f.path)} disabled={busy}>
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {changedFiles.length === 0 && (
            <div className="scm-empty">
              <span>No changes</span>
              <small>Working tree clean</small>
            </div>
          )}
        </div>

        {selectedFile && diff && (
          <div className="scm-diff">
            <div className="scm-diff-header">
              <span>{selectedFile.split(/[\\/]/).pop()}</span>
              <button className="scm-close" onClick={() => { setDiff(""); setSelectedFile(null); }}>×</button>
            </div>
            <div className="scm-diff-editor">
              <Editor
                value={diff}
                language="diff"
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  fontSize: 11,
                  fontFamily: '"JetBrains Mono", monospace',
                }}
              />
            </div>
          </div>
        )}

        {changedFiles.length > 0 && (
          <div className="scm-commit">
            <input
              className="scm-commit-input"
              placeholder="Commit message..."
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && handleCommit()}
              disabled={busy}
            />
            <button className="scm-commit-btn" onClick={handleCommit} disabled={busy || !commitMsg.trim()}>
              Commit
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

const CSS = `
.scm-root{width:248px;flex-shrink:0;background:linear-gradient(180deg,#111827,#0f1521);border-right:1px solid #2b394f;display:flex;flex-direction:column;overflow:hidden;backdrop-filter:blur(8px);}
.scm-head{padding:12px 12px 10px;border-bottom:1px solid #1f2b3d;flex-shrink:0;background:rgba(8,12,18,.35);display:flex;align-items:center;gap:8px;}
.scm-label{display:block;font-family:'JetBrains Mono',monospace;font-size:8px;font-weight:700;letter-spacing:.18em;color:#5d7394;text-transform:uppercase;}
.scm-branch{flex:1;font-family:'JetBrains Mono',monospace;font-size:10px;color:#9bb2d1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.scm-refresh{width:20px;height:20px;border:1px solid #2b394f;background:#111a28;color:#8ea5c8;border-radius:5px;font-family:'JetBrains Mono',monospace;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.scm-refresh:hover{color:#e9f1ff;border-color:#4a6285;background:#162236;}
.scm-refresh:disabled{opacity:.5;cursor:not-allowed;}
.scm-body{flex:1;overflow-y:auto;padding:8px 0;}
.scm-body::-webkit-scrollbar{width:6px;}
.scm-body::-webkit-scrollbar-thumb{background:#24334a;border-radius:8px;}
.scm-section{padding:0 6px 12px;}
.scm-section-title{font-family:'JetBrains Mono',monospace;font-size:8px;font-weight:700;letter-spacing:.12em;color:#6f87aa;text-transform:uppercase;margin-bottom:6px;padding:0 6px;}
.scm-file{display:flex;align-items:center;justify-content:space-between;padding:4px 6px;margin:2px 0;border-radius:4px;transition:background .1s;}
.scm-file:hover{background:#182436;}
.scm-file-name{font-family:'JetBrains Mono',monospace;font-size:10px;color:#dbe5f1;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;}
.scm-file-name:hover{color:#f0f6ff;}
.scm-file-actions{display:flex;gap:4px;flex-shrink:0;}
.scm-btn{width:20px;height:20px;border:1px solid #2b394f;background:#111a28;color:#8ea5c8;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
.scm-btn:hover{color:#e9f1ff;border-color:#4a6285;background:#162236;}
.scm-btn:disabled{opacity:.5;cursor:not-allowed;}
.scm-empty{padding:24px 14px;text-align:center;}
.scm-empty span{display:block;font-family:'JetBrains Mono',monospace;font-size:11px;color:#8ca4c7;margin-bottom:5px;}
.scm-empty small{font-family:'JetBrains Mono',monospace;font-size:9px;color:#617897;}
.scm-diff{flex-shrink:0;border-top:1px solid #1f2b3d;max-height:300px;display:flex;flex-direction:column;overflow:hidden;}
.scm-diff-header{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#0b111b;border-bottom:1px solid #29384d;}
.scm-diff-header span{font-family:'JetBrains Mono',monospace;font-size:10px;color:#d4e1f4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;}
.scm-close{width:18px;height:18px;border:none;background:transparent;color:#8ea5c8;font-size:14px;cursor:pointer;border-radius:3px;display:flex;align-items:center;justify-content:center;}
.scm-close:hover{background:#162236;color:#e9f1ff;}
.scm-diff-editor{flex:1;min-height:0;}
.scm-commit{flex-shrink:0;border-top:1px solid #1f2b3d;padding:10px;background:rgba(8,12,18,.35);display:flex;gap:6px;}
.scm-commit-input{flex:1;background:#0b111b;border:1px solid #29384d;color:#d4e1f4;font-family:'JetBrains Mono',monospace;font-size:10px;padding:6px 8px;border-radius:6px;outline:none;}
.scm-commit-input:focus{border-color:#4f6f9a;box-shadow:0 0 0 2px rgba(90,129,182,.2);}
.scm-commit-input:disabled{opacity:.5;cursor:not-allowed;}
.scm-commit-btn{height:28px;padding:0 12px;border:1px solid #2b394f;background:#111a28;color:#8ea5c8;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:10px;cursor:pointer;flex-shrink:0;white-space:nowrap;}
.scm-commit-btn:hover{color:#e9f1ff;border-color:#4a6285;background:#162236;}
.scm-commit-btn:disabled{opacity:.5;cursor:not-allowed;}
`;
