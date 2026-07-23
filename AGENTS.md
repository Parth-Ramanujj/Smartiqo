# AGENTS.md — SwitchCraft Static Clone Server
Static clone of [vdplshop.in](https://vdplshop.in) (Next.js SPA). Serves crawled HTML/JS/CSS with API mocking and SPA routing.

## Commands

```powershell
python serve.py            # start on port 8080
python serve.py 9090       # custom port
$env:PORT=3000; python serve.py  # via env var
serve.bat                  # Windows shortcut
```

## Production server features

- **Threaded** request handling (ThreadingMixIn)
- **Request logging** with timestamps
- **Graceful shutdown** on Ctrl+C / SIGTERM
- **Config**: `PORT` and `HOST` env vars, or first CLI arg
- **CORS** headers on all responses

## How it works

| Feature | Implementation |
|---|---|
| **Static files** | `SimpleHTTPRequestHandler` from `_next/`, `assets/`, etc. |
| **SPA routing** | Unknown paths without extension → `index.html` |
| **Next.js images** | `/_next/image?url=...` → serves local file directly |
| **API mocking** | `/api/*` → returns `{}` by default, or JSON from `api/` or `pages/` dirs |
| **Missing assets** | Placeholder `robots.txt` and `manifest.json` included |

## Failed crawl items (recognized, not impactful)

7 URLs failed during crawl — all are either HTML attribute parser errors or non-critical files:
- `Designed by YantraMayaa Designs` / `width=device-width, initial-scale=1` — extracted from HTML meta/alt attributes, not real URLs
- `logoVerni.png` — exists at `assets/Image/logoVerni.png`; root-level copy omitted
- `robots.txt` / `manifest.json` — placeholders created

## Key files

| File | Role |
|---|---|
| `serve.py` | Production HTTP server (stdlib only, no deps) |
| `config.json` | Default port/host config |
| `serve.bat` | Windows launcher |
| `index.html` | Next.js SPA entry + inlined MUI CSS |
| `pages/` | Crawled page HTML + JSON metadata |
| `_next/static/` | Next.js JS chunks, CSS, media |
| `reports/` | Crawl coverage, inventory, missing assets |

## Data source

This clone was built by the Dashboard Data Extraction Framework (`D:\vdplshop\`). See that project's `main.py clone` command.
