# CareerSignal Tech NZ

CareerSignal is an evidence-based career intelligence platform for New Zealand computing and digital-technology job seekers. It analyses job postings, decodes the real work behind inconsistent role titles, connects market requirements to proof found in CVs and GitHub projects, and builds explainable pathways between technology careers.

This repository is being developed as an early production product, not a one-off portfolio dashboard. The current beta includes a complete authenticated journey, persistent candidate evidence, CV and GitHub review, live-data-only market exploration, role decoding, capability profiling, career-path exploration, cited employer evidence and application tracking. Market counts describe only the permitted New Zealand job records currently indexed by CareerSignal; they are directional samples, not official labour-market totals.

## Why it is different

Most career tools rewrite text or return opaque match percentages. CareerSignal treats employability as an evidence and data-quality problem:

- A radar chart measures documented evidence coverage for a specific role, location, seniority, and time window.
- An interactive network connects role requirements, skills, projects, and verifiable proof.
- A portable capability record can be compared across all supported role families without re-uploading the same evidence.
- Evidence maturity, extraction confidence, source triangulation and market frequency remain separate, inspectable signals.
- Numeric scores are deterministic. AI explains retrieved evidence with citations; it never invents the score.

## MVP role coverage

- Software Engineer
- Data & BI Analyst
- Data Engineer / Analytics Engineer
- AI Application Engineer
- Cloud / DevOps Engineer

The core taxonomy is designed for later expansion into Quality Engineering, IT and Systems, Business Technology, Product and UX, and Cybersecurity without changing the underlying capability model.

## Current product journey

1. Create and verify an account.
2. Define a New Zealand target market and career level.
3. Upload a private CV and connect public GitHub evidence.
4. Review extracted evidence before it affects any score.
5. Explore current indexed demand by role family, skill and location.
6. Decode a real job advertisement, including hard eligibility requirements.
7. Compare the advertisement's capability profile with the same saved candidate evidence.
8. Inspect the personal capability network and switch between five role-family benchmarks.
9. Save opportunities and track preparation, applications, interviews and outcomes.

The routed application surfaces are:

- `/app/workspace` — evidence and analysis context
- `/app/market` — governed New Zealand market sample
- `/app/roles/decode` — job-advertisement analysis and evidence comparison
- `/app/evidence` — cited employer-evidence retrieval
- `/app/pathways` — adjacent career directions
- `/app/profile` — portable capability report and role-family alignment
- `/app/applications` — persisted application tracker
- `/app/settings` — account, export and deletion controls

The [product scope](docs/product-scope.md) defines users, module boundaries, the role taxonomy, evidence rules and phased delivery.

The current workflow also includes a persisted Application Tracker (`/app/jobs`): a sourced vacancy can be saved from
Employer Evidence, moved through preparation, application, interview and offer stages, and reopened after the next login.
Role Decoder runs are stored as user-owned history, while upload jobs expose their durable processing status through the API.

## Evidence and profile model

The public home page introduces the product before authentication. After sign-in, Workspace reuses the saved target and evidence across every analysis rather than asking the user to upload the same material again. It supports private PDF/DOCX CV upload, public GitHub repositories and an optional portfolio source. Uploaded CVs remain unavailable to parsing until their type, size, signature and malware scan have passed. Text-based CVs are parsed locally into traceable suggestions that the user must confirm or reject before they affect the profile.

Profile is an evidence report rather than a keyword inventory. It contains:

- a personal capability network independent of one target role;
- domain concentration and evidence-maturity distributions;
- maturity-versus-confidence and source-coverage diagnostics;
- switchable role-family alignment cards and radar comparisons;
- an evidence-to-demand view when a sufficient posting sample exists;
- explicit empty states when only the occupational prior is available.

The measurement design is informed by competency modelling, person-job fit, career adaptability and job-posting skill-signal research. Role-family priors are mapped to O*NET, ESCO, SFIA, Tāhatu and relevant production frameworks, then bounded by observed posting frequency so a small sample cannot rewrite the occupational model. See [docs/skill-benchmark-methodology.md](docs/skill-benchmark-methodology.md).

## Explainable scoring

Evidence levels range from 0 (missing) through claimed, practised, project implementation, verified implementation, and professional use. They are stored as the auditable source classification, but the comparison UI presents two separate 0-100 scores.

```text
candidate evidence = non-linear evidence-level baseline
                     * extraction-confidence factor
                     + independent-source corroboration
                     + source-type diversity

JD capability priority = explicit mention
                         + repetition signal
                         + requirement-language signal
                         + title context
```

Candidate baselines intentionally spread claims, use, implementation, verification and professional experience across the scale instead of clustering results around 70-80. The Role Decoder reports independent proximity scores for all supported role families, labels mixed and out-of-scope adverts, and builds radar axes only from capabilities explicitly found in the supplied JD. The API returns every component for auditability. Candidate scores indicate the strength of available proof, not absolute human ability; job scores indicate requirement intensity, not candidate suitability.

## Architecture and stack

- Frontend: React 19, TypeScript, Vite, ECharts, React Flow
- API: Python 3.12, FastAPI, Pydantic
- Persistence/auth: SQLAlchemy, Alembic, Argon2, short-lived JWT access tokens and rotated refresh sessions
- Private files: S3-compatible object storage, presigned direct uploads, ClamAV, durable PostgreSQL work queue
- Document evidence: local PDF/DOCX parsing, versioned deterministic skill matching, user-confirmed evidence review
- Project evidence: public GitHub repository snapshots, conservative README/language/topic matching, explicit review
- Market intelligence: governed posting imports, provenance and permission metadata, deterministic role decoding
- Data/RAG: PostgreSQL 16 + pgvector; local embeddings by default
- Analytics/ingestion: governed Greenhouse, Lever, Ashby, SmartRecruiters, Workday, Workable and schema.org collectors with durable recurring schedules, per-source minimum intervals and automatic RAG re-indexing; DuckDB and Parquet snapshots remain planned
- AI: optional OpenAI Responses API with Structured Outputs and cited context
- Delivery: Docker Compose and GitHub Actions

See [docs/architecture.md](docs/architecture.md) for boundaries and the production evolution plan.

## Run locally

Create a local `.env` from `.env.example` and add secrets locally. `.env` is ignored by Git and must never be committed.

Frontend:

```bash
cd frontend
npm install
npm run dev
```

API:

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Or start PostgreSQL with pgvector, MinIO, ClamAV, the API and the background worker:

```bash
docker compose up --build
```

Generate a strong `JWT_SECRET` in `.env` before running any shared or deployed environment. The API container applies Alembic migrations before startup. For local API development, apply them explicitly:

```bash
cd backend
alembic upgrade head
```

With the default Docker port mapping, API documentation is available at `http://localhost:8001/docs`; the Vite frontend defaults to `http://localhost:5173`.

## Quality checks

```bash
cd backend && ruff check app tests && pytest
cd frontend && npm run lint && npm run build && npm run test:e2e
```

CI runs the same checks on every pull request and push to `main`. The browser suite protects public entry, guarded routing, legacy route redirects, the capability profile, application-to-profile navigation, responsive career-path readability and account export.

## Evidence retrieval

The current RAG foundation indexes governed job descriptions into bounded, versioned chunks using the free local `BAAI/bge-small-en` embedding model with its passage/query modes. Unchanged postings are skipped using their content hash. Retrieval applies optional role-family, location, seniority and publication-window filters before combining PostgreSQL full-text ranking with pgvector cosine ranking through reciprocal-rank fusion.

`POST /api/v1/rag/index` is protected by the ingestion credential. `POST /api/v1/rag/search` is available to verified users and returns excerpts with stable citation labels, original job URLs, publication dates and retrieval scores. It does not generate an answer or a market claim. The first indexing run downloads the local model into a persistent Docker cache volume; no OpenAI key is used.

`POST /api/v1/rag/evaluate` runs the versioned retrieval smoke set against the current indexed corpus and reports Recall@K, mean reciprocal rank and failed cases. It is protected by the ingestion credential and returns `insufficient_data` instead of manufacturing a score when no chunks are indexed. These cases are an engineering regression signal, not a claim that the market dataset is representative.

## Data acquisition and compliance

Governed ingestion supports permitted Greenhouse, Lever, Ashby, SmartRecruiters, Workday and Workable job-board endpoints plus `schema.org/JobPosting` on a configured HTTPS company careers page. Every collector source requires a recorded permission basis, and every bounded run retains its status, accepted/rejected counts, timestamps and a bounded failure reason. Only records with an explicit New Zealand location and a role inside the current technology taxonomy are accepted. Successful refreshes remove roles that disappeared from that source. Manual permitted imports use the same deterministic classification, hashing, URL upsert and skill-replacement path.

Collectors can be triggered by an administrator and are also materialised automatically from each source's recurring schedule. A worker claims each durable run with a lease, enforces the source's minimum interval, uses a 20-second network timeout, retries transient failures up to three times, records accepted/rejected counts and updates the RAG index after a successful refresh. Operators remain responsible for confirming source terms, robots directives, rate limits and takedown requirements before registration. The project does not scrape SEEK, bypass authentication, CAPTCHAs or platform controls, and does not claim complete New Zealand market coverage.

For local development, `scripts/seed_market_sources.ps1` registers and runs the permitted public boards used for the current market slice. The registry includes NZ-founded software companies alongside Air New Zealand, Meridian Energy, Vector, Fisher & Paykel Appliances, Vista Group and an NZ-eligible Octopus Deploy board. This improves employer and industry diversity and covers Auckland, Wellington, Christchurch and New Zealand remote listings when current vacancies are available. It records the permission basis and collector run results in PostgreSQL; this remains a reproducible sample, not a claim that the result represents the whole market. After collection, run `POST /api/v1/rag/index` with the ingestion credential to build the searchable evidence corpus.

## Roadmap

1. Versioned job, skill, source, and candidate-evidence schema with migrations.
2. Expand compliant source coverage and define measurable freshness and coverage objectives.
3. OCR and deeper GitHub repository inspection with user confirmation and provenance.
4. Labelled extraction and retrieval evaluation sets, citation-grounded explanations and relevance monitoring.
5. Expand the optional OpenAI explanation layer with typed outputs, bounded output size and regression checks.
6. External telemetry export, backups, restore drills, and deployment runbooks.
7. Real-user validation of scoring weights and recommendation usefulness.

## Production-readiness status

The repository currently provides a production-oriented beta foundation rather than claiming production operation. Authentication, private CV ingestion, public GitHub evidence, explicit evidence review, a canonical skill taxonomy, deterministic role fit, governed scheduled collectors, automatic retrieval indexing, Role Decoder, persisted role-analysis history, job-linked development tasks, a saved-job application tracker with evidence gaps and status timelines, local pgvector hybrid retrieval, labelled extraction/retrieval regression sets and a live-data-only Market Explorer are implemented. Market writes require a separate ingestion credential and retain source URL, permission basis, retrieval time and content hash. Collector runs and data-quality indicators expose freshness, rejection, missing-date, stale-record and classification-confidence risks. `/health`, `/ready`, request IDs, structured request logs and `/metrics` provide an operational baseline, including content-free beta usage counters. Retrieval returns source-linked evidence rather than an uncited generated answer. The explorer intentionally shows an empty state until permitted records are loaded; it never substitutes demonstration counts. Automated browser journeys and serious/critical WCAG checks run in CI. OCR, semantic CV inference, deeper repository code inspection, larger human relevance benchmarks and broad live-market coverage are not implemented yet. Before unrestricted public use or broad live-market claims, the platform still requires managed secrets, managed telemetry export, backup/restore drills and explicit ingestion reliability targets.

## License

MIT
