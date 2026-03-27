const keybindings = new Map();
const keyHandlers = new Map();

const KEY_ALIASES = {
  ctrl: "Control",
  cmd: "Meta",
  meta: "Meta",
  shift: "Shift",
  alt: "Alt",
  enter: "Enter",
  space: " ",
  esc: "Escape",
  escape: "Escape",
  backslash: "\\",
  backtick: "`",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
};

function normalizeKey(key) {
  const lower = String(key || "").toLowerCase().trim();
  if (KEY_ALIASES[lower]) return KEY_ALIASES[lower];
  // Handle special characters
  if (lower === "backslash" || lower === "\\") return "\\";
  if (lower === "backtick" || lower === "`") return "`";
  return lower;
}

function parseKeybinding(binding) {
  const parts = String(binding || "")
    .split(/[+\-]/)
    .map((s) => normalizeKey(s.trim()))
    .filter(Boolean);
  return {
    ctrl: parts.includes("Control"),
    meta: parts.includes("Meta"),
    shift: parts.includes("Shift"),
    alt: parts.includes("Alt"),
    key: parts.find((p) => !["Control", "Meta", "Shift", "Alt"].includes(p)) || null,
  };
}

function matchesKeybinding(event, binding) {
  const parsed = parseKeybinding(binding);
  if (parsed.ctrl && !event.ctrlKey) return false;
  if (parsed.meta && !event.metaKey) return false;
  if (parsed.shift && !event.shiftKey) return false;
  if (parsed.alt && !event.altKey) return false;
  if (parsed.key && event.key.toLowerCase() !== parsed.key.toLowerCase()) return false;
  if (!parsed.ctrl && !parsed.meta && (event.ctrlKey || event.metaKey)) return false;
  if (!parsed.shift && event.shiftKey) return false;
  if (!parsed.alt && event.altKey) return false;
  return true;
}

export function registerKeybinding(binding, commandId, handler) {
  unregisterKeybinding(commandId);
  const key = String(binding || "").toLowerCase();
  if (!keyHandlers.has(key)) {
    keyHandlers.set(key, []);
  }
  keyHandlers.get(key).push({ commandId, handler, binding });
  keybindings.set(commandId, binding);
}

export function unregisterKeybinding(commandId) {
  const binding = keybindings.get(commandId);
  if (!binding) return;
  const key = String(binding).toLowerCase();
  const handlers = keyHandlers.get(key);
  if (handlers) {
    const idx = handlers.findIndex((h) => h.commandId === commandId);
    if (idx >= 0) handlers.splice(idx, 1);
  }
  keybindings.delete(commandId);
}

export function handleKeyEvent(event) {
  const key = `${event.ctrlKey ? "ctrl+" : ""}${event.metaKey ? "meta+" : ""}${event.shiftKey ? "shift+" : ""}${event.altKey ? "alt+" : ""}${event.key.toLowerCase()}`;
  const handlers = keyHandlers.get(key) || [];
  for (const { handler, binding } of handlers) {
    if (matchesKeybinding(event, binding)) {
      event.preventDefault();
      handler(event);
      return true;
    }
  }
  return false;
}

export function getKeybinding(commandId) {
  return keybindings.get(commandId);
}

export function getAllKeybindings() {
  return Array.from(keybindings.entries());
}
