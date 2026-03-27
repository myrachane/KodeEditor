// electron/preload.js — Phase 4
const { contextBridge, ipcRenderer } = require("electron");

const versions = typeof process !== "undefined" && process.versions
  ? { electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node }
  : {};
contextBridge.exposeInMainWorld("studio", {
  versions: versions,
  win: {
    minimize:    () => ipcRenderer.send("win:minimize"),
    maximize:    () => ipcRenderer.send("win:maximize"),
    close:       () => ipcRenderer.send("win:close"),
    isMaximized: () => ipcRenderer.invoke("win:isMaximized"),
  },
  dialog: {
    openFolder: () => ipcRenderer.invoke("dialog:openFolder"),
  },
  workspace: {
    set: (dir) => ipcRenderer.invoke("workspace:set", dir),
  },
  fs: {
    tree:   (dir)          => ipcRenderer.invoke("fs:tree", dir),
    read:   (fp)           => ipcRenderer.invoke("fs:read", fp),
    write:  (fp, content)  => ipcRenderer.invoke("fs:write", { fp, content }),
    writeBinary: (fp, base64) => ipcRenderer.invoke("fs:writeBinary", { fp, base64 }),
    importPaths: (targetDir, paths) => ipcRenderer.invoke("fs:importPaths", { targetDir, paths }),
    mkdir:  (dir)          => ipcRenderer.invoke("fs:mkdir", dir),
    rename: (from, name)   => ipcRenderer.invoke("fs:rename", { from, name }),
    delete: (fp)           => ipcRenderer.invoke("fs:delete", fp),
    onTreeUpdate: (cb) => {
      const h = (_, tree) => cb(tree);
      ipcRenderer.on("fs:treeUpdate", h);
      return () => ipcRenderer.removeListener("fs:treeUpdate", h);
    },
  },
  pty: {
    create: (cwd) => ipcRenderer.invoke("pty:create", { cwd }),
    dispose: (sessionId) => ipcRenderer.invoke("pty:dispose", { sessionId }),
    write: (sessionId, data) => ipcRenderer.send("pty:input", { sessionId, data }),
    resize: (sessionId, cols, rows) => ipcRenderer.send("pty:resize", { sessionId, cols, rows }),
    run: (sessionId, cmd, options = {}) => ipcRenderer.send("pty:run", { sessionId, cmd, options }),
    stop: (sessionId) => ipcRenderer.send("pty:stop", { sessionId }),
    cd: (sessionId, dir) => ipcRenderer.send("pty:cd", { sessionId, dir }),
    onData: (cb) => {
      const h = (_, payload) => cb(payload);
      ipcRenderer.on("pty:data", h);
      return () => ipcRenderer.removeListener("pty:data", h);
    },
    onExit: (cb) => {
      const h = (_, payload) => cb(payload);
      ipcRenderer.on("pty:exit", h);
      return () => ipcRenderer.removeListener("pty:exit", h);
    },
    onRunContext: (cb) => {
      const h = (_, payload) => cb(payload);
      ipcRenderer.on("run:context", h);
      return () => ipcRenderer.removeListener("run:context", h);
    },
  },
  jane: {
    ask: (system, userMsg, history) =>
      ipcRenderer.invoke("jane:ask", { system, userMsg, history }),
  },
  system: {
    resolveInterpreter: (pref) => ipcRenderer.invoke("system:resolveInterpreter", pref),
    testDb: (config) => ipcRenderer.invoke("system:testDb", config),
    dependencyStatus: () => ipcRenderer.invoke("dep:status"),
    stats: () => ipcRenderer.invoke("system:stats"),
  },
  search: {
    query: (q, opts = {}) => ipcRenderer.invoke("search:query", { q, ...opts }),
  },
  run: {
    prepare: (filePath, content) => ipcRenderer.invoke("run:prepare", { filePath, content }),
    cleanup: (fp) => ipcRenderer.invoke("run:cleanup", fp),
  },
  shell: { open: (p) => ipcRenderer.send("shell:open", p) },
  git: {
    status: () => ipcRenderer.invoke("git:status"),
    changedFiles: () => ipcRenderer.invoke("git:changedFiles"),
    diff: (filePath) => ipcRenderer.invoke("git:diff", { path: filePath }),
    stage: (filePath) => ipcRenderer.invoke("git:stage", { path: filePath }),
    unstage: (filePath) => ipcRenderer.invoke("git:unstage", { path: filePath }),
    commit: (message) => ipcRenderer.invoke("git:commit", { message }),
  },
  settings: {
    load: (scope) => ipcRenderer.invoke("settings:load", { scope }),
    save: (settings, scope) => ipcRenderer.invoke("settings:save", { settings, scope }),
    merged: () => ipcRenderer.invoke("settings:merged"),
  },
});
