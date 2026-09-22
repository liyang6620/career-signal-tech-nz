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

The initial API exposes the scoring contract. Next increments add migrations, ingestion workers, deduplication, skill taxonomy versioning, document parsing, authentication, observability, evaluation datasets, rate limiting, backup policies, and deployment manifests.
