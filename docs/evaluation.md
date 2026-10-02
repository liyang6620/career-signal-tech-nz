# Evaluation

CareerSignal keeps deterministic extraction, scoring and retrieval under versioned regression checks. Evaluation data contains synthetic or public-job-style text only; private user CVs and pasted advertisements are not copied into the repository.

## Labelled sets

| Dataset | Purpose | Automated check |
| --- | --- | --- |
| `backend/evaluation/jd_extraction.json` | Role scope, skills and eligibility extraction | Expected labels must be present and role/scope must match |
| `backend/evaluation/cv_evidence.json` | Conservative CV evidence extraction and evidence level boundaries | Expected skills and minimum/maximum levels |
| `backend/evaluation/role_fit_review.json` | Human review questions for score usefulness and explanation boundaries | Reviewed before scoring-contract changes |
| `backend/evaluation/rag_relevance.json` | Query-to-job relevance expectations | Recall@K and mean reciprocal rank on the indexed corpus |

The labelled sets are deliberately small initial baselines, not statistical proof of model quality. Add a case whenever a real beta test exposes a false positive, false negative or misleading ranking. Changes to taxonomy, evidence levels, role decoding or retrieval should not lower an established result without a documented reason.

## Live feedback

Users can mark retrieved employer evidence as relevant or not relevant. The product reports only aggregate counts and ranks. Audit and Prometheus events use an allow-list of event names and never include CV text, job-description text or search queries.
