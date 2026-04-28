const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { nanoid } = require('nanoid');
const QRCode = require('qrcode');
const db = require('./src/db');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '52428800'); // 50MB
const DEFAULT_TTL = process.env.DEFAULT_TTL || '24h';

const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: MAX_FILE_SIZE } });

app.use(express.json());
app.use(express.static('public'));

// Parse TTL string to ms
function parseTTL(ttl) {
  const units = { h: 3600000, d: 86400000 };
  const match = ttl.match(/^(\d+)([hd])$/);
  return match ? parseInt(match[1]) * units[match[2]] : 86400000;
}

// Upload
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  const code = nanoid(10);
  const ttl = req.body.ttl || DEFAULT_TTL;
  const expiresAt = new Date(Date.now() + parseTTL(ttl)).toISOString();
  const maxDownloads = req.body.maxDownloads ? parseInt(req.body.maxDownloads) : null;
  const password = req.body.password || null;

  db.prepare(`
    INSERT INTO files (code, original_name, mime_type, size, path, expires_at, max_downloads, password)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(code, req.file.originalname, req.file.mimetype, req.file.size, req.file.filename, expiresAt, maxDownloads, password);

  res.json({ code, url: `${BASE_URL}/d/${code}`, expiresAt });
});

// File info
app.get('/api/files/:code', (req, res) => {
  const file = db.prepare('SELECT code, original_name, mime_type, size, created_at, expires_at, download_count, max_downloads, password FROM files WHERE code = ?').get(req.params.code);
  if (!file) return res.status(404).json({ error: 'File not found' });
  if (new Date(file.expires_at) < new Date()) return res.status(410).json({ error: 'File expired' });
  res.json({ ...file, hasPassword: !!file.password, password: undefined });
});

// QR code
app.get('/api/qr/:code', async (req, res) => {
  const file = db.prepare('SELECT code FROM files WHERE code = ?').get(req.params.code);
  if (!file) return res.status(404).json({ error: 'File not found' });
  const url = `${BASE_URL}/d/${file.code}`;
  res.type('png').send(await QRCode.toBuffer(url, { width: 256, margin: 2 }));
});

// File preview (images and text)
app.get('/api/preview/:code', (req, res) => {
  const file = db.prepare('SELECT * FROM files WHERE code = ?').get(req.params.code);
  if (!file) return res.status(404).json({ error: 'File not found' });
  if (new Date(file.expires_at) < new Date()) return res.status(410).json({ error: 'File expired' });
  if (file.password && req.query.password !== file.password) return res.status(403).json({ error: 'Password required' });

  const filePath = path.join(uploadsDir, file.path);
  if (file.mime_type.startsWith('image/')) {
    return res.type(file.mime_type).sendFile(filePath);
  }
  if (file.mime_type.startsWith('text/') || ['application/json', 'application/xml', 'application/javascript'].includes(file.mime_type)) {
    const content = fs.readFileSync(filePath, 'utf-8').slice(0, 50000);
    return res.json({ type: 'text', content });
  }
  res.json({ type: 'none' });
});

// Download page
app.get('/d/:code', (req, res) => {
  const file = db.prepare('SELECT * FROM files WHERE code = ?').get(req.params.code);
  if (!file) return res.status(404).sendFile(path.join(__dirname, 'public', 'download.html'));
  if (req.query.download !== '1') return res.sendFile(path.join(__dirname, 'public', 'download.html'));

  if (new Date(file.expires_at) < new Date()) return res.status(410).json({ error: 'File expired' });
  if (file.max_downloads && file.download_count >= file.max_downloads) return res.status(410).json({ error: 'Download limit reached' });
  if (file.password && req.query.password !== file.password) return res.status(403).json({ error: 'Invalid password' });

  db.prepare('UPDATE files SET download_count = download_count + 1 WHERE code = ?').run(req.params.code);
  res.download(path.join(uploadsDir, file.path), file.original_name);
});

// Cleanup expired files and download-limited files
function cleanup() {
  const expired = db.prepare("SELECT path FROM files WHERE expires_at < datetime('now') OR (max_downloads IS NOT NULL AND download_count >= max_downloads)").all();
  for (const f of expired) {
    const filePath = path.join(uploadsDir, f.path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  db.prepare("DELETE FROM files WHERE expires_at < datetime('now') OR (max_downloads IS NOT NULL AND download_count >= max_downloads)").run();
  console.log(`[cleanup] Removed ${expired.length} expired/exhausted files`);
}
setInterval(cleanup, 60000);
cleanup(); // Run on startup

// Multer error handling
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File too large. Max size: ${MAX_FILE_SIZE / 1048576}MB` });
  }
  next(err);
});

app.listen(PORT, () => console.log(`Server running on ${BASE_URL}`));
