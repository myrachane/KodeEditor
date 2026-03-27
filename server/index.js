const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs-extra');
const fg = require('fast-glob');
const { Server } = require('socket.io');
const { spawn } = require('child_process');
const simpleGit = require('simple-git');

const PORT = process.env.PORT || 8787;
const CLOUD_FILE = path.resolve(process.cwd(), '.visrodeck-cloud.json');

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const terminalCwd = new Map();

const isSubPath = (root, target) => {
  const normalizedRoot = path.resolve(root);
  const normalizedTarget = path.resolve(target);
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`);
};

const safeStat = async (targetPath) => {
  try {
    return await fs.stat(targetPath);
  } catch {
    return null;
  }
};

const buildTree = async (rootPath, depth = 0, maxDepth = 7) => {
  const name = path.basename(rootPath) || rootPath;
  const stat = await safeStat(rootPath);
  if (!stat) throw new Error(`Path not found: ${rootPath}`);

  if (stat.isFile()) {
    return { name, path: rootPath, type: 'file' };
  }

  if (depth >= maxDepth) {
    return { name, path: rootPath, type: 'folder', children: [] };
  }

  const entries = await fs.readdir(rootPath);
  const children = [];
  for (const entry of entries.sort((a, b) => a.localeCompare(b))) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
    const fullPath = path.join(rootPath, entry);
    const entryStat = await safeStat(fullPath);
    if (!entryStat) continue;
    if (entryStat.isDirectory()) {
      children.push(await buildTree(fullPath, depth + 1, maxDepth));
    } else {
      children.push({ name: entry, path: fullPath, type: 'file' });
    }
  }

  return { name, path: rootPath, type: 'folder', children };
};

const languageFromPath = (filePath) => {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const map = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    html: 'html',
    css: 'css',
    py: 'python',
    go: 'go',
    rs: 'rust',
    sh: 'shell',
  };
  return map[ext] || 'plaintext';
};

app.get('/api/health', (_, res) => {
  res.json({ ok: true });
});

app.post('/api/workspace/open', async (req, res) => {
  try {
    const workspacePath = path.resolve(req.body.workspacePath || '');
    const stat = await safeStat(workspacePath);
    if (!stat || !stat.isDirectory()) {
      return res.status(400).send('Invalid workspace path');
    }
    const root = await buildTree(workspacePath);
    res.json({ root });
  } catch (error) {
    res.status(500).send(String(error));
  }
});

app.get('/api/workspace/tree', async (req, res) => {
  try {
    const workspacePath = path.resolve(String(req.query.workspacePath || ''));
    const root = await buildTree(workspacePath);
    res.json({ root });
  } catch (error) {
    res.status(500).send(String(error));
  }
});

app.get('/api/workspace/file', async (req, res) => {
  try {
    const filePath = path.resolve(String(req.query.filePath || ''));
    const stat = await safeStat(filePath);
    if (!stat || !stat.isFile()) return res.status(404).send('File not found');
    const content = await fs.readFile(filePath, 'utf8');
    res.json({ content, language: languageFromPath(filePath) });
  } catch (error) {
    res.status(500).send(String(error));
  }
});

app.put('/api/workspace/file', async (req, res) => {
  try {
    const filePath = path.resolve(req.body.filePath || '');
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, req.body.content ?? '', 'utf8');
    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(String(error));
  }
});

app.post('/api/workspace/node', async (req, res) => {
  try {
    const parentPath = path.resolve(req.body.parentPath || '');
    const name = String(req.body.name || '').trim();
    const nodeType = req.body.nodeType;
    if (!name) return res.status(400).send('Name is required');
    const targetPath = path.join(parentPath, name);
    if (!isSubPath(parentPath, targetPath)) return res.status(400).send('Invalid path');

    if (nodeType === 'folder') await fs.ensureDir(targetPath);
    if (nodeType === 'file') {
      await fs.ensureDir(path.dirname(targetPath));
      await fs.writeFile(targetPath, '', { flag: 'wx' }).catch(async (error) => {
        if (error.code === 'EEXIST') return;
        throw error;
      });
    }

    res.json({ ok: true, path: targetPath });
  } catch (error) {
    res.status(500).send(String(error));
  }
});

app.patch('/api/workspace/node', async (req, res) => {
  try {
    const oldPath = path.resolve(req.body.oldPath || '');
    const newPath = path.resolve(req.body.newPath || '');
    await fs.ensureDir(path.dirname(newPath));
    await fs.move(oldPath, newPath, { overwrite: false });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(String(error));
  }
});

app.delete('/api/workspace/node', async (req, res) => {
  try {
    const targetPath = path.resolve(String(req.query.targetPath || ''));
    await fs.remove(targetPath);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(String(error));
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const workspacePath = path.resolve(String(req.query.workspacePath || ''));
    const query = String(req.query.query || '').trim();
    if (!query) return res.json({ results: [] });

    const files = await fg(['**/*.{ts,tsx,js,jsx,json,md,css,html,py,go,rs,java,c,cpp}'], {
      cwd: workspacePath,
      dot: false,
      ignore: ['node_modules/**', '.git/**', 'dist/**'],
      absolute: true,
    });

    const results = [];
    for (const filePath of files.slice(0, 300)) {
      const content = await fs.readFile(filePath, 'utf8').catch(() => '');
      if (!content) continue;
      const lines = content.split('\n');
      lines.forEach((lineText, index) => {
        if (lineText.toLowerCase().includes(query.toLowerCase())) {
          results.push({ path: filePath, line: index + 1, text: lineText.trim() });
        }
      });
      if (results.length > 400) break;
    }

    res.json({ results: results.slice(0, 400) });
  } catch (error) {
    res.status(500).send(String(error));
  }
});

app.get('/api/git/status', async (req, res) => {
  try {
    const workspacePath = path.resolve(String(req.query.workspacePath || ''));
    const git = simpleGit({ baseDir: workspacePath });
    const branchSummary = await git.branch();
    const status = await git.status();
    const changed = [
      ...status.not_added,
      ...status.created,
      ...status.deleted,
      ...status.modified,
      ...status.renamed.map((item) => item.to),
    ].map((entry) => path.join(workspacePath, entry));

    res.json({ branch: branchSummary.current || 'detached', changed });
  } catch {
    res.json({ branch: 'no-git', changed: [] });
  }
});

app.post('/api/cloud/sync', async (req, res) => {
  try {
    const payload = req.body || {};
    const existing = (await fs.readJson(CLOUD_FILE).catch(() => ({ entries: [] }))) || { entries: [] };
    const entries = [
      {
        id: Date.now(),
        at: new Date().toISOString(),
        payload,
      },
      ...(existing.entries || []).slice(0, 19),
    ];
    await fs.writeJson(CLOUD_FILE, { entries }, { spaces: 2 });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(String(error));
  }
});

io.on('connection', (socket) => {
  terminalCwd.set(socket.id, process.cwd());

  socket.on('file:join', (filePath) => {
    socket.join(`file:${filePath}`);
  });

  socket.on('file:change', ({ filePath, content }) => {
    socket.to(`file:${filePath}`).emit('file:remote-change', { filePath, content });
  });

  socket.on('terminal:run', (command) => {
    const cwd = terminalCwd.get(socket.id) || process.cwd();
    const child = spawn(command, {
      cwd,
      shell: true,
      env: process.env,
    });

    child.stdout.on('data', (chunk) => {
      socket.emit('terminal:out', chunk.toString());
    });

    child.stderr.on('data', (chunk) => {
      socket.emit('terminal:out', chunk.toString());
    });

    child.on('close', (code) => {
      socket.emit('terminal:out', `\nProcess exited with code ${code}\n`);
    });
  });

  socket.on('disconnect', () => {
    terminalCwd.delete(socket.id);
  });
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(process.cwd(), 'dist')));
  app.get('*', (_, res) => {
    res.sendFile(path.resolve(process.cwd(), 'dist/index.html'));
  });
}

server.listen(PORT, () => {
  console.log(`Visrodeck Web IDE server running on http://localhost:${PORT}`);
});
