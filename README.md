# ACM Curriculum Planner

A browser app for mapping courses and degree plans onto the ACM/IEEE-CS/AAAI
**CS2023** Body of Knowledge. The knowledge areas come from `json/ka-*.json`
(produced by `extract_ka_json.py`).

## Running

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/ (works from any path, e.g. GitHub Pages)
```

## Features

- **Knowledge Areas**: master list of all 17 KAs, 162 knowledge units and ~1,600 topics.
  - *Topic list*: a compact tree you can expand and collapse. Every topic shows chips for the courses that cover it. You can filter by text, KA, tier (CS Core / KA Core / Non-core), covered or uncovered, and by the courses in one degree plan. *Assign mode* lets you tick topics for a course straight from the master list.
  - *Unit × course matrix*: a heat-map with knowledge units as rows and courses as columns.
- **Courses**: each has a dept, number, name and credits. The detail page has an editable header, coverage per KA, the plans the course belongs to, overlap with other courses, a topic-assignment tree (tick a whole KA, a whole unit, or single topics), and the CS2023 learning outcomes for the units the course touches.
- **Degree plans** are made of requirement groups:
  - *Core*: all students take the required courses.
  - *Elective group*: required courses plus "choose N of these options".
  - *Track*: students pick one track. Each track has its own required courses and options.

  The plan page shows minimum credits and a coverage analysis. Each topic is marked *guaranteed*, *some tracks*, *elective only* or *not covered*, and you can view this for any student or for a student in one track. A gap list shows the CS Core topics the plan doesn't guarantee.
- **Data**: the shared curriculum lives in `data/curriculum.json`, and every visitor starts from it. Edits made in the app are saved in that browser only (the header shows "Unpublished edits"). To publish them, download `curriculum.json` from the Data page, replace `data/curriculum.json` with it, and push to `main`. You can also export a topic × course CSV.

## Data model

Coverage is stored per topic using IDs of the form `<unit>:<tier>:<n>`, for
example `OS-Memory:cs:3` (the 3rd CS Core topic in OS-Memory). These IDs are
built from the JSON when the app runs. If you re-generate or edit the JSON,
existing assignments only stay correct as long as each topic keeps its position
within its unit.

## Deploying to GitHub Pages

`.github/workflows/pages.yml` builds the site and deploys it on every push to
`main` (or manually from the Actions tab). One-time setup: **Settings → Pages →
Build and deployment → Source: GitHub Actions**.

The deployed site is public. It includes `data/curriculum.json`, so anyone
with the URL can see the committed courses and plans.
