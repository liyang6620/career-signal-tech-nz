# Architecture

CareerSignal separates market facts, candidate evidence, deterministic scoring, and AI explanation. This prevents a language model from inventing numeric assessments.

```text
Public permitted sources -> ingestion -> normalized jobs -> PostgreSQL/pgvector
                                                     |              |
CV + GitHub -> evidence extraction -> evidence store +------> scoring engine
                                                                    |
                                cited retrieval -> AI explanation <-+
                                                                    |
                                                     dashboard + career route
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
- Permitted Greenhouse, Lever and schema.org adapters share the same persistence path as structured imports and conservatively reject records without an explicit New Zealand location.
- Collector source configuration records the permission basis; each bounded run records success/failure, counts and timestamps.
- Market quality reporting exposes source freshness, missing publication dates, stale records and low-confidence deterministic classifications.
- Collector runs are currently synchronous admin operations. Scheduling, durable retries and per-source rate policies remain future work.

## Scoring

Each assessment is bound to target role, location, seniority, and market window. A skill contribution is:

```text
(evidence level / 5)
* quality factor
* recency factor
* verification factor
* target-role relevance
* 100
```

The dimension score is `65% coverage + 35% evidence depth`. A missing required high-weight skill caps a dimension at 59. All factors and contributions are returned by the API for auditability.

## RAG design

PostgreSQL is the system of record and pgvector supports semantic retrieval. Governed job descriptions are split into bounded overlapping chunks and embedded locally with `BAAI/bge-small-en-v1.5`; posting content hashes and model identifiers make indexing incremental and auditable. The model cache persists independently of API containers.

Retrieval filters first by role family, location, seniority and publication window. PostgreSQL English full-text search and pgvector cosine search each produce a ranked candidate list, then reciprocal-rank fusion combines them without model-generated relevance scores. Results expose the original posting URL, excerpt, publication date and deterministic citation label. OpenAI may later explain these retrieved citations with typed outputs, but is not part of indexing, retrieval or scoring.

## Production evolution

The API now exposes the scoring contract, identity lifecycle, persisted career profiles, private document ingestion and user-reviewed CV evidence extraction. Next increments add the canonical skill taxonomy, confirmed-evidence scoring integration, GitHub extraction, compliant market ingestion, deduplication, retrieval evaluation, observability, backup policies and deployment manifests.
