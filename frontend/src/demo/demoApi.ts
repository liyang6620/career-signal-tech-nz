import type {
  DecodedRole,
  GithubProject,
  MarketQuality,
  MarketSummary,
  ProfileData,
  RoleFit,
  RoleKey,
  SavedJob,
  SessionUser,
  SkillEvidence,
  UploadRecord,
} from "../domain/types";

export const DEMO_TOKEN = "careersignal-demo-session";
export const DEMO_SESSION_KEY = "careersignal.demo";

export const demoUser: SessionUser = {
  id: "demo-user",
  email: "demo@careersignal.nz",
  display_name: "Demo Candidate",
  is_verified: true,
};

const now = "2026-10-10T09:00:00Z";

const profile: ProfileData = {
  id: "demo-profile",
  location: "Auckland",
  seniority: "Graduate / Junior",
  role_family: "data-engineer",
  updated_at: now,
  evidence_sources: [
    { id: "demo-cv-source", source_type: "cv", source_reference: "Data Engineering CV", processing_status: "confirmed" },
    { id: "demo-github-source", source_type: "github", source_reference: "https://github.com/example/nz-data-platform", processing_status: "confirmed" },
    { id: "demo-portfolio-source", source_type: "portfolio", source_reference: "https://example.dev", processing_status: "confirmed" },
  ],
};

const upload: UploadRecord = {
  id: "demo-upload",
  original_filename: "demo-data-engineering-cv.pdf",
  status: "confirmed",
  cv_label: "Data engineering CV",
  target_role: "data-engineer",
  created_at: now,
};

const evidence: SkillEvidence[] = [
  { skill_slug: "python", skill_name: "Python", category: "Programming", evidence_level: 4, confidence: 0.94, excerpt: "Built typed ingestion services and automated validation workflows.", locator: "github:nz-data-platform", source_type: "github" },
  { skill_slug: "sql", skill_name: "SQL", category: "Data", evidence_level: 4, confidence: 0.96, excerpt: "Designed analytical models and data-quality checks in PostgreSQL.", locator: "CV: project experience", source_type: "cv" },
  { skill_slug: "aws", skill_name: "AWS", category: "Cloud", evidence_level: 3, confidence: 0.91, excerpt: "Deployed container workloads with S3-backed document storage.", locator: "github: infrastructure", source_type: "github" },
  { skill_slug: "docker", skill_name: "Docker", category: "Platform", evidence_level: 4, confidence: 0.93, excerpt: "Created reproducible multi-service development and CI environments.", locator: "github: Dockerfile", source_type: "github" },
  { skill_slug: "fastapi", skill_name: "FastAPI", category: "Backend", evidence_level: 4, confidence: 0.95, excerpt: "Implemented authenticated APIs with validation and integration tests.", locator: "github: api", source_type: "github" },
  { skill_slug: "react", skill_name: "React", category: "Frontend", evidence_level: 3, confidence: 0.9, excerpt: "Delivered responsive evidence and job-comparison workflows.", locator: "portfolio: CareerSignal", source_type: "portfolio" },
  { skill_slug: "postgresql", skill_name: "PostgreSQL", category: "Data", evidence_level: 3, confidence: 0.92, excerpt: "Modelled relational evidence and vector-search records.", locator: "github: migrations", source_type: "github" },
  { skill_slug: "github-actions", skill_name: "GitHub Actions", category: "Delivery", evidence_level: 3, confidence: 0.89, excerpt: "Automated linting, tests, builds and deployment checks.", locator: "github: workflows", source_type: "github" },
  { skill_slug: "pytest", skill_name: "Pytest", category: "Quality", evidence_level: 3, confidence: 0.91, excerpt: "Added API, security and data integration coverage.", locator: "github: tests", source_type: "github" },
  { skill_slug: "power-bi", skill_name: "Power BI", category: "Analytics", evidence_level: 2, confidence: 0.84, excerpt: "Produced stakeholder dashboards and data summaries.", locator: "CV: analytics project", source_type: "cv" },
  { skill_slug: "terraform", skill_name: "Terraform", category: "Cloud", evidence_level: 1, confidence: 0.76, excerpt: "Used infrastructure-as-code in a guided deployment exercise.", locator: "CV: professional development", source_type: "cv" },
];

function contribution(skill_slug: string, skill_name: string, evidence_level: number, weight: number, required = true) {
  const normalized_score = Math.min(96, evidence_level * 19 + 8);
  return {
    skill_slug, skill_name, weight, required, evidence_level, evidence_confidence: evidence_level ? 0.9 : 0,
    source_count: evidence_level ? 2 : 0, source_type_count: evidence_level ? 2 : 0,
    base_score: Math.max(0, normalized_score - 7), confidence_adjustment: evidence_level ? 4 : 0,
    specificity_bonus: evidence_level ? 2 : 0, verification_bonus: evidence_level >= 3 ? 2 : 0,
    outcome_bonus: evidence_level >= 4 ? 2 : 0, corroboration_bonus: evidence_level ? 2 : 0,
    diversity_bonus: evidence_level ? 1 : 0, score_factors: evidence_level ? ["reviewed evidence", "multiple sources"] : ["evidence gap"],
    normalized_score, weighted_score: normalized_score * weight, market_frequency: 0.62,
    market_mention_count: 18,
  };
}

const fitSkills: Record<Exclude<RoleKey, "">, Array<[string, string, number, number, boolean?]>> = {
  software: [["python", "Python", 4, 1.4], ["fastapi", "API engineering", 4, 1.35], ["react", "React", 3, 1.1], ["pytest", "Automated testing", 3, 1.2], ["system-design", "System design", 0, 1.1]],
  "data-analyst": [["sql", "SQL", 4, 1.5], ["power-bi", "Power BI", 2, 1.3], ["python", "Python", 4, 1.05], ["stakeholder", "Stakeholder communication", 2, 1.1], ["statistics", "Statistics", 0, 1.1]],
  "data-engineer": [["sql", "SQL", 4, 1.5], ["python", "Python", 4, 1.45], ["postgresql", "PostgreSQL", 3, 1.2], ["docker", "Docker", 4, 1.0], ["airflow", "Airflow", 0, 1.25]],
  ai: [["python", "Python", 4, 1.35], ["fastapi", "API delivery", 4, 1.1], ["rag", "Retrieval-augmented generation", 2, 1.35], ["evaluation", "Model evaluation", 2, 1.25], ["mlops", "MLOps", 0, 1.2]],
  "cloud-devops": [["aws", "AWS", 3, 1.5], ["docker", "Docker", 4, 1.25], ["github-actions", "CI/CD", 3, 1.2], ["terraform", "Terraform", 1, 1.3], ["kubernetes", "Kubernetes", 0, 1.25]],
};

const fitScores: Record<Exclude<RoleKey, "">, [number, number, number]> = {
  software: [76, 78, 74],
  "data-analyst": [71, 72, 68],
  "data-engineer": [82, 84, 80],
  ai: [68, 70, 65],
  "cloud-devops": [64, 66, 61],
};

function fitFor(role: Exclude<RoleKey, "">): RoleFit {
  const [score, coverage, evidence_depth] = fitScores[role];
  return {
    role_family: role,
    score,
    coverage,
    evidence_depth,
    cap_applied: false,
    contributions: fitSkills[role].map(([slug, name, level, weight, required]) => contribution(slug, name, level, weight, required)),
    benchmark_sources: [
      { name: "O*NET skills reference", url: "https://www.onetonline.org/skills/" },
      { name: "SFIA 9", url: "https://sfia-online.org/en/sfia-9" },
    ],
    benchmark_methodology: "Reviewed evidence is compared with an occupational prior and the current indexed NZ sample.",
    market_posting_count: 31,
  };
}

const market: MarketSummary = {
  posting_count: 126,
  source_count: 3,
  latest_retrieved_at: now,
  roles: [
    { role_family: "software", count: 38 }, { role_family: "data-analyst", count: 24 },
    { role_family: "data-engineer", count: 31 }, { role_family: "ai", count: 12 },
    { role_family: "cloud-devops", count: 21 },
  ],
  seniority: [{ seniority: "Graduate / Junior", count: 44 }, { seniority: "Intermediate", count: 51 }, { seniority: "Senior", count: 31 }],
  role_seniority: [{ role_family: "data-engineer", seniority: "Graduate / Junior", count: 11 }],
  top_skills: [
    { skill_slug: "sql", skill_name: "SQL", count: 64 }, { skill_slug: "python", skill_name: "Python", count: 58 },
    { skill_slug: "aws", skill_name: "AWS", count: 47 }, { skill_slug: "docker", skill_name: "Docker", count: 39 },
    { skill_slug: "react", skill_name: "React", count: 34 },
  ],
  role_skills: [
    { role_family: "data-engineer", skill_slug: "sql", skill_name: "SQL", count: 25 },
    { role_family: "data-engineer", skill_slug: "python", skill_name: "Python", count: 22 },
    { role_family: "data-engineer", skill_slug: "aws", skill_name: "AWS", count: 17 },
  ],
  locations: [{ location: "Auckland", count: 59 }, { location: "Wellington", count: 39 }, { location: "Christchurch", count: 18 }, { location: "Remote / hybrid", count: 10 }],
  role_locations: [{ role_family: "data-engineer", location: "Auckland", count: 16 }, { role_family: "data-engineer", location: "Wellington", count: 9 }],
};

const quality: MarketQuality = {
  posting_count: 126, active_source_count: 3, latest_retrieved_at: now, graduate_junior_count: 44,
  normalised_location_count: 118, missing_publication_date_percent: 8.7, low_confidence_count: 4,
  stale_posting_count: 6, collector_completed_count: 3, collector_failed_count: 0,
  sample_warnings: ["This is a bounded demonstration dataset, not the entire NZ labour market."],
  sources: ["SEEK", "Trade Me Jobs", "Public employer careers"].map((name) => ({ name, adapter: "permitted-public-sample", enabled: true, latest_status: "completed", last_run_at: now, next_run_at: null, refresh_interval_minutes: 1440, accepted_count: 42, rejected_count: 3 })),
};

const analysisOne: DecodedRole = {
  analysis_id: "demo-analysis-one", role_family: "data-engineer", role_label: "Junior Data Engineer", confidence: 91,
  seniority: "Graduate / Junior", scope_status: "matched", taxonomy_coverage: 0.92,
  matched_skills: [{ slug: "sql", name: "SQL", mention_count: 4 }, { slug: "python", name: "Python", mention_count: 3 }, { slug: "aws", name: "AWS", mention_count: 2 }],
  skill_demands: [
    { slug: "sql", name: "SQL", required: true, importance: "essential", role_families: ["data-engineer"], mention_count: 4, demand_score: 91, explicit_mention: 1, repetition_signal: 0.9, requirement_signal: 0.9, title_signal: 0.2, evidence_level: 4, evidence_score: 88, evidence_confidence: 0.96, source_count: 2, source_type_count: 2, evidence_base_score: 80, confidence_adjustment: 4, corroboration_bonus: 2, diversity_bonus: 2 },
    { slug: "python", name: "Python", required: true, importance: "essential", role_families: ["data-engineer"], mention_count: 3, demand_score: 84, explicit_mention: 1, repetition_signal: 0.75, requirement_signal: 0.85, title_signal: 0, evidence_level: 4, evidence_score: 86, evidence_confidence: 0.94, source_count: 2, source_type_count: 2, evidence_base_score: 79, confidence_adjustment: 4, corroboration_bonus: 2, diversity_bonus: 1 },
    { slug: "aws", name: "AWS", required: false, importance: "named", role_families: ["data-engineer", "cloud-devops"], mention_count: 2, demand_score: 66, explicit_mention: 1, repetition_signal: 0.45, requirement_signal: 0.4, title_signal: 0, evidence_level: 3, evidence_score: 71, evidence_confidence: 0.91, source_count: 1, source_type_count: 1, evidence_base_score: 65, confidence_adjustment: 4, corroboration_bonus: 1, diversity_bonus: 1 },
    { slug: "airflow", name: "Airflow", required: false, importance: "supporting", role_families: ["data-engineer"], mention_count: 1, demand_score: 48, explicit_mention: 1, repetition_signal: 0.2, requirement_signal: 0.3, title_signal: 0, evidence_level: 0, evidence_score: 0, evidence_confidence: 0, source_count: 0, source_type_count: 0, evidence_base_score: 0, confidence_adjustment: 0, corroboration_bonus: 0, diversity_bonus: 0 },
  ],
  role_matches: [{ role_family: "data-engineer", role_label: "Data Engineer / Analytics Engineer", match_score: 91 }, { role_family: "cloud-devops", role_label: "Cloud / DevOps Engineer", match_score: 48 }],
  unmapped_skills: [], eligibility_requirements: [{ category: "work-rights", label: "New Zealand work rights", importance: "required", excerpt: "Applicants must already have the right to work in New Zealand." }],
};

const analysisTwo: DecodedRole = {
  ...analysisOne,
  analysis_id: "demo-analysis-two",
  role_family: "cloud-devops",
  role_label: "Graduate Cloud Engineer",
  confidence: 87,
  matched_skills: [{ slug: "aws", name: "AWS", mention_count: 4 }, { slug: "docker", name: "Docker", mention_count: 3 }, { slug: "terraform", name: "Terraform", mention_count: 2 }],
  skill_demands: fitSkills["cloud-devops"].map(([slug, name, level], index) => ({
    slug, name, required: index < 4, importance: index < 2 ? "essential" as const : index < 4 ? "named" as const : "supporting" as const,
    role_families: ["cloud-devops"], mention_count: Math.max(1, 4 - index), demand_score: 86 - index * 9,
    explicit_mention: 1, repetition_signal: Math.max(0.1, 0.8 - index * 0.12), requirement_signal: index < 4 ? 0.8 : 0.2,
    title_signal: index === 0 ? 0.3 : 0, evidence_level: level, evidence_score: level * 19, evidence_confidence: level ? 0.9 : 0,
    source_count: level ? 1 : 0, source_type_count: level ? 1 : 0, evidence_base_score: level * 17,
    confidence_adjustment: level ? 3 : 0, corroboration_bonus: level ? 1 : 0, diversity_bonus: level ? 1 : 0,
  })),
  role_matches: [{ role_family: "cloud-devops", role_label: "Cloud / DevOps Engineer", match_score: 87 }, { role_family: "data-engineer", role_label: "Data Engineer / Analytics Engineer", match_score: 54 }],
  eligibility_requirements: [],
};

const initialJobs: SavedJob[] = [
  {
    id: "demo-job-one", analysis_id: "demo-analysis-one", source_url: "https://www.seek.co.nz/job/example-data",
    title: "Junior Data Engineer", company: "Harbour Analytics", location: "Auckland", role_family: "data-engineer",
    description: "Build reliable SQL and Python pipelines on AWS, supported by data-quality testing.", status: "preparing",
    notes: "Ask about mentoring and the first 90-day delivery expectations.", evidenced_skill_count: 3, skill_count: 4,
    top_gaps: ["Airflow"], comparison_facts: [{ label: "Working model", value: "Hybrid, 3 days in office", source: "advert" }, { label: "Experience", value: "Graduate to 2 years", source: "advert" }, { label: "Work rights", value: "NZ work rights required", source: "advert" }], comparison_warning: null,
    created_at: "2026-10-07T08:00:00Z", updated_at: now,
  },
  {
    id: "demo-job-two", analysis_id: "demo-analysis-two", source_url: "https://www.seek.co.nz/job/example-cloud",
    title: "Graduate Cloud Engineer", company: "Koru Platforms", location: "Wellington", role_family: "cloud-devops",
    description: "Support AWS environments, Docker delivery and Terraform-managed infrastructure.", status: "saved",
    notes: null, evidenced_skill_count: 3, skill_count: 5, top_gaps: ["Kubernetes", "Terraform depth"],
    comparison_facts: [{ label: "Working model", value: "Flexible hybrid", source: "advert" }, { label: "Experience", value: "Graduate programme", source: "advert" }, { label: "Work rights", value: "Not stated", source: "advert" }], comparison_warning: null,
    created_at: "2026-10-08T08:00:00Z", updated_at: now,
  },
];

const githubProjects: GithubProject[] = [{
  id: "demo-github-project", canonical_url: "https://github.com/example/nz-data-platform", repository: "example/nz-data-platform", status: "confirmed",
  suggestions: evidence.filter((item) => item.source_type === "github").slice(0, 6).map((item, index) => ({ id: `demo-suggestion-${index}`, canonical_skill: item.skill_name, category: item.category, excerpt: item.excerpt, locator: item.locator, confidence: item.confidence, proposed_level: item.evidence_level, review_status: "confirmed" })),
}];

let jobs = structuredClone(initialJobs);

export function resetDemoData() {
  jobs = structuredClone(initialJobs);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function requestBody(init?: RequestInit): Record<string, unknown> {
  if (typeof init?.body !== "string") return {};
  try { return JSON.parse(init.body) as Record<string, unknown>; } catch { return {}; }
}

export async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.origin);
  const path = url.pathname;
  const method = (init?.method ?? "GET").toUpperCase();

  if (path === "/api/v1/profile") return json(profile);
  if (path === "/api/v1/evidence/uploads" && method === "GET") return json([upload]);
  if (path === "/api/v1/evidence/github/projects") return json(githubProjects);
  if (path === "/api/v1/evidence/graph") return json({ role_family: url.searchParams.get("role_family") ?? profile.role_family, evidence });
  if (path === "/api/v1/evidence/fit") return json(fitFor((url.searchParams.get("role_family") || profile.role_family) as Exclude<RoleKey, "">));
  if (path === "/api/v1/market/summary") return json(market);
  if (path === "/api/v1/market/quality") return json(quality);
  if (path === "/api/v1/jobs" && method === "GET") return json(jobs);
  if (path === "/api/v1/role-decoder/history" && method === "GET") return json([
    { id: "demo-analysis-one", title: "Junior Data Engineer", role_family: "data-engineer", scope_status: "matched", confidence: 91, created_at: "2026-10-07T08:00:00Z" },
    { id: "demo-analysis-two", title: "Graduate Cloud Engineer", role_family: "cloud-devops", scope_status: "matched", confidence: 87, created_at: "2026-10-08T08:00:00Z" },
  ]);
  if (path === "/api/v1/role-decoder" && method === "POST") return json(analysisOne);
  if (path === "/api/v1/rag/search" && method === "POST") return json({ results: [
    { citation_id: "demo-citation-one", title: "Junior Data Engineer", company: "Harbour Analytics", location: "Auckland", source_url: initialJobs[0].source_url, published_at: "2026-10-05", excerpt: "The role names SQL, Python, AWS and data-quality testing as core delivery capabilities.", retrieval_score: 0.92 },
    { citation_id: "demo-citation-two", title: "Graduate Cloud Engineer", company: "Koru Platforms", location: "Wellington", source_url: initialJobs[1].source_url, published_at: "2026-10-06", excerpt: "The advert emphasises AWS, Docker, Terraform and collaborative incident response.", retrieval_score: 0.86 },
  ] });
  if (path === "/api/v1/rag/judgements/quality") return json({ labelled_count: 12, relevant_count: 10, relevance_rate: 0.83, relevant_mean_rank: 1.4 });
  if (path === "/api/v1/rag/judgements" && method === "POST") return json({ saved: true }, 201);
  if (path === "/api/v1/rag/explain" && method === "POST") return json({ answer: "Across this bounded sample, SQL and Python are the strongest recurring data-engineering requirements, while AWS and delivery automation distinguish the adjacent cloud pathway.", model: "grounded-demo-summary" });
  if (path === "/api/v1/account/export") return json({ account: demoUser, profile, evidence, jobs });

  const analysisMatch = path.match(/^\/api\/v1\/role-decoder\/history\/(.+)$/);
  if (analysisMatch) return json({ result: analysisMatch[1] === "demo-analysis-two" ? analysisTwo : analysisOne });
  const historyMatch = path.match(/^\/api\/v1\/jobs\/([^/]+)\/history$/);
  if (historyMatch) return json([{ id: `${historyMatch[1]}-event`, from_status: "saved", to_status: jobs.find((job) => job.id === historyMatch[1])?.status ?? "saved", changed_at: now }]);
  const jobMatch = path.match(/^\/api\/v1\/jobs\/([^/]+)$/);
  if (jobMatch && method === "PATCH") {
    const index = jobs.findIndex((job) => job.id === jobMatch[1]);
    if (index < 0) return json({ detail: "Demo job not found" }, 404);
    const body = requestBody(init);
    jobs[index] = { ...jobs[index], ...body, updated_at: new Date().toISOString() } as SavedJob;
    return json(jobs[index]);
  }
  if (jobMatch && method === "DELETE") {
    jobs = jobs.filter((job) => job.id !== jobMatch[1]);
    return new Response(null, { status: 204 });
  }
  if (/^\/api\/v1\/jobs\/[^/]+\/analysis$/.test(path) && method === "POST") return json(jobs.find((job) => path.includes(job.id)) ?? jobs[0]);
  if (/^\/api\/v1\/jobs\/from-analysis\//.test(path) && method === "POST") return json(jobs[0], 201);

  if ((path === "/api/v1/account" && method === "DELETE") || (path === "/api/v1/evidence/uploads" && method === "POST")) {
    return json({ detail: "This action is disabled in the demo workspace." }, 403);
  }
  return json({ detail: "This demo action is not available." }, 404);
}
