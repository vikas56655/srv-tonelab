# SRV ToneLab — The Science Behind the Blues

An **unofficial** open-source research and music-technology platform inspired by Stevie Ray Vaughan. Built with Next.js, FastAPI, Python, and Web Audio.

## Current MVP (v0.1)

- **Audio Laboratory**: Analyze a short PCM WAV, or an original generated demo. Visualizes amplitude envelope, FFT frequency spectrum, RMS, spectral centroid, rolloff and approximate monophonic pitch.
- **Tone Explorer**: Browser-based, synthetic guitar-like pluck with interactive drive, brightness and sustain.
- **Discography**: Introductory selection of SRV recordings with outbound MusicBrainz lookups.
- **Blues Influence Map**: Illustrative artist connections, not yet backed by historical citations.
- **API and CI**: FastAPI endpoints, basic tests and GitHub Actions workflow.

**Research status:** The advanced machine-learning models, source-backed music history, audio embeddings, and recommendations are roadmap items, *not* shipped in v0.1.

## Run locally

Requirements: Node.js 22+, Python 3.12+.

Start the API:

```bash
cd services/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

Start the frontend in a second terminal:

```bash
cd apps/web
npm install
npm run dev
```

Open http://localhost:3000 and try **Launch audio demo**. API health: http://localhost:8000/health.

The browser talks to Next.js same-origin `/api/*` routes; the Next.js server proxies requests to `API_ORIGIN` (defaults to `http://localhost:8000`). This avoids requiring browser CORS configuration.

## Render deployment

The [render.yaml](render.yaml) Blueprint declares two **free-plan** web services in Frankfurt:
- `srv-tonelab-api`: Python FastAPI backend
- `srv-tonelab-web`: Next.js frontend; `API_ORIGIN` points to the backend

Deploy from GitHub using Render Blueprints. Free services may sleep when idle and may have cold starts. Confirm any billing requirements in your account before applying.

## Test

```bash
cd services/api
pip install -r requirements-dev.txt
pytest -q

cd ../../apps/web
npm install
npm run typecheck
npm run build
```

## Data and rights

No copyrighted Stevie Ray Vaughan recordings, official artwork or music files are bundled. The audio demo is mathematically generated and is **not an SRV recording or tone model**. Users should upload only material they have rights to analyze. Upload files are processed in memory; uploads are not intentionally saved. The public MVP does not yet provide robust per-user abuse rate limiting, so limit access/use until production protections are added.

This project is not affiliated with or endorsed by Stevie Ray Vaughan's estate.

Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md).
