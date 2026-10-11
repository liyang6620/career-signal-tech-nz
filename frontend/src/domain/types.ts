export type Step = 1 | 2 | 3;
export type RoleKey = "" | "software" | "data-analyst" | "data-engineer" | "ai" | "cloud-devops";
export type EvidenceRoleFilter = "all" | Exclude<RoleKey, "">;
export type PwaInstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type SessionUser = { id: string; email: string; display_name: string; is_verified: boolean };
export type EvidenceSuggestion = { id: string; canonical_skill: string; category: string; excerpt: string; locator: string; confidence: number; proposed_level: number; review_status: string };
export type GithubProject = { id: string; canonical_url?: string; repository: string; status: string; suggestions: EvidenceSuggestion[] };
export type GithubCandidate = { name: string; url: string; description: string | null; language: string | null; stars: number; updated_at: string | null };
export type FitContribution = { skill_slug: string; skill_name: string; weight: number; required: boolean; evidence_level: number; evidence_confidence: number; source_count: number; source_type_count: number; base_score: number; confidence_adjustment: number; specificity_bonus: number; verification_bonus: number; outcome_bonus: number; corroboration_bonus: number; diversity_bonus: number; score_factors: string[]; normalized_score: number; weighted_score: number; market_frequency: number; market_mention_count: number };
export type RoleFit = { role_family: string; score: number; coverage: number; evidence_depth: number; cap_applied: boolean; contributions: FitContribution[]; benchmark_sources?: { name: string; url: string }[]; benchmark_methodology?: string; market_posting_count?: number };
export type RoleFitMap = Partial<Record<Exclude<RoleKey, "">, RoleFit>>;
export type SkillEvidence = { skill_slug: string; skill_name: string; category: string; evidence_level: number; confidence: number; excerpt: string; locator: string; source_type: string };
export type ProfileData = { id: string; location: string; seniority: string; role_family: Exclude<RoleKey, "">; evidence_sources: { id: string; source_type: string; source_reference: string; processing_status: string }[]; updated_at: string };
export type UploadRecord = { id: string; original_filename: string; status: string; failure_reason?: string | null; cv_label?: string | null; target_role?: string | null; created_at: string };
export type SkillDemand = { slug: string; name: string; required: boolean; importance: "essential" | "named" | "supporting"; role_families: string[]; mention_count: number; demand_score: number; explicit_mention: number; repetition_signal: number; requirement_signal: number; title_signal: number; evidence_level: number; evidence_score: number; evidence_confidence: number; source_count: number; source_type_count: number; evidence_base_score: number; confidence_adjustment: number; specificity_bonus?: number; verification_bonus?: number; outcome_bonus?: number; corroboration_bonus: number; diversity_bonus: number; score_factors?: string[] };
export type RoleMatch = { role_family: Exclude<RoleKey, "">; role_label: string; match_score: number };
export type EligibilityRequirement = { category: string; label: string; importance: "required" | "stated" | "preferred"; excerpt: string };
export type DecodedRole = { analysis_id?: string | null; role_family: Exclude<RoleKey, "">; role_label: string; confidence: number; seniority: string; scope_status: "matched" | "mixed" | "adjacent" | "out_of_scope"; taxonomy_coverage: number; matched_skills: { slug: string; name: string; mention_count: number }[]; skill_demands: SkillDemand[]; role_matches: RoleMatch[]; unmapped_skills: string[]; eligibility_requirements: EligibilityRequirement[] };
export type ProductView = "workspace" | "market" | "decoder" | "evidence" | "path" | "graph" | "route" | "jobs" | "settings";
export type EvidenceResult = { citation_id: string; title: string; company: string; location: string; source_url: string; published_at: string | null; excerpt: string; retrieval_score: number };
export type SavedJob = { id: string; analysis_id: string | null; source_url: string; title: string; company: string; location: string; role_family: string | null; description: string | null; status: "saved" | "preparing" | "applied" | "interview" | "offer" | "rejected" | "archived"; notes: string | null; evidenced_skill_count: number; skill_count: number; top_gaps: string[]; comparison_facts: { label: string; value: string; source: string }[]; comparison_warning: string | null; created_at: string; updated_at: string };
export type JobStatusEvent = { id: string; from_status: SavedJob["status"] | null; to_status: SavedJob["status"]; changed_at: string };
export type MarketSummary = {
  posting_count: number;
  source_count: number;
  latest_retrieved_at: string | null;
  roles: { role_family: string; count: number }[];
  seniority: { seniority: string; count: number }[];
  role_seniority: { role_family: string; seniority: string; count: number }[];
  top_skills: { skill_slug: string; skill_name: string; count: number }[];
  role_skills: { role_family: string; skill_slug: string; skill_name: string; count: number }[];
  locations: { location: string; count: number }[];
  role_locations: { role_family: string; location: string; count: number }[];
};
export type MarketQuality = { posting_count: number; active_source_count: number; latest_retrieved_at: string | null; graduate_junior_count: number; normalised_location_count: number; missing_publication_date_percent: number; low_confidence_count: number; stale_posting_count: number; collector_completed_count: number; collector_failed_count: number; sample_warnings: string[]; sources: { name: string; adapter: string; enabled: boolean; latest_status: string | null; last_run_at: string | null; next_run_at: string | null; refresh_interval_minutes: number; accepted_count: number; rejected_count: number }[] };
export type JobAnalysisSummary = { id: string; title: string; role_family: string; scope_status: string; confidence: number; created_at: string };
export type AnalysisDetailsMap = Record<string, DecodedRole | null>;

export const roles: Record<Exclude<RoleKey, "">, string> = {
  software: "Software Engineer",
  "data-analyst": "Data & BI Analyst",
  "data-engineer": "Data Engineer / Analytics Engineer",
  ai: "AI Application Engineer",
  "cloud-devops": "Cloud / DevOps Engineer",
};

export const productRoutes: Record<ProductView, string> = {
  workspace: "/app/workspace",
  market: "/app/market",
  decoder: "/app/roles/decode",
  evidence: "/app/evidence",
  path: "/app/pathways",
  graph: "/app/profile",
  route: "/app/plan",
  jobs: "/app/jobs",
  settings: "/app/settings",
};

export const routeViews = Object.fromEntries(
  Object.entries(productRoutes).map(([view, path]) => [path, view]),
) as Record<string, ProductView>;

export const routeTitles: Record<ProductView, string> = {
  workspace: "Workspace",
  market: "Market intelligence",
  decoder: "Role intelligence",
  evidence: "Evidence intelligence",
  path: "Career planning",
  graph: "Capability profile",
  route: "Capability profile",
  jobs: "Application tracker",
  settings: "Account settings",
};
