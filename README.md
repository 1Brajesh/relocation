# Relocation research

Static site (no build step) comparing low-cost cities to move to from Miami Beach.
Live: https://1brajesh.github.io/relocation/

- `index.html`, `css/style.css`, `js/app.js` — the app
- `data/cities.json` — list of city tabs (`status: "ready"` or `"coming-soon"`)
- `data/<city>.json` — one file per city (listings, criteria, sections, sources)

**Add a city:** copy `data/bucaramanga.json` to `data/<id>.json`, edit, then add
`{ "id": "<id>", "name": "...", "country": "...", "flag": "...", "status": "ready", "data": "data/<id>.json" }`
to `data/cities.json`.

Preview locally: `python3 -m http.server` then open http://localhost:8000 (fetch() doesn't work from `file://`).

Data researched Oct 10, 2026; USD at an assumed 3,900 COP/USD. Unverified items are labeled on the page.
