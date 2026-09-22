# CareerSignal Tech NZ

CareerSignal is an evidence-based career intelligence platform for New Zealand computing and digital-technology job seekers. It analyses job postings, decodes the real work behind inconsistent role titles, connects market requirements to proof found in CVs and GitHub projects, and builds explainable pathways between technology careers.

This repository is being developed as a production product, not a one-off portfolio dashboard. The current release establishes the product interface, deterministic scoring contract, identity and persistence layer, private CV upload pipeline, test suite, containerized services, and CI. **All market counts and benchmarks currently visible in the frontend are labelled demonstration data; they are not presented as live New Zealand market statistics.**

## Why it is different

Most career tools rewrite text or return opaque match percentages. CareerSignal treats employability as an evidence and data-quality problem:

- A radar chart measures documented evidence coverage for a specific role, location, seniority, and time window.
- An interactive network connects role requirements, skills, projects, and verifiable proof.
- Recommendations identify the smallest credible project change that closes a high-value market gap.
- Numeric scores are deterministic. AI explains retrieved evidence with citations; it never invents the score.

## MVP role coverage

- Software Engineer
- Data & BI Analyst
- Data Engineer / Analytics Engineer
- AI Application Engineer
- Cloud / DevOps Engineer

The core taxonomy is designed for later expansion into Quality Engineering, IT and Systems, Business Technology, Product and UX, and Cybersecurity without changing the underlying capability model.

## Product modules

- Tech Market Explorer
- Role Decoder
- Career Path Map
- Candidate Evidence Graph
- Job Fit Explorer
- SkillRoute
- Project Builder
- Evidence RAG
- Application Portfolio
- Market Change Alerts

The [product scope](docs/product-scope.md) defines users, module boundaries, the role taxonomy, evidence rules and phased delivery.

## Product surfaces

The default frontend is a new-user profile setup flow, not a pre-filled personal dashboard. It collects the target role, location and seniority, supports private PDF/DOCX CV upload, accepts optional GitHub and portfolio sources, and asks the user to review the analysis scope. Uploaded CVs remain unavailable to parsing until their type, size, signature and malware scan have passed. Text-based CVs are then parsed locally into traceable skill suggestions that the user must confirm or reject before they can affect the profile.

## Explainable scoring

Evidence levels range from 0 (missing) through claimed, practised, project implementation, verified implementation, and professional use. Each skill is adjusted for evidence quality, recency, verification, and target-role relevance.

```text
skill score = evidence level / 5
              * quality * recency * verification * role relevance * 100

dimension score = coverage * 65% + evidence depth * 35%
```

Missing required skills cap a dimension score. The API returns all contributions and whether a cap was applied. Scores indicate documented evidence coverage against the selected market, not absolute human ability.

## Architecture and stack

- Frontend: React 19, TypeScript, Vite, ECharts, React Flow
- API: Python 3.12, FastAPI, Pydantic
- Persistence/auth: SQLAlchemy, Alembic, Argon2, short-lived JWT access tokens and rotated refresh sessions
- Private files: S3-compatible object storage, presigned direct uploads, ClamAV, durable PostgreSQL work queue
- Document evidence: local PDF/DOCX parsing, versioned deterministic skill matching, user-confirmed evidence review
- Project evidence: public GitHub repository snapshots, conservative README/language/topic matching, explicit review
- Market intelligence: governed posting imports, provenance and permission metadata, deterministic role decoding
- Data/RAG: PostgreSQL 16 + pgvector; local embeddings by default
- Analytics/ingestion: governed Greenhouse, Lever and schema.org collectors; DuckDB, Parquet and scheduling remain planned
- AI: optional OpenAI Responses API with Structured Outputs and cited context
- Delivery: Docker Compose and GitHub Actions

See [docs/architecture.md](docs/architecture.md) for boundaries and the production evolution plan.

## Run locally

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

API documentation is available at `http://localhost:8000/docs`; the Vite frontend defaults to `http://localhost:5173`.

## Quality checks

```bash
cd backend && ruff check app tests && pytest
cd frontend && npm run lint && npm run build
```

CI runs the same checks on every pull request and push to `main`.

## Evidence retrieval

The current RAG foundation indexes governed job descriptions into bounded, versioned chunks using the free local `BAAI/bge-small-en` embedding model with its passage/query modes. Unchanged postings are skipped using their content hash. Retrieval applies optional role-family, location, seniority and publication-window filters before combining PostgreSQL full-text ranking with pgvector cosine ranking through reciprocal-rank fusion.

`POST /api/v1/rag/index` is protected by the ingestion credential. `POST /api/v1/rag/search` is available to verified users and returns excerpts with stable citation labels, original job URLs, publication dates and retrieval scores. It does not generate an answer or a market claim. The first indexing run downloads the local model into a persistent Docker cache volume; no OpenAI key is used.

`POST /api/v1/rag/evaluate` runs the versioned retrieval smoke set against the current indexed corpus and reports Recall@K, mean reciprocal rank and failed cases. It is protected by the ingestion credential and returns `insufficient_data` instead of manufacturing a score when no chunks are indexed. These cases are an engineering regression signal, not a claim that the market dataset is representative.

## Data acquisition and compliance

Governed ingestion supports permitted Greenhouse and Lever job-board endpoints plus `schema.org/JobPosting` on a configured HTTPS company careers page. Every collector source requires a recorded permission basis, and every bounded run retains its status, accepted/rejected counts, timestamps and a bounded failure reason. Only records with an explicit New Zealand location are accepted. Manual permitted imports use the same deterministic classification, hashing, URL upsert and skill-replacement path.

The collectors are admin-triggered and synchronous with a 20-second network timeout; recurring scheduling, retry orchestration and source-specific rate policies are not implemented yet. Operators remain responsible for confirming source terms, robots directives, rate limits and takedown requirements before registration. The project does not scrape SEEK, bypass authentication, CAPTCHAs or platform controls, and does not claim complete New Zealand market coverage.

For local development, `scripts/seed_market_sources.ps1` registers and runs the two permitted public Greenhouse adapters used for the first market slice: Pushpay and Rocket Lab. It records the permission basis and collector run results in PostgreSQL; only postings whose location explicitly matches New Zealand are accepted. This is a reproducible seed, not a claim that the resulting sample represents the whole market. After collection, run `POST /api/v1/rag/index` with the ingestion credential to build the searchable evidence corpus.

## Roadmap

1. Versioned job, skill, source, and candidate-evidence schema with migrations.
2. Compliant job ingestion, deduplication, freshness monitoring, and data-quality reports.
3. OCR and deeper GitHub repository inspection with user confirmation and provenance.
4. Retrieval evaluation sets, citation-grounded explanations and relevance monitoring.
5. OpenAI explanation layer with typed outputs, cost budgets, and regression evals.
6. Telemetry, backups, restore drills, and deployment runbooks.
7. Real-user validation of scoring weights and recommendation usefulness.

## Production-readiness status

The repository currently provides a tested foundation rather than claiming production operation. Authentication, private CV ingestion, public GitHub evidence, explicit evidence review, a canonical skill taxonomy, deterministic role fit, governed job-posting imports and collectors, Role Decoder, local pgvector hybrid retrieval, retrieval regression metrics and a live-data-only Market Explorer are implemented. Market writes require a separate ingestion credential and retain source URL, permission basis, retrieval time and content hash. Collector runs and data-quality indicators expose freshness, rejection, missing-date, stale-record and classification-confidence risks. Retrieval returns source-linked evidence rather than an uncited generated answer. The explorer intentionally shows an empty state until permitted records are loaded; it never substitutes demonstration counts. OCR, semantic CV inference, repository code inspection, scheduled ingestion, human relevance judgements and broad live-market coverage are not implemented yet. Before public user data or live market claims, the platform still requires managed secrets, backup/restore drills, operational monitoring, ingestion reliability targets, accessibility testing, retrieval/scoring evaluation beyond the smoke set, and a deployment runbook.

## License

MIT
