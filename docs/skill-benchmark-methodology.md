# CareerSignal skill benchmark methodology

CareerSignal treats a role-family benchmark as a documented prior that is
calibrated by observed New Zealand job postings. It is not a universal
definition of a profession and it is not an endorsement of a particular
technology stack.

## Evidence used

- **Campion et al. (2011), _Doing Competencies Well: Best Practices in
  Competency Modeling_**. Competencies should be defined, organised and used
  consistently. This is why the product stores a skill, its category, the
  evidence level and the evidence source separately.
  DOI: https://doi.org/10.1111/j.1744-6570.2010.01207.x
- **Deming & Kahn (2018), _Skill Requirements across Firms and Labor Markets:
  Evidence from Job Postings for Professionals_**. Repeated requirements in
  job advertisements are useful signals of labour-market demand. CareerSignal
  uses posting frequency as a bounded calibration signal rather than treating
  a single advertisement as a role definition.
  DOI: https://doi.org/10.1086/694106
- **Savickas & Porfeli (2012), _Career Adapt-Abilities Scale_**. A candidate's
  current evidence and possible adjacent directions should be represented as
  separate constructs. This informs the role-family comparison and pathway
  views.
  DOI: https://doi.org/10.1016/j.jvb.2012.01.010
- **Kristof-Brown, Zimmerman & Johnson (2005), _Consequences of Individuals'
  Fit at Work_**. This meta-analysis treats person-job fit as a relationship
  between an individual and the demands of a job. CareerSignal therefore
  presents alignment as a comparison with a changing benchmark, not as a
  permanent label or hiring probability.
  DOI: https://doi.org/10.1111/j.1744-6570.2005.00672.x
- **DeFillippi & Arthur (1996), _Boundaryless Contexts and Careers_**.
  Career competencies are portable across employers and contexts. This is the
  rationale for keeping a candidate's evidence record independent from a
  single target role and showing adjacent role families.
  DOI: https://doi.org/10.1093/oso/9780195100143.003.0007
- **O*NET Content Model**. Provides occupational descriptors and skill
  dimensions used to select the role-family prior.
  https://www.onetcenter.org/content.html
- **ESCO skills classification**. Provides a cross-occupation skills
  vocabulary and relationship structure used to keep skill names transferable.
  https://esco.ec.europa.eu/en/classification/skill
- **Tāhatu Career Navigator**. Provides New Zealand-oriented career and
  pathway context. It is used as local context, not as a replacement for
  posting data.
  https://tahatu.govt.nz/

## Role-family prior

Each role family has a small, reviewable list of capabilities. The prior
contains a weight and an explicit-required flag. The source mapping is kept in
`backend/app/taxonomy.py` so a reviewer can inspect or update it without
changing scoring code.

The first benchmark release maps role families to source-backed capability
groups as follows:

| Role family | Capability groups in the prior | Reference basis |
| --- | --- | --- |
| Software Engineer | web/API delivery, SQL, version control, automated testing, container delivery | O*NET Software Developers and QA Analysts; ESCO software-development skills |
| Data & BI Analyst | SQL, reporting/BI, Python, relational data, version control | O*NET Data Scientists and Management Analysts; Tāhatu NZ career profiles |
| Data Engineer / Analytics Engineer | Python, SQL, relational modelling, ETL/orchestration, distributed processing, containers, CI/CD | O*NET Database Architects and Database Administrators; ESCO data-management skills |
| AI Application Engineer | Python, model/LLM application, retrieval, API delivery, testing, containers, embeddings/vector stores | O*NET Data Scientists and Software Developers; NIST AI RMF production and risk guidance |
| Cloud / DevOps Engineer | containers, infrastructure as code, cloud platforms, CI/CD, orchestration, scripting | O*NET Network and Computer Systems Administrators; CNCF cloud-native landscape; SFIA infrastructure skills |

These groups explain why a skill appears in a prior; they do not imply that
every employer uses the same vendor or tool. A tool such as Power BI, dbt or
Terraform receives a signal because it is an observable implementation of a
broader capability, not because the product designer prefers that tool.

## Market calibration

For a role family with `N` indexed postings and `n_s` postings mentioning
skill `s`:

```text
frequency(s) = n_s / N
calibrated_weight(s) = prior_weight(s) * (0.75 + 0.50 * min(1, frequency(s)))
```

If no postings are available, the prior weight is retained. The multiplier is
bounded to 0.75--1.25 so a small or incomplete sample cannot rewrite the
occupational model. The API returns the posting count, source links and the
per-skill frequency used for the calibration.

## Candidate evidence

The candidate score is separate from labour-market demand. It combines
evidence maturity, extraction confidence, implementation detail, verification,
outcomes and independent source coverage. A skill listed in a CV therefore
cannot receive the same signal as a tested, deployed project supported by
both a CV and a public repository.

The interface labels the result as an evidence alignment, not a probability
of being hired.

## Visual interpretation

- **Capability network** shows the portable evidence record. Node size reflects
  evidence maturity; it is not a measure of talent or seniority.
- **Maturity x confidence** separates the quality of the work described from
  the certainty with which it was extracted from a source.
- **Source coverage matrix** makes triangulation visible. A capability that is
  present in a CV and an inspectable repository is easier to verify than a
  keyword in one source.
- **Role alignment radar** compares the same candidate record with the selected
  role-family prior. It keeps essential capabilities and supporting capabilities
  visibly distinct.
- **Evidence-to-demand plot** is shown only when a role family has indexed
  postings. The horizontal axis is bounded posting mention frequency; the
  vertical axis is candidate evidence strength; bubble size is the benchmark
  weight. This gives users a prioritisation view without turning frequency into
  a false hiring probability.

## Data provenance requirements

Every role-family benchmark should retain:

1. the occupational and skills framework sources;
2. the indexed posting count and collection period;
3. the per-skill posting mention count and frequency;
4. the benchmark version and the date it was last reviewed.

When any of these are unavailable the UI must say `prior benchmark only` or
`waiting for a posting sample`, rather than showing a fabricated market signal.
