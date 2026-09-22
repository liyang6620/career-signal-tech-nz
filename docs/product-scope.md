# Product Scope

## Positioning

CareerSignal Tech NZ is an evidence-based career intelligence platform for New Zealand computing and digital-technology job seekers. It analyses job postings, decodes what role titles mean in practice, maps demonstrated candidate evidence, and generates grounded career pathways.

It is not an ATS score, a CV writer, or a generic AI career chatbot. Market facts must be traceable to source data, candidate claims must be traceable to evidence, and numerical scoring must remain deterministic.

## Users

- Computing, software engineering and IT students
- Graduate and junior technology job seekers
- People moving between technology disciplines
- New migrants entering the New Zealand technology market
- University career centres and training providers
- People who do not yet know which technology role family fits them

## Role taxonomy

The data model supports these role families from the beginning:

1. Software Engineering
2. Data and Analytics
3. Data Engineering
4. AI and Machine Learning
5. Cloud and DevOps
6. Quality Engineering
7. IT and Systems
8. Business Technology
9. Product and UX
10. Cybersecurity

Cybersecurity is included as a market classification, not as a product security feature focus.

The MVP activates Software Engineer, Data Analyst / BI Analyst, Data Engineer / Analytics Engineer, AI Application Engineer, and Cloud / DevOps Engineer. Initial geography is Auckland, Wellington, Christchurch, and Remote / New Zealand, covering graduate, junior and intermediate levels.

## Core product modules

| Module | Responsibility |
| --- | --- |
| Tech Market Explorer | Explore New Zealand roles, locations, industries and skill trends |
| Role Decoder | Classify a job from responsibilities and requirements rather than title alone |
| Career Path Map | Show capability distance and transition paths between technology roles |
| Candidate Evidence Graph | Extract and review evidence from CVs, GitHub and projects |
| Job Fit Explorer | Compare documented evidence with a role family or job without an opaque ATS score |
| SkillRoute | Generate grounded 4, 8 or 12-week development routes |
| Project Builder | Recommend a new project or an upgrade to existing work that supplies missing evidence |
| Evidence RAG | Answer market questions from retrieved job evidence with citations |
| Application Portfolio | Store target roles, gaps, applications and preparation progress |
| Market Change Alerts | Notify users when target-role requirements change materially |

## Four-layer capability model

```text
domain
  -> capability
    -> technology
      -> evidence
```

Technologies can support several capabilities. For example, Playwright can provide evidence for automated testing, frontend testing, end-to-end workflow validation and CI integration. A role asking for automated testing can therefore match verified Playwright evidence without pretending the terms are identical.

## Evidence levels

| Level | Meaning | Requirement |
| ---: | --- | --- |
| 0 | Not found | No claim or evidence |
| 1 | Claimed | Appears only in a skills list or unsupported statement |
| 2 | Used | Used in coursework or a project |
| 3 | Implemented | Code, architecture or explicit implementation detail exists |
| 4 | Verified | Tests, deployment, metrics, users or outcomes verify the implementation |
| 5 | Real-world | Used in employment, internship or a real client environment |

Repository dependency detection alone must not produce a mastery claim.

## Retrieval

Hybrid retrieval applies structured filters for role family, geography, seniority and date, then combines PostgreSQL full-text search, pgvector semantic retrieval and reranking. OpenAI explains the retrieved evidence and returns citations; it does not invent market statistics or final scores.

## Delivery phases

1. Close the end-to-end loop for Software Engineering, Data and Analytics, Data Engineering, AI Application Engineering, and Cloud / DevOps.
2. Expand software specialisations and platform engineering.
3. Add Quality Engineering, IT and Systems, and Business Technology.
4. Add adjacent Product, UX and Security classifications.
