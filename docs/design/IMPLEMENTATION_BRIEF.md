# Implementation brief: apply the "Signal" redesign to the real front end

You are implementing an approved visual and information-architecture redesign
of the CareerSignal React front end. The design is finished and signed off by
the owner (Yang Li). Your job is to port it faithfully, keep every existing
feature working, and not change the backend.

## 0. Ground rules

- **History.** This brief records the approved redesign and its implementation
  constraints. The production implementation lives in `frontend/`.
- **Scope.** Front end only: `frontend/src/**`, `frontend/index.html`,
  `frontend/public/**` (fonts/icons), `frontend/e2e/**`, `frontend/package.json`
  if a font package is needed. **No** changes to `backend/`, database,
  Docker/Compose files or API contracts.
- **Keep every feature.** `feature-inventory.md` lists every control, state and
  flow in the current app. Each must still exist after the port (section 3
  says where each goes). If something cannot be placed, ask; do not drop it.
- **Data is real, not mocked.** The mockups use numbers from
  `frontend/src/demo/demoApi.ts`; in the app, render the same fields from the
  API/demo responses. Never hard-code the mockup's numbers or sentences.
  Illustrative items in the design references that are **not** in the data,
  such as expanded advert copy, suggested next-step prose or placeholder
  market shares, must not be copied. Generate such text from data (e.g. top gaps ranked by
  required + weight + market frequency) or leave the slot out.
- **Not part of the product:** rejected palettes, theme switchers and historical
  HTML mockups were design-review tooling and are intentionally not retained.

## 1. Source of truth

| File | Use |
| --- | --- |
| `docs/design/screenshots/final/*.png` | Approved desktop (1440 px) and mobile (390 px) references |
| `docs/design/signal-tokens.css` | Final colours, fonts and shape |
| `docs/design/feature-inventory.md` | Retained product features and their final location |
| `docs/design/design-references.md` | Research and design rationale (Chinese) |
| `frontend/src/App.tsx`, `frontend/src/App.css` | Production structure, copy and responsive implementation |

## 2. Visual system (summary of `signal-tokens.css`)

- **Colour carries meaning.** Ultramarine `#2f2fe6` is the only brand colour
  and also means *employer demand* in data. Green `#0f8a5f` = *proof you hold*.
  Vermilion `#f04a23` = *asked for, no proof*. Neutral warm grey `#77746a` =
  comparison / non-target. Ink `#0e0e0e` for text, rules and dark slabs. Page
  background is fog `#eceef1`. No other colours, no gradients, no glows, no
  drop shadows (only exception: the hard 10px ink offset shadow on the landing
  page preview).
- **Brand colour is used as solid fields**, not just thin bars: right half of
  the Overview report, the landing-page market band, the current-page nav
  underline (4px), the applications count badge.
- **Type.** Bricolage Grotesque 800/700 for headings and big numbers (tight
  tracking), IBM Plex Sans for text, IBM Plex Mono for context lines, table
  headings, panel meta and file locators. Self-host fonts: add
  the three Bricolage woff2 files in `frontend/public/fonts/`. Remove
  `@fontsource/ibm-plex-serif` usage.
- **Structure.** Sections are separated by a 2px ink top rule with no fill and
  no border box. Only these stay boxed (square corners, `#f7f8fa` fill, 1px
  `#cfd3da` border): job header, advert document, margin notes, application
  cards, citations, role/path cards. Selected role/path card = black fill,
  white text.
- **Shape.** Everything square (`border-radius: 0`) except buttons/inputs (3px).
- **Proof level glyph.** Five rising bars (same shape as the logo). Filled bars
  = level 1–5 in green; level 0 shows five pale vermilion bars. Use it
  everywhere a proof level appears.
- **Icons.** Remove the lucide icons that decorate headings, metrics and
  kickers. Keep icons only where they are functional controls (close, menu,
  external link) and give them accessible names.
- **No eyebrow kickers.** No small coloured labels above headings; the mono
  context line above each page `h1` replaces them.

## 3. Information architecture and page mapping

Top bar replaces the left sidebar: logo · Overview · My evidence · Analysis ·
Job decoder · Market · Applications (with active count) · avatar → Settings.
On mobile the nav is one horizontally scrollable row under the logo.

Keep existing URLs working (add redirects if a route is merged) so bookmarks
and tests keep sense. Suggested mapping:

| Nav item / mockup | Route | Built from (current app) | Must contain |
| --- | --- | --- | --- |
| Overview | `/app/workspace` (saved state) | Workspace brief | Target role, evidence signal, coverage, evidence depth, priority gaps, source register, role-family scores, application stages and generated next steps |
| My evidence | `/app/record` | Workspace evidence parts + profile register | Confirmed skills, sources and processing states, CV versions, GitHub repositories, portfolio, manual evidence and privacy note |
| Setup wizard | `/app/workspace` (editing state) | Three-step wizard | Target context, source intake, evidence review and consent controls |
| Analysis | `/app/profile` (redirect `/app/pathways`, `/app/plan`) | Profile + Pathways | Five role cards, skill benchmark table, leverage chart, adjacent paths, three evidence-quality views and methodology |
| Job decoder | `/app/roles/decode` | Decode role | Collapsible input, role verdict, eligibility quotes, annotated advert, score breakdown, tracker action and recent analyses |
| Market | `/app/market` (and `/app/evidence` → `#ask`) | Market + Employer evidence | Role demand, skills and proof, geography, related demand, job-record retrieval and data limitations |
| Applications | `/app/jobs` | Application tracker | Stage board, closed/archive view, evidence readiness, history, notes and multi-role comparison |
| Settings | `/app/settings` | Settings | Identity, verification, sign out, JSON export and account deletion |
| Landing | `/` | Welcome | Demo and account entry, data-driven preview, market context, proof grading and privacy limits |
| Sign in | `/login`, `/register`, reset, verify-email, 404 | Auth screens | Shared auth layout and service availability messages |

Global: demo banner, service banners, skip link, `aria-current` on nav,
`aria-pressed` on selectors, live regions for async results, reduced motion,
offline page and Android build must keep working.

## 4. Known bugs found during the audit (fix while porting)

1. Demo evidence search shows no results: `demoApi.ts` returns `results`,
   `App.tsx` reads `result.citations`. Align the demo response with the API.
2. Market "Graduate and junior" shows 0: the filter matches `graduate` /
   `junior`, the data says `Graduate / Junior`. Match on the normalised label.
3. Left sidebar background stops at ~900 px on long pages (goes away with the
   top bar).
4. Mobile: role-family buttons cut off; table cells collide ("Auckland16").
5. `echarts`, `echarts-for-react` and `@xyflow/react` are dependencies but not
   used in `src`; draw the new charts as inline SVG like the mockup and remove
   unused packages only if nothing else needs them.

## 5. Suggested order of work

1. Tokens, fonts, base elements (buttons, inputs, sections, tables, chips,
   proof glyph) and the new top-bar shell.
2. Overview + My evidence + setup wizard.
3. Analysis (merge Profile + Pathways; add leverage chart; reduce duplicate
   charts to the three quality views).
4. Job decoder.
5. Market with the job-record search.
6. Applications board and compare mode; Settings.
7. Landing and auth screens.
8. Mobile pass (390 px), accessibility pass (axe), then tests.

After each step, screenshot the page at 1440 and 390 px in demo mode and
compare with `docs/design/screenshots/final/`.

## 6. Tests and checks

- Update `frontend/e2e/critical-journey.spec.ts`: headings and button names
  change (e.g. "Your evidence, ready for different technical directions",
  "Your role decisions, in one place", "All the evidence you can currently
  prove", "Three views of evidence quality", "Control your account data").
  Keep the same journeys covered, plus the axe checks.
- `npm run lint`, `npm run test:unit`, `npm run build`, `npm run test:e2e`
  must pass. Report any failure with output; do not skip tests.
- Check the demo workspace end to end: every nav item, decode an advert,
  restore an analysis, search job records and generate a summary, move a
  card between stages, compare two roles, export.

## 7. Done means

All pages match `docs/design/screenshots/final/` at both widths, every item in
`feature-inventory.md` is reachable, the bugs in section 4 are fixed, tests
pass, and the work is committed on its own branch with screenshots of the
real app attached for the owner to review.
