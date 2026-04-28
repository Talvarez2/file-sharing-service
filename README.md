# file-sharing-service

File sharing service with auto-expiring links, password protection, QR codes, and file previews.

## Features

- **Drag-and-drop upload** with progress bar
- **Auto-expiring links** — configurable TTL (1h, 24h, 7d, 30d)
- **Password protection** — optional password on upload
- **Download limits** — optional max download count
- **QR code generation** — scannable share links
- **File preview** — inline preview for images and text files
- **Automatic cleanup** — expired files removed from disk and database
- **50MB default file size limit** — configurable via environment variable

## Quick Start

### Docker (recommended)

```bash
docker compose up -d
```

Open http://localhost:3000

### Local

```bash
npm install
npm start
```

## API

### Upload a file

```
POST /api/upload
Content-Type: multipart/form-data

Fields:
  file         — the file (required)
  ttl          — expiry: 1h, 24h, 7d, 30d (default: 24h)
  maxDownloads — download limit (optional)
  password     — access password (optional)

Response: { code, url, expiresAt }
```

### Get file info

```
GET /api/files/:code

Response: { code, original_name, mime_type, size, created_at, expires_at, download_count, max_downloads, hasPassword }
```

### Download a file

```
GET /d/:code?download=1&password=<pw>
```

### QR code

```
GET /api/qr/:code → PNG image
```

### File preview

```
GET /api/preview/:code → image or { type: "text", content }
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `BASE_URL` | `http://localhost:3000` | Base URL for share links |
| `MAX_FILE_SIZE` | `52428800` | Max upload size in bytes (50MB) |
| `DEFAULT_TTL` | `24h` | Default link expiry |

## Architecture

```
├── server.js          # Express app — routes, upload, download, cleanup
├── src/db.js          # SQLite database setup and schema
├── public/            # Frontend static files
│   ├── index.html     # Upload page
│   ├── download.html  # Download page
│   ├── css/style.css  # Styles
│   └── js/
│       ├── upload.js  # Drag-drop upload with XHR progress
│       └── download.js # File info, preview, download
├── uploads/           # Uploaded files (gitignored, Docker volume)
├── data/              # SQLite database (gitignored, Docker volume)
├── Dockerfile
└── docker-compose.yml
```

Files are stored on disk in `uploads/` with metadata in SQLite. A cleanup job runs every 60 seconds to remove expired files and files that have reached their download limit.
