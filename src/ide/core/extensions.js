const extensions = new Map();
const activatedExtensions = new Set();
let builtInsRegistered = false;

export function registerExtension(id, manifest, activate) {
  if (extensions.has(id)) {
    console.warn(`[extensions] Extension ${id} already registered`);
    return;
  }
  extensions.set(id, { id, manifest, activate });
}

export function activateExtension(id) {
  if (activatedExtensions.has(id)) return;
  const ext = extensions.get(id);
  if (!ext) {
    console.warn(`[extensions] Extension ${id} not found`);
    return;
  }
  try {
    ext.activate();
    activatedExtensions.add(id);
    console.log(`[extensions] Activated: ${id}`);
  } catch (e) {
    console.error(`[extensions] Failed to activate ${id}:`, e);
  }
}

export function getExtension(id) {
  return extensions.get(id);
}

export function getAllExtensions() {
  return Array.from(extensions.values());
}

export function isActivated(id) {
  return activatedExtensions.has(id);
}

// Built-in extensions
export function registerBuiltInExtensions() {
  if (builtInsRegistered) return;
  builtInsRegistered = true;
  // Prettier formatter extension
  registerExtension("prettier", {
    name: "Prettier",
    version: "1.0.0",
    contributes: {
      formatters: ["javascript", "typescript", "json", "css"],
    },
  }, () => {
    console.log("[extensions] Prettier formatter activated");
  });

  // Git Blame extension
  registerExtension("git-blame", {
    name: "Git Blame",
    version: "1.0.0",
    contributes: {
      commands: ["git.blame.show"],
    },
  }, () => {
    console.log("[extensions] Git Blame activated");
  });

  // Auto-save extension
  registerExtension("autosave", {
    name: "Auto Save",
    version: "1.0.0",
    contributes: {
      settings: ["files.autoSave"],
    },
  }, () => {
    console.log("[extensions] Auto Save activated");
  });
}
