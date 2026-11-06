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

## How it works

- **The CS2023 body of knowledge ships with the app.** All 17 knowledge areas, 162 knowledge units and about 1,300 topics are loaded from `json/ka-*.json` in this repo, and they are the same for everyone.
- **Your program is a file on your own device.** A *program* is one institution's program, e.g. "Evangel University – Computer Science", with its courses and degree plans. It lives in a `.curriculum.json` file. Nothing is uploaded, and nothing is stored in this repo. To share a program, send the file; anyone can open it in the app.
  - **Chrome / Edge on a computer:** the app writes every edit straight back to the file. After a browser restart it asks once for permission to keep saving.
  - **Safari, Firefox, phones:** the app can open the file but not write to it. Edits are kept in the browser, and the header shows *Unsaved edits* with a **Download** button to save the updated file.
  - In both cases a working copy is kept in the browser, so reloading the page doesn't lose edits.

## Features

- **Knowledge Areas**: the master list of every topic, showing which courses cover it.
  - *Topic list*: a compact tree you can expand and collapse. Filter by text, KA, tier (CS Core / KA Core / Non-core), covered or uncovered, and by the courses in one plan. *Assign mode* lets you tick topics for a course straight from this list.
  - *Unit × course matrix*: a heat-map with knowledge units as rows and courses as columns.
- **Courses** have a dept, number, name and credits. The detail page has coverage per KA, the plans the course is in, overlap with other courses, the topic-assignment tree, and the CS2023 learning outcomes for the units the course touches.
- **Degree plans** each have *required courses* plus *elective groups* ("choose N of these"). Model tracks or concentrations as separate plans; *Duplicate* makes a copy to start from. For each plan you get:
  - minimum credits
  - coverage per KA. A topic is **guaranteed** when every student covers it: it's in a required course, or every allowed combination of electives includes it. It is **elective only** when it depends on what the student picks.
  - **What-if** mode: tick specific electives to see the coverage of that exact combination.
  - a gap list of the topics not guaranteed by the plan
- **Compare**: plans side by side for each KA and unit, plus a topic-by-topic list of where they differ.
- **Export**: a topic × course coverage spreadsheet (CSV).

## File format

```jsonc
{
  "format": "acm-curriculum-planner",
  "version": 2,
  "institution": "Sample University",
  "name": "Computer Science",
  "courses": [
    { "id": "…", "dept": "CPSC", "number": "415", "name": "Operating Systems",
      "credits": 3, "description": "", "coverage": ["OS-Memory:cs:3", "…"] }
  ],
  "plans": [
    { "id": "…", "name": "B.S. Computer Science – Cybersecurity", "description": "",
      "required": ["<course id>", "…"],
      "electives": [{ "id": "…", "name": "CS electives", "choose": 1, "options": ["<course id>", "…"] }] }
  ]
}
```

Coverage is stored per topic using IDs of the form `<unit>:<tier>:<n>`, e.g.
`OS-Memory:cs:3` (the 3rd CS Core topic in OS-Memory). These IDs are built from
the JSON in this repo, so if that JSON is regenerated, existing files stay correct
only as long as each topic keeps its position within its unit. Version 1 files
(with "track" groups) are upgraded when opened: each track becomes its own plan.

## Deploying to GitHub Pages

`.github/workflows/pages.yml` builds and deploys the site on every push to
`main`. One-time setup: **Settings → Pages → Build and deployment → Source:
GitHub Actions**. The site contains only the app and the CS2023 data; programs
stay on each user's device.
