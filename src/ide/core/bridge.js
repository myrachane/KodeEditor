export const isDesktopBridge = !!window.studio?.dialog?.openFolder;

export const studioBridge = window.studio || {
  dialog: {
    openFolder: async () => {
      if (window.showDirectoryPicker) {
        try {
          const handle = await window.showDirectoryPicker();
          return `/${handle.name}`;
        } catch {
          return null;
        }
      }
      window.alert("Browser mode: folder picker is limited. Use Desktop mode for full filesystem.");
      return null;
    },
  },
  workspace: { set: async () => ({ ok: true, tree: [] }) },
  fs: {
    tree: async () => ({ tree: [] }),
    read: async () => ({ content: "" }),
    write: async () => ({ ok: true }),
    mkdir: async () => ({ ok: true }),
    rename: async () => ({ ok: true }),
    delete: async () => ({ ok: true }),
    onTreeUpdate: () => () => {},
  },
  pty: {
    create: async () => ({ ok: true, sessionId: "browser-default", backend: "noop" }),
    dispose: async () => ({ ok: true }),
    onData: () => () => {},
    onExit: () => () => {},
    onRunContext: () => () => {},
    write: () => {},
    resize: () => {},
    run: () => {},
    stop: () => {},
    cd: () => {},
  },
  system: {
    resolveInterpreter: async (pref) => ({ ok: true, command: pref === "python" ? "python3" : "node" }),
    testDb: async () => ({ ok: false, error: "DB testing unavailable in browser mode" }),
    dependencyStatus: async () => ({ ok: true, alerts: [] }),
    stats: async () => ({ ok: true, rssMB: 0, heapUsedMB: 0, cpuUser: 0, cpuSystem: 0 }),
  },
  search: {
    query: async () => ({ ok: true, results: [] }),
  },
  git: {
    status: async () => ({ ok: false, error: "git unavailable in browser mode" }),
    changedFiles: async () => ({ ok: false, error: "git unavailable in browser mode", files: [] }),
    diff: async () => ({ ok: false, error: "git unavailable in browser mode", diff: "" }),
    stage: async () => ({ ok: false, error: "git unavailable in browser mode" }),
    unstage: async () => ({ ok: false, error: "git unavailable in browser mode" }),
    commit: async () => ({ ok: false, error: "git unavailable in browser mode" }),
  },
  settings: {
    load: async () => ({ ok: true, settings: {} }),
    save: async () => ({ ok: true }),
    merged: async () => ({ ok: true, settings: {} }),
  },
};
