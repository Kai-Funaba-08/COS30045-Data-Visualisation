# Website (D3 v7) — Prototype 1

Static HTML/CSS/JS site, no build step.

- `index.html` – landing page: intro, links to the five questions, data notes
- `q1.html` … `q5.html` – one page per research question, with top nav and previous/next links
- `css/style.css` – colours, fonts, layout (light and dark mode), shared by all pages
- `js/q1.js` – Q1 chart (self-contained)
- `js/common.js` – shared helpers for Q2–Q5 (load before `q2.js` … `q5.js`)
- `js/q2.js` … `js/q5.js` – one chart script per question page
- `data/` – copies of Nicole's KNIME exports from `../cleanData`

## Run locally

`d3.csv` cannot read files over `file://`, so use a local server:

```
cd website
python3 -m http.server 8000
```

Then open http://localhost:8000. (VS Code "Live Server" also works.)

## Update the data

Replace the CSVs in `data/` with new exports. Keep the same file and column names.

## Deploy on Vercel

Import the GitHub repo in Vercel, set **Root Directory** to `website`,
Framework Preset "Other", no build command. Every push to the branch redeploys.
