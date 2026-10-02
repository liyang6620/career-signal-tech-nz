# Architecture

CareerSignal separates market facts, candidate evidence, deterministic scoring, and AI explanation. This prevents a language model from inventing numeric assessments.

```text
Public permitted sources -> ingestion -> normalized jobs -> PostgreSQL/pgvector
                                                     |              |
CV + GitHub -> evidence extraction -> evidence store +------> scoring engine
                                                                    |
                                cited retrieval -> AI explanation <-+
                                                                    |
                                                     dashboard + career route + application tracker
```

## Trust boundaries

- Collectors retain source URL, retrieval time, source type, and content hash.
- Normalization produces versioned skills and role-family mappings.
- Scores are pure functions over validated inputs and market weights.
- AI may classify or explain, but cannot write final scores.
- Every recommendation must cite market observations and candidate evidence.
- Candidate documents are private by default and deletable by the owner.

## Identity and persistence

- Passwords are hashed with Argon2 and never stored or logged in plaintext.
- Access JWTs are short-lived and held by the frontend in memory.
- Opaque refresh tokens are sent in HttpOnly cookies; only their SHA-256 hashes are persisted.
- Refresh sessions rotate on use and can be revoked at logout.
- Career profiles, targets and evidence-source references are scoped through the authenticated user identifier.
- Alembic owns application-schema changes. PostgreSQL initialization SQL owns pgvector and the analytical/RAG foundation.
- Email verification and password reset use hashed, expiring, single-use tokens.
- Registration, login failure, verification resend and reset-request limits persist in PostgreSQL audit events.
- Account export and authenticated deletion provide the initial privacy self-service boundary.

## Private document ingestion

- The API issues a short-lived presigned PUT for a user-scoped object key; file bytes do not pass through the API process.
- Completion verifies the stored size, content type and signed expected-size metadata before a job is accepted.
- A durable PostgreSQL queue is claimed with `FOR UPDATE SKIP LOCKED`, allowing multiple workers without duplicate processing; expired processing leases are reclaimed after worker failure.
- The worker validates PDF/DOCX signatures and streams each object through ClamAV. Rejected or infected objects are deleted.
- Only security-cleared objects are queued for parsing; rejected objects never enter evidence extraction.
- Local development uses private MinIO storage. The same storage boundary supports managed S3-compatible services in deployment.

## Evidence extraction and review

- Clean PDF and DOCX files are parsed locally in the worker; no document content is sent to an external model.
- The database retains the parser version, a SHA-256 text fingerprint, document metrics and short source excerpts, not a second full-text CV copy.
- Versioned deterministic aliases generate initial skill suggestions with a source locator, confidence and conservative evidence level.
- Suggestions remain `pending` until the document owner explicitly confirms or rejects every item.
- Confirmed suggestions are reviewable evidence inputs, not claims of mastery. OCR and semantic inference remain future stages.

## Public project evidence

- GitHub repository URLs are parsed into owner/repository identifiers before requests are made to the fixed GitHub API host.
- Only public, active repositories are accepted. Repository metadata, topics and a bounded README snapshot are retained with provenance.
- Deterministic taxonomy aliases may propose conservative level-2 evidence; language detection alone never raises the level.
- The owner must review every suggestion before it enters the shared candidate evidence graph.
- Role fit selects the strongest confirmed evidence per skill across CV and GitHub sources without double-counting it.

## Market ingestion and role decoding

- Market writes require a separate ingestion credential; authenticated product users cannot insert market records.
- Every batch records the source type, base URL and human-readable permission basis.
- Each posting retains its canonical source URL, content hash, publication time and retrieval time.
- Role family, seniority and skill mentions are produced by a versioned deterministic classifier over responsibilities.
- Market Explorer aggregates only persisted governed records and shows an explicit empty state when none exist.
- Permitted Greenhouse, Lever, Ashby, SmartRecruiters, Workday, Workable and schema.org adapters share the same persistence path as structured imports and conservatively reject records without an explicit New Zealand location or a match to the active technology role taxonomy.
- Collector source configuration records the permission basis; each bounded run is queued durably, claimed with a worker lease, retried up to three times, and records success/failure, counts and timestamps.
- Market quality reporting exposes source freshness, missing publication dates, stale records and low-confidence deterministic classifications.
- Collector requests return immediately with a queued run. The worker also materialises per-source recurring schedules, prevents duplicate active runs, enforces source-specific minimum intervals and refreshes changed RAG chunks after successful collection.

## Persisted user workflow

- Saved opportunities are scoped to the authenticated user and use a unique canonical source URL per account.
- Application status changes are persisted as `saved`, `preparing`, `applied`, `interview`, `offer`, `rejected` or `archived`.
- Every application stage change is appended to `job_status_events` and can be inspected from the Application Tracker, preserving an auditable timeline instead of overwriting the previous state.
- A saved governed-market role is decoded from its full persisted advertisement. Its current evidence coverage and priority gaps are shown in the tracker, and a user can generate a persistent preparation plan linked to that specific opportunity.
- Role Decoder responses are stored as immutable analysis snapshots with the role family, scope status, confidence and JSON result. This lets the UI show recent decisions without recalculating or losing the original output.
- Upload processing exposes durable job records and a separate readiness endpoint so the frontend and container orchestrator can distinguish a live API from a database-ready service.

## Scoring

The role comparison keeps evidence classification separate from presentation. Candidate evidence maturity is:

```text
non-linear evidence-level baseline
* confidence factor (0.85 + 0.15 * extraction confidence)
+ min(9, 3 * log2(independent source count))
+ 4 when two or more source types corroborate the capability
```

JD capability priority is calculated independently from explicit mention, repetition, requirement language and title
context. The decoder also returns independent coverage-style proximity scores for every supported role family, so
mixed and out-of-scope adverts are not forced into one class. Radar axes contain only skills found in the JD, and the
candidate evidence query uses those same skill slugs. Both results are capped at 100. The API returns each component so the UI can explain why,
for example, one skill scores 31 while another scores 93. The deterministic dimension-scoring endpoint remains
available for aggregate assessments, with `65% coverage + 35% evidence depth` and a missing-required-skill cap.

## RAG design

PostgreSQL is the system of record and pgvector supports semantic retrieval. Governed job descriptions are split into bounded overlapping chunks and embedded locally with `BAAI/bge-small-en-v1.5`; posting content hashes and model identifiers make indexing incremental and auditable. The model cache persists independently of API containers.

Retrieval filters first by role family, location, seniority and publication window. PostgreSQL English full-text search and pgvector cosine search each produce a ranked candidate list, then reciprocal-rank fusion combines them without model-generated relevance scores. Results expose the original posting URL, excerpt, publication date and deterministic citation label. OpenAI may later explain these retrieved citations with typed outputs, but is not part of indexing, retrieval or scoring.

The protected evaluation endpoint runs a versioned labelled query set with explicit role-family and term expectations. It reports Recall@K and mean reciprocal rank only over the current indexed corpus, and returns `insufficient_data` when that corpus is empty. JD extraction and CV evidence extraction have separate labelled regression sets. In-product relevance judgements complement the offline RAG set without storing CV or JD text in analytics events.

## Production evolution

The API now exposes the scoring contract, identity lifecycle, persisted career profiles, private document ingestion, user-reviewed CV evidence extraction, compliant market ingestion and citation-returning hybrid retrieval. `/health`, `/ready`, structured request IDs and `/metrics` provide an operational baseline. Metrics include queue health, overdue sources, 30-day active users and a small allow-list of product events; event labels never contain CV, JD or query content. External telemetry export and restore drills remain deployment work.
