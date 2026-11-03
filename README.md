# Website (D3 v7) — Prototype 1

Static HTML/CSS/JS site, no build step.

- `index.html` – story layout, one section per research question (Q1–Q5)
- `css/style.css` – colours, fonts, layout (light and dark mode)
- `js/q1.js` – Q1 chart: annual line 2011–2021, monthly line 2019–2021, table view
- `data/` – copies of Nicole's KNIME exports from `../cleanData`

Status: Q1 works. Q2–Q5 are placeholders with the draft findings text.

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
