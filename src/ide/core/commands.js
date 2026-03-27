const commands = new Map();
const commandListeners = new Map();

export function registerCommand(id, handler) {
  if (commands.has(id)) {
    // overwrite silently; hot updates and rerenders can legitimately rebind handlers
  }
  commands.set(id, handler);
  const listeners = commandListeners.get(id) || [];
  listeners.forEach((fn) => fn());
}

export function unregisterCommand(id) {
  commands.delete(id);
}

export function executeCommand(id, ...args) {
  const handler = commands.get(id);
  if (!handler) {
    console.warn(`[commands] Command ${id} not found`);
    return;
  }
  try {
    return handler(...args);
  } catch (e) {
    console.error(`[commands] Error executing ${id}:`, e);
  }
}

export function getCommand(id) {
  return commands.get(id);
}

export function getAllCommands() {
  return Array.from(commands.entries()).map(([id, handler]) => ({ id, handler }));
}

export function onCommandRegistered(id, callback) {
  if (!commandListeners.has(id)) {
    commandListeners.set(id, []);
  }
  commandListeners.get(id).push(callback);
  return () => {
    const listeners = commandListeners.get(id);
    if (listeners) {
      const idx = listeners.indexOf(callback);
      if (idx >= 0) listeners.splice(idx, 1);
    }
  };
}
