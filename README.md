# CareerSignal Tech NZ

CareerSignal is an evidence-based career intelligence platform for New Zealand computing and digital-technology job seekers. It analyses job postings, decodes the real work behind inconsistent role titles, connects market requirements to proof found in CVs and GitHub projects, and builds explainable pathways between technology careers.

This repository is being developed as a production product, not a one-off portfolio dashboard. The current release establishes the product interface, deterministic scoring contract, test suite, containerized API, and CI. **All market counts and benchmarks currently visible in the frontend are labelled demonstration data; they are not presented as live New Zealand market statistics.**

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

The default frontend is a new-user profile setup flow, not a pre-filled personal dashboard. It collects the target role, location and seniority, accepts optional CV, GitHub and portfolio sources, and asks the user to review the analysis scope. The interface explicitly disables profile creation until ingestion and evidence-review endpoints are implemented. The API currently provides health, role-family, and deterministic scoring endpoints with generated OpenAPI documentation.

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
- Data/RAG: PostgreSQL 16 + pgvector; local embeddings by default
- Analytics/ingestion (planned): DuckDB, Parquet, Python collectors and APScheduler
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

Or start PostgreSQL with pgvector and the API:

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

## Data acquisition and compliance

Planned ingestion uses public company career pages, permitted Greenhouse/Lever endpoints, `schema.org/JobPosting`, Careers NZ and MBIE aggregates, and explicitly licensed datasets. Collectors must retain provenance and respect source terms, robots directives, rate limits, privacy, and takedown requirements. The project will not bypass authentication, CAPTCHAs, robots restrictions, or platform controls, and does not depend on a paid SEEK API.

## Roadmap

1. Versioned job, skill, source, and candidate-evidence schema with migrations.
2. Compliant job ingestion, deduplication, freshness monitoring, and data-quality reports.
3. CV/GitHub evidence extraction with user confirmation and provenance.
4. pgvector retrieval with locally generated embeddings and citation evaluation.
5. OpenAI explanation layer with typed outputs, cost budgets, and regression evals.
6. Authentication, deletion/export controls, audit logs, telemetry, and deployment.
7. Real-user validation of scoring weights and recommendation usefulness.

## Production-readiness status

The repository currently provides a tested foundation rather than claiming production operation. Authentication, revocable sessions, user-scoped profile persistence and database migrations are implemented. Before public user data or live market claims, it still requires email verification and password reset, abuse controls, managed secrets, backups, object storage and malware scanning for CVs, privacy export/deletion workflows, monitoring, ingestion reliability targets, accessibility testing, retrieval/scoring evaluation, and a deployment runbook.

## License

MIT
