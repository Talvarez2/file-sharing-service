# AGENTS.md

## Project Overview

File sharing service — Node.js/Express backend with SQLite storage and static frontend.

## Architecture

- **server.js** — Single Express server handling all routes, file upload (multer), download, QR generation, preview, and cleanup cron
- **src/db.js** — SQLite database initialization with better-sqlite3
- **public/** — Static frontend (vanilla HTML/CSS/JS, no build step)

## Key Patterns

- Files stored on disk in `uploads/`, metadata in SQLite `data/files.db`
- Share codes generated with nanoid (10 chars)
- Download route serves HTML page for browsers, file for `?download=1`
- Cleanup runs every 60s, removes expired and download-exhausted files
- All config via environment variables (PORT, BASE_URL, MAX_FILE_SIZE, DEFAULT_TTL)

## Dependencies

- express, multer, better-sqlite3, nanoid (v3, CommonJS), qrcode

## Development

```bash
npm install
npm start        # http://localhost:3000
```

## Docker

```bash
docker compose up -d
```
