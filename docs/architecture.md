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

PostgreSQL is the system of record and pgvector supports semantic retrieval. Local embeddings are the default to keep development free. Retrieval is filtered first by role, geography, seniority, freshness, and source permission; vector similarity then ranks relevant passages. OpenAI Structured Outputs will generate typed explanations from retrieved citations.

## Production evolution

The API now exposes the scoring contract, identity lifecycle, persisted career profiles, private document ingestion and user-reviewed CV evidence extraction. Next increments add the canonical skill taxonomy, confirmed-evidence scoring integration, GitHub extraction, compliant market ingestion, deduplication, retrieval evaluation, observability, backup policies and deployment manifests.
