import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BarChart3,
  Bookmark,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  CircleGauge,
  ClipboardList,
  CloudCog,
  Code2,
  Compass,
  Database,
  Download,
  FileText,
  FileCheck2,
  GitBranch,
  GraduationCap,
  LayoutDashboard,
  Layers3,
  Link2,
  ListChecks,
  History,
  LogOut,
  MapPin,
  Network,
  Plus,
  Route,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Target,
  TrendingUp,
  Trash2,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import "./App.css";

type Step = 1 | 2 | 3;
type RoleKey = "" | "software" | "data-analyst" | "data-engineer" | "ai" | "cloud-devops";

const roles: Record<Exclude<RoleKey, "">, string> = {
  software: "Software Engineer",
  "data-analyst": "Data & BI Analyst",
  "data-engineer": "Data Engineer / Analytics Engineer",
  ai: "AI Application Engineer",
  "cloud-devops": "Cloud / DevOps Engineer",
};

function RoleFamilyIcon({ roleKey, size = 18 }: { roleKey: Exclude<RoleKey, "">; size?: number }) {
  const props = { size, strokeWidth: 1.8, "aria-hidden": true as const };
  if (roleKey === "software") return <Code2 {...props} />;
  if (roleKey === "data-analyst") return <BarChart3 {...props} />;
  if (roleKey === "data-engineer") return <Database {...props} />;
  if (roleKey === "ai") return <BrainCircuit {...props} />;
  return <CloudCog {...props} />;
}

function CareerSignalMark({ size = 40 }: { size?: number }) {
  return <svg className="career-signal-mark" width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="CareerSignal mark" focusable="false">
    <rect x="1.5" y="1.5" width="37" height="37" rx="9" fill="#173a55" />
    <path d="M9.5 27.5c3.6-7.7 8.3-12.8 13.3-11.5 4.7 1.2 5.1 7.1 8.2-3.7" fill="none" stroke="#dcb86c" strokeWidth="2.3" strokeLinecap="round" />
    <path d="M10 29.3c6.2-2.9 13-3.8 20.2-2.1" fill="none" stroke="#8fc8be" strokeWidth="1.25" strokeLinecap="round" opacity=".9" />
    <circle cx="9.8" cy="27.5" r="3" fill="#f8fbfa" />
    <circle cx="22.7" cy="16.1" r="3" fill="#8fc8be" />
    <circle cx="31" cy="12.3" r="3" fill="#dcb86c" />
  </svg>;
}

// Docker development maps the API to 8001 by default (see API_HOST_PORT in .env).
// Deployments can still override this with VITE_API_URL at build time.
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8001";
const normalizeSourceUrl = (value: string) => value.trim().replace(/\/+$/, "");
function expandGithubSources(values: string[]) {
  return values.flatMap((value) => value.split(",")).map((value) => {
    try { return decodeURIComponent(value).trim(); } catch { return value.trim(); }
  }).filter(Boolean);
}
function apiError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object" || !("detail" in payload)) return fallback;
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((item) => typeof item === "object" && item && "msg" in item ? String(item.msg) : String(item)).join("; ");
  return fallback;
}
async function apiPayload(response: Response): Promise<unknown> {
  const body = await response.text();
  if (!body) return null;
  try { return JSON.parse(body); } catch { return { detail: response.ok ? undefined : body }; }
}
type SessionUser = { id: string; email: string; display_name: string; is_verified: boolean };
type EvidenceSuggestion = { id: string; canonical_skill: string; category: string; excerpt: string; locator: string; confidence: number; proposed_level: number; review_status: string };
type GithubProject = { id: string; repository: string; status: string; suggestions: EvidenceSuggestion[] };
type GithubCandidate = { name: string; url: string; description: string | null; language: string | null; stars: number; updated_at: string | null };
type FitContribution = { skill_slug: string; skill_name: string; weight: number; required: boolean; evidence_level: number; evidence_confidence: number; source_count: number; source_type_count: number; base_score: number; confidence_adjustment: number; specificity_bonus: number; verification_bonus: number; outcome_bonus: number; corroboration_bonus: number; diversity_bonus: number; score_factors: string[]; normalized_score: number; weighted_score: number; market_frequency: number; market_mention_count: number };
type RoleFit = { role_family: string; score: number; coverage: number; evidence_depth: number; cap_applied: boolean; contributions: FitContribution[]; benchmark_sources?: { name: string; url: string }[]; benchmark_methodology?: string; market_posting_count?: number };
type RoleFitMap = Partial<Record<Exclude<RoleKey, "">, RoleFit>>;
type SkillEvidence = { skill_slug: string; skill_name: string; category: string; evidence_level: number; confidence: number; excerpt: string; locator: string; source_type: string };
type ProfileData = { id: string; location: string; seniority: string; role_family: Exclude<RoleKey, "">; evidence_sources: { id: string; source_type: string; source_reference: string; processing_status: string }[]; updated_at: string };
type UploadRecord = { id: string; original_filename: string; status: string; failure_reason?: string | null; cv_label?: string | null; target_role?: string | null; created_at: string };
type SkillDemand = { slug: string; name: string; required: boolean; importance: "essential" | "named" | "supporting"; role_families: string[]; mention_count: number; demand_score: number; explicit_mention: number; repetition_signal: number; requirement_signal: number; title_signal: number; evidence_level: number; evidence_score: number; evidence_confidence: number; source_count: number; source_type_count: number; evidence_base_score: number; confidence_adjustment: number; specificity_bonus?: number; verification_bonus?: number; outcome_bonus?: number; corroboration_bonus: number; diversity_bonus: number; score_factors?: string[] };
type RoleMatch = { role_family: Exclude<RoleKey, "">; role_label: string; match_score: number };
type EligibilityRequirement = { category: string; label: string; importance: "required" | "stated" | "preferred"; excerpt: string };
type DecodedRole = { analysis_id?: string | null; role_family: Exclude<RoleKey, "">; role_label: string; confidence: number; seniority: string; scope_status: "matched" | "mixed" | "adjacent" | "out_of_scope"; taxonomy_coverage: number; matched_skills: { slug: string; name: string; mention_count: number }[]; skill_demands: SkillDemand[]; role_matches: RoleMatch[]; unmapped_skills: string[]; eligibility_requirements: EligibilityRequirement[] };
type ProductView = "workspace" | "market" | "decoder" | "evidence" | "path" | "graph" | "route" | "jobs" | "settings";
type EvidenceResult = { citation_id: string; title: string; company: string; location: string; source_url: string; published_at: string | null; excerpt: string; retrieval_score: number };
type JobStatusEvent = { id: string; from_status: SavedJob["status"] | null; to_status: SavedJob["status"]; changed_at: string };
type MarketSummary = {
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
type MarketQuality = { posting_count: number; active_source_count: number; latest_retrieved_at: string | null; graduate_junior_count: number; normalised_location_count: number; missing_publication_date_percent: number; low_confidence_count: number; stale_posting_count: number; collector_completed_count: number; collector_failed_count: number; sample_warnings: string[]; sources: { name: string; adapter: string; enabled: boolean; latest_status: string | null; last_run_at: string | null; next_run_at: string | null; refresh_interval_minutes: number; accepted_count: number; rejected_count: number }[] };
type SavedJob = { id: string; analysis_id: string | null; source_url: string; title: string; company: string; location: string; role_family: string | null; description: string | null; status: "saved" | "preparing" | "applied" | "interview" | "offer" | "rejected" | "archived"; notes: string | null; evidenced_skill_count: number; skill_count: number; top_gaps: string[]; created_at: string; updated_at: string };
type JobAnalysisSummary = { id: string; title: string; role_family: string; scope_status: string; confidence: number; created_at: string };
type AnalysisDetailsMap = Record<string, DecodedRole | null>;

const productRoutes: Record<ProductView, string> = {
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
const routeViews = Object.fromEntries(Object.entries(productRoutes).map(([view, path]) => [path, view])) as Record<string, ProductView>;
const routeTitles: Record<ProductView, string> = {
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

const evidenceLabels = ["Not evidenced", "Claimed", "Used", "Implemented", "Verified", "Professional"];
const evidenceLabel = (level: number) => evidenceLabels[Math.max(0, Math.min(5, Math.round(level)))] ?? evidenceLabels[0];
const scopeMessage = (status: DecodedRole["scope_status"]) => {
  if (status === "mixed") return "This advertisement spans multiple technical disciplines. The analysis therefore compares the closest relevant role families.";
  if (status === "out_of_scope") return "This role does not appear to be a technology position within the fields currently covered by CareerSignal.";
  if (status === "adjacent") return "This position partially aligns with the closest role family. The analysis below prioritises the requirements stated in the advertisement.";
  return "Some requirements are not yet represented in CareerSignal's role-family framework. They remain visible below as advertisement-specific capabilities.";
};
const evidencePreview = (value: string) => {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 260 ? `${compact.slice(0, 257)}…` : compact;
};

// Evidence can arrive from more than one source. Keep one capability row and
// retain the strongest signal plus a compact list of supporting sources.
function dedupeSkillEvidence(items: SkillEvidence[]): SkillEvidence[] {
  const merged = new Map<string, SkillEvidence>();
  for (const item of items) {
    const key = (item.skill_slug || item.skill_name).trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-");
    const current = merged.get(key);
    if (!current) {
      merged.set(key, { ...item });
      continue;
    }
    const currentStrength = [current.evidence_level, current.confidence];
    const nextStrength = [item.evidence_level, item.confidence];
    const representative = nextStrength[0] > currentStrength[0]
      || (nextStrength[0] === currentStrength[0] && nextStrength[1] > currentStrength[1])
      ? item
      : current;
    const sources = new Set(
      `${current.source_type} + ${item.source_type}`
        .split("+")
        .map((source) => source.trim())
        .filter(Boolean),
    );
    merged.set(key, {
      ...representative,
      evidence_level: Math.max(current.evidence_level, item.evidence_level),
      confidence: Math.max(current.confidence, item.confidence),
      source_type: [...sources].sort().join(" + "),
    });
  }
  return [...merged.values()].sort((left, right) => (
    right.evidence_level - left.evidence_level
    || right.confidence - left.confidence
    || left.skill_name.localeCompare(right.skill_name)
  ));
}

function PersonalEvidenceGraph({ evidence }: { evidence: SkillEvidence[] }) {
  const items = dedupeSkillEvidence(evidence).slice(0, 10);
  const cx = 260; const cy = 188; const orbit = 132;
  const uniqueEvidence = dedupeSkillEvidence(evidence);
  const labelSlots = [
    { x: 385, y: 28, width: 170 }, { x: 385, y: 94, width: 170 }, { x: 385, y: 160, width: 170 }, { x: 385, y: 226, width: 170 }, { x: 385, y: 292, width: 170 },
    { x: 5, y: 28, width: 170 }, { x: 5, y: 94, width: 170 }, { x: 5, y: 160, width: 170 }, { x: 5, y: 226, width: 170 }, { x: 5, y: 292, width: 170 },
  ];
  const shortName = (value: string) => value.length > 18 ? `${value.slice(0, 17)}…` : value;
  return <div className="personal-graph-layout"><svg className="personal-evidence-graph" viewBox="0 0 580 380" role="img" aria-label="Personal evidence skill network"><circle cx={cx} cy={cy} r={orbit} className="personal-graph-orbit" />{items.map((item, index) => { const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(items.length, 1); const x = cx + Math.cos(angle) * orbit; const y = cy + Math.sin(angle) * orbit; return <line key={`link-${item.skill_slug}`} x1={cx} y1={cy} x2={x} y2={y} className="personal-graph-link" />; })}{items.map((item, index) => { const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(items.length, 1); const x = cx + Math.cos(angle) * orbit; const y = cy + Math.sin(angle) * orbit; const slot = labelSlots[index]; const labelOnRight = slot.x > cx; const lineEnd = labelOnRight ? slot.x : slot.x + slot.width; const radius = 10 + Math.max(0, Math.min(7, item.evidence_level)); return <g key={item.skill_slug}><line x1={x} y1={y} x2={lineEnd} y2={slot.y + 13} className="personal-graph-callout-line" /><circle cx={x} cy={y} r={radius} className="personal-graph-node"><title>{item.skill_name}: {evidenceLabel(item.evidence_level)} evidence</title></circle><text x={x} y={y + 4} className="personal-graph-node-index" textAnchor="middle">{index + 1}</text><rect x={slot.x} y={slot.y} width={slot.width} height="26" rx="4" className="personal-graph-callout-box" /><text x={slot.x + 9} y={slot.y + 17} className="personal-graph-callout-text">{index + 1} {shortName(item.skill_name)}</text><title>{item.skill_name}</title></g>; })}<circle cx={cx} cy={cy} r="48" className="personal-graph-core" /><text x={cx} y={cy - 3} className="personal-graph-core-label" textAnchor="middle">MY EVIDENCE</text><text x={cx} y={cy + 15} className="personal-graph-core-count" textAnchor="middle">{uniqueEvidence.length} skills</text></svg><div className="personal-graph-register"><header><span>Confirmed capabilities</span><strong>{uniqueEvidence.length}</strong></header>{uniqueEvidence.slice(0, 10).map((item, index) => <div key={item.skill_slug}><span><b><em>{index + 1}</em>{item.skill_name}</b><small>{item.category} · {evidenceLabel(item.evidence_level)} · {item.source_type}</small></span><strong>{Math.round(item.confidence * 100)}%</strong></div>)}{uniqueEvidence.length > 10 && <small className="personal-graph-more">+ {uniqueEvidence.length - 10} more capabilities in this view</small>}</div></div>;
}

function PersonalEvidenceAnalytics({ evidence }: { evidence: SkillEvidence[] }) {
  const categoryMap = new Map<string, { count: number; total: number }>();
  evidence.forEach((item) => { const current = categoryMap.get(item.category) ?? { count: 0, total: 0 }; current.count += 1; current.total += item.evidence_level; categoryMap.set(item.category, current); });
  const categories = [...categoryMap.entries()].sort((left, right) => right[1].count - left[1].count);
  const maturity = [0, 1, 2, 3, 4, 5].map((level) => ({ level, count: evidence.filter((item) => item.evidence_level === level).length })).filter((item) => item.count > 0);
  const sources = [...new Set(evidence.map((item) => item.source_type))].map((source) => ({ source, count: evidence.filter((item) => item.source_type === source).length, skills: new Set(evidence.filter((item) => item.source_type === source).map((item) => item.skill_slug)).size }));
  const maxCategory = Math.max(...categories.map(([, item]) => item.count), 1);
  const maxMaturity = Math.max(...maturity.map((item) => item.count), 1);
  const formatLabel = (value: string) => value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const sourceLabel = (value: string) => value.toLowerCase() === "github" ? "GitHub" : value.toLowerCase() === "cv" ? "CV / resume" : formatLabel(value);
  return <section className="personal-analytics" aria-labelledby="personal-analytics-title"><header><div><span>Evidence analysis</span><h2 id="personal-analytics-title">What your evidence says beyond the skill list</h2><p>Counts describe the evidence record; they are not a claim of professional proficiency.</p></div><span className="analytics-total"><strong>{evidence.length}</strong> confirmed skills</span></header><div className="analytics-grid"><article><div className="analytics-card-heading"><span>01</span><h3>Capability domains</h3></div><p>Where your current evidence is concentrated.</p><div className="analytics-bars">{categories.map(([category, item]) => <div className="analytics-bar-row" key={category}><span>{formatLabel(category)}<small>avg level {item.count ? (item.total / item.count).toFixed(1) : "0.0"} / 5</small></span><i><u style={{ width: `${Math.max(5, (item.count / maxCategory) * 100)}%` }} /></i><b>{item.count}</b></div>)}</div></article><article><div className="analytics-card-heading"><span>02</span><h3>Evidence maturity</h3></div><p>How far each capability moves from a claim to proof.</p><div className="analytics-bars maturity-bars">{maturity.map((item) => <div className="analytics-bar-row" key={item.level}><span>{item.level}<small>{evidenceLabel(item.level)}</small></span><i><u style={{ width: `${Math.max(5, (item.count / maxMaturity) * 100)}%` }} /></i><b>{item.count}</b></div>)}</div></article><article><div className="analytics-card-heading"><span>03</span><h3>Source triangulation</h3></div><p>Independent sources make a capability easier to inspect.</p><div className="analytics-source-list">{sources.map((item) => <div key={item.source}><span><b>{sourceLabel(item.source)}</b><small>{item.skills} distinct skills</small></span><strong>{item.count}</strong></div>)}{sources.length === 0 && <span className="analytics-empty">Add a CV or project source to start triangulating evidence.</span>}</div></article></div><footer><ShieldCheck size={15} /><span><strong>Interpretation rule.</strong> Capability strength increases when implementation, validation, outcomes and more than one evidence source support the same skill.</span></footer></section>;
}

function PersonalEvidenceVisuals({ evidence }: { evidence: SkillEvidence[] }) {
  const categories = [...new Set(evidence.map((item) => item.category))].sort((left, right) => left.localeCompare(right));
  const sources = [...new Set(evidence.map((item) => item.source_type))].sort((left, right) => left.localeCompare(right));
  const formatLabel = (value: string) => value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const sourceLabel = (value: string) => value.toLowerCase() === "github" ? "GitHub" : value.toLowerCase() === "cv" ? "CV" : formatLabel(value);
  const categoryAverage = categories.map((category) => {
    const items = evidence.filter((item) => item.category === category);
    return { category, average: items.reduce((total, item) => total + item.evidence_level, 0) / Math.max(items.length, 1), count: items.length };
  }).sort((left, right) => right.average - left.average);
  const shortName = (value: string) => value.length > 12 ? `${value.slice(0, 11)}…` : value;
  const domainTone = (index: number) => ["#0e716a", "#c2785c", "#bd9449", "#53636d", "#6e7f73"][index % 5];
  return <section className="personal-visuals" aria-labelledby="personal-visuals-title"><header><div><span>Portfolio diagnostics</span><h2 id="personal-visuals-title">Three views of evidence quality</h2><p>These visuals combine maturity, confidence and source coverage so a large skill list can be interpreted as a portfolio rather than a keyword count.</p></div><small>Evidence maturity scale: 0 not evidenced · 5 professional</small></header><div className="analytics-visual-grid"><article className="analytics-visual-card"><div className="analytics-card-heading"><span>04</span><h3>Maturity × confidence</h3></div><p>Capabilities in the upper-right are the most defensible signals: implemented work with strong source confidence.</p><svg className="evidence-scatter" viewBox="0 0 440 235" role="img" aria-label="Evidence maturity and confidence scatter plot"><line x1="46" y1="193" x2="415" y2="193" className="visual-axis" /><line x1="46" y1="32" x2="46" y2="193" className="visual-axis" />{[0,1,2,3,4,5].map((level) => <g key={level}><line x1={46 + level * 73.8} y1="32" x2={46 + level * 73.8} y2="193" className="visual-grid" /><text x={46 + level * 73.8} y="212" className="visual-tick" textAnchor="middle">{level}</text></g>)}{[0,.25,.5,.75,1].map((confidence) => <g key={confidence}><line x1="46" y1={193 - confidence * 161} x2="415" y2={193 - confidence * 161} className="visual-grid" /><text x="36" y={197 - confidence * 161} className="visual-tick" textAnchor="end">{Math.round(confidence * 100)}</text></g>)}{evidence.map((item, index) => { const x = 46 + Math.max(0, Math.min(5, item.evidence_level)) * 73.8; const y = 193 - Math.max(0, Math.min(1, item.confidence)) * 161; return <circle key={item.skill_slug} cx={x} cy={y} r={Math.max(4, Math.min(8, 4 + item.evidence_level * .7))} fill={domainTone(index)} className="visual-point"><title>{item.skill_name}: maturity {item.evidence_level}/5, confidence {Math.round(item.confidence * 100)}%</title></circle>; })}<text x="230" y="232" className="visual-axis-label" textAnchor="middle">Evidence maturity</text><text x="12" y="113" className="visual-axis-label" transform="rotate(-90 12 113)" textAnchor="middle">Confidence %</text></svg></article><article className="analytics-visual-card"><div className="analytics-card-heading"><span>05</span><h3>Domain strength profile</h3></div><p>Average evidence level by domain, with the number of capabilities contributing to each estimate.</p><svg className="domain-profile-chart" viewBox="0 0 440 235" role="img" aria-label="Average evidence level by capability domain"><line x1="132" y1="25" x2="132" y2="205" className="visual-axis" />{[0,1,2,3,4,5].map((level) => <g key={level}><line x1={132 + level * 56} y1="25" x2={132 + level * 56} y2="205" className="visual-grid" /><text x={132 + level * 56} y="220" className="visual-tick" textAnchor="middle">{level}</text></g>)}{categoryAverage.slice(0, 6).map((item, index) => { const y = 46 + index * 27; return <g key={item.category}><text x="122" y={y + 4} className="domain-chart-label" textAnchor="end">{shortName(formatLabel(item.category))}</text><line x1="132" y1={y} x2={132 + item.average * 56} y2={y} className="domain-chart-line" style={{ stroke: domainTone(index) }} /><circle cx={132 + item.average * 56} cy={y} r="5" className="domain-chart-dot" style={{ fill: domainTone(index) }} /><text x={146 + item.average * 56} y={y + 4} className="domain-chart-value">{item.average.toFixed(1)} · {item.count}</text></g>; })}<text x="276" y="233" className="visual-axis-label" textAnchor="middle">Average maturity (0–5) · dot = skills</text></svg></article><article className="analytics-visual-card source-matrix-card"><div className="analytics-card-heading"><span>06</span><h3>Source coverage matrix</h3></div><p>Triangulation is strongest where a domain is visible in more than one independent source.</p><div className="source-matrix-wrap"><table className="source-matrix"><thead><tr><th>Domain</th>{sources.map((source) => <th key={source}>{sourceLabel(source)}</th>)}</tr></thead><tbody>{categories.slice(0, 7).map((category) => <tr key={category}><th>{formatLabel(category)}</th>{sources.map((source) => { const count = evidence.filter((item) => item.category === category && item.source_type === source).length; return <td className={count ? "has-signal" : ""} key={source} title={`${count} ${sourceLabel(source)} evidence item${count === 1 ? "" : "s"}`}>{count || "–"}</td>; })}</tr>)}</tbody></table></div></article></div><footer className="visuals-footnote"><ShieldCheck size={15} /><span><strong>Interpretation.</strong> Maturity describes the level of work evidenced, confidence describes extraction certainty, and source coverage describes how easy the claim is to verify. None of these is a promise of hiring outcome.</span></footer></section>;
}

function CapabilityMethodology() {
  return <section className="capability-methodology" aria-labelledby="capability-methodology-title"><header><div><span>Methodology references</span><h2 id="capability-methodology-title">Why this profile is evidence-led</h2></div><small>Published research and occupational frameworks used as design constraints</small></header><div className="methodology-grid"><article><span>01</span><h3>Competency, not keyword count</h3><p>Competency models work best when capabilities are defined, organised and used consistently. A named skill is therefore separated from work that can be inspected.</p><a href="https://doi.org/10.1111/j.1744-6570.2010.01207.x" target="_blank" rel="noreferrer">Campion et al. · competency modelling <ArrowRight size={13} /></a><a href="https://www.naceweb.org/career-readiness/competencies/career-readiness-defined/" target="_blank" rel="noreferrer">NACE career readiness framework <ArrowRight size={13} /></a></article><article><span>02</span><h3>Fit is a comparison, not a label</h3><p>Person–job fit research treats fit as the relationship between a person and a job's demands. The alignment score therefore compares evidence with a role benchmark rather than declaring a fixed identity.</p><a href="https://doi.org/10.1111/j.1744-6570.2005.00672.x" target="_blank" rel="noreferrer">Kristof-Brown et al. · person–job fit meta-analysis <ArrowRight size={13} /></a><a href="https://doi.org/10.1093/oso/9780195100143.003.0007" target="_blank" rel="noreferrer">DeFillippi &amp; Arthur · career competencies <ArrowRight size={13} /></a></article><article><span>03</span><h3>Skills inferred from labour demand</h3><p>Job-posting research shows that repeated skill requirements reveal differences across firms and labour markets. Role benchmarks combine occupational taxonomies with indexed NZ postings.</p><a href="https://doi.org/10.1086/694106" target="_blank" rel="noreferrer">Deming &amp; Kahn · job-posting skill signals <ArrowRight size={13} /></a><a href="https://www.onetonline.org/skills/" target="_blank" rel="noreferrer">O*NET skills reference <ArrowRight size={13} /></a></article><article><span>04</span><h3>Adaptability and local context</h3><p>Career adaptability research supports comparing a current evidence base with adjacent directions, while Tāhatu keeps the interpretation grounded in New Zealand occupations and pathways.</p><a href="https://doi.org/10.1016/j.jvb.2012.01.010" target="_blank" rel="noreferrer">Savickas &amp; Porfeli · career adaptability <ArrowRight size={13} /></a><a href="https://tahatu.govt.nz/" target="_blank" rel="noreferrer">Tāhatu career information <ArrowRight size={13} /></a></article><article><span>05</span><h3>Transferable skills vocabulary</h3><p>O*NET, ESCO and SFIA provide reference vocabularies so related capabilities can be compared across job titles. They are anchors for classification, not substitutes for current NZ evidence.</p><a href="https://esco.ec.europa.eu/en/classification/skill" target="_blank" rel="noreferrer">ESCO skills classification <ArrowRight size={13} /></a><a href="https://sfia-online.org/en/sfia-9" target="_blank" rel="noreferrer">SFIA 9 professional skills framework <ArrowRight size={13} /></a></article><article><span>06</span><h3>Responsible AI and production evidence</h3><p>AI application roles need more than model keywords. The benchmark keeps API delivery, testing, deployment and risk controls visible alongside model and retrieval skills.</p><a href="https://www.nist.gov/itl/ai-risk-management-framework" target="_blank" rel="noreferrer">NIST AI Risk Management Framework <ArrowRight size={13} /></a><a href="https://www.nist.gov/itl/ai-risk-management-framework/ai-rmf-playbook" target="_blank" rel="noreferrer">NIST AI RMF Playbook <ArrowRight size={13} /></a></article></div><footer className="methodology-note"><BookOpen size={15} /><span>Sources establish the measurement frame; the displayed score still depends on the candidate evidence and the indexed New Zealand postings available in this workspace.</span></footer></section>;
}

function RoleSkillSignalPlot({ fit }: { fit: RoleFit }) {
  const items = [...fit.contributions].sort((left, right) => right.weight - left.weight).slice(0, 12);
  if (!fit.market_posting_count) return <section className="role-signal-panel" aria-labelledby="role-signal-title"><header><div><span>Evidence-to-demand view</span><h3 id="role-signal-title">Which capabilities carry the most leverage?</h3><p>Market frequency will appear here after permitted New Zealand job records are indexed for this role family.</p></div><small>Prior benchmark only</small></header><div className="role-signal-empty"><Database size={19} /><div><strong>Waiting for a posting sample</strong><span>The current alignment uses occupational frameworks and your evidence. It does not invent market frequencies when the dataset is empty.</span></div></div><footer><ShieldCheck size={14} /><span>Role priors remain visible in the radar above; market calibration is bounded and only activates when observed postings are available.</span></footer></section>;
  const left = 48; const top = 22; const width = 392; const height = 174;
  const x = (value: number) => left + Math.max(0, Math.min(1, value)) * width;
  const y = (value: number) => top + height - Math.max(0, Math.min(100, value)) / 100 * height;
  return <section className="role-signal-panel" aria-labelledby="role-signal-title"><header><div><span>Evidence-to-demand view</span><h3 id="role-signal-title">Which capabilities carry the most leverage?</h3><p>Skills further right appear in more indexed postings; skills higher up have stronger evidence in your record. Bubble size reflects benchmark weight.</p></div><small>{fit.market_posting_count ? `${fit.market_posting_count} indexed postings` : "No posting sample yet"}</small></header><div className="role-signal-plot-wrap"><svg className="role-signal-plot" viewBox="0 0 470 245" role="img" aria-label="Market frequency and candidate evidence plot"><rect x={left} y={top} width={width} height={height} className="signal-plot-surface" /><line x1={left} y1={top + height} x2={left + width} y2={top + height} className="signal-axis" /><line x1={left} y1={top} x2={left} y2={top + height} className="signal-axis" />{[0,.25,.5,.75,1].map((value) => <g key={`x-${value}`}><line x1={x(value)} y1={top} x2={x(value)} y2={top + height} className="signal-grid" /><text x={x(value)} y={top + height + 17} className="signal-tick" textAnchor="middle">{Math.round(value * 100)}%</text></g>)}{[0,25,50,75,100].map((value) => <g key={`y-${value}`}><line x1={left} y1={y(value)} x2={left + width} y2={y(value)} className="signal-grid" /><text x={left - 8} y={y(value) + 4} className="signal-tick" textAnchor="end">{value}</text></g>)}<text x={left + width / 2} y="239" className="signal-axis-label" textAnchor="middle">Market mention frequency</text><text x="13" y={top + height / 2} className="signal-axis-label" transform={`rotate(-90 13 ${top + height / 2})`} textAnchor="middle">Evidence score</text>{items.map((item, index) => { const frequency = fit.market_posting_count ? item.market_frequency : 0; const radius = 5 + Math.min(6, item.weight * 2); const labelX = x(frequency) + (index % 2 ? 8 : -8); const labelY = y(item.normalized_score) + (index % 2 ? 15 : -8); return <g key={item.skill_slug}><circle cx={x(frequency)} cy={y(item.normalized_score)} r={radius} className={item.required ? "signal-point required" : "signal-point"}><title>{item.skill_name}: {Math.round(frequency * 100)}% market frequency, {Math.round(item.normalized_score)} evidence score</title></circle><text x={Math.max(left + 4, Math.min(left + width - 4, labelX))} y={Math.max(top + 10, Math.min(top + height - 4, labelY))} className="signal-label" textAnchor={index % 2 ? "start" : "end"}>{item.skill_name}</text></g>; })}</svg><div className="role-signal-legend"><span><i className="signal-dot" />Supporting capability</span><span><i className="signal-dot required" />Required capability</span><span><strong>↗</strong>Prioritise high-demand gaps first</span></div></div><footer><ShieldCheck size={14} /><span>Market frequency is a bounded calibration signal, not a hiring probability. It is shown only when the posting sample supports it.</span></footer></section>;
}

function RoleAlignmentRadar({ fit }: { fit: RoleFit }) {
  const items = [...fit.contributions].sort((left, right) => right.weight - left.weight).slice(0, 8);
  const cx = 210; const cy = 176; const radius = 116;
  const point = (index: number, value: number) => { const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(items.length, 1); return `${cx + Math.cos(angle) * radius * value / 100},${cy + Math.sin(angle) * radius * value / 100}`; };
  const ring = (scale: number) => items.map((_, index) => point(index, 100 * scale)).join(" ");
  const maxWeight = Math.max(...items.map((item) => item.weight), 1);
  const benchmark = (item: FitContribution) => item.required ? 100 : Math.max(58, Math.round((item.weight / maxWeight) * 100));
  return <div className="alignment-radar-layout"><div className="alignment-radar-wrap"><svg className="alignment-radar" viewBox="0 0 420 360" role="img" aria-label="Role benchmark compared with personal evidence"><polygon points={ring(1)} className="alignment-radar-ring" />{[.75,.5,.25].map((scale) => <polygon points={ring(scale)} className="alignment-radar-grid" key={scale} />)}{items.map((_, index) => <line key={index} x1={cx} y1={cy} x2={point(index, 100).split(",")[0]} y2={point(index, 100).split(",")[1]} className="alignment-radar-axis" />)}<polygon points={items.map((item, index) => point(index, benchmark(item))).join(" ")} className="alignment-radar-benchmark" /><polygon points={items.map((item, index) => point(index, item.normalized_score)).join(" ")} className="alignment-radar-evidence" />{items.map((item, index) => { const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(items.length, 1); return <text key={item.skill_slug} x={cx + Math.cos(angle) * 153} y={cy + Math.sin(angle) * 153} className="alignment-radar-label" textAnchor="middle">{item.skill_name}</text>; })}</svg><div className="alignment-legend"><span><i className="benchmark-key" />Role benchmark</span><span><i className="evidence-key" />Your evidence</span></div></div><div className="alignment-radar-list"><header><div><span>Evidence signal</span><small>{scoreLabel(fit.score)}</small></div><strong>{Math.round(fit.score)}<small>/ 100</small></strong></header><p className="alignment-score-note">A progress signal from reviewed evidence against this role benchmark, not a hiring grade.</p>{items.map((item) => <div key={item.skill_slug}><span><b>{item.skill_name}</b><small>{item.required ? "Essential" : "Supporting"} · benchmark {benchmark(item)} · {fit.market_posting_count ? `${Math.round(item.market_frequency * 100)}% market mention` : "prior only"}</small></span><strong>{Math.round(item.normalized_score)}</strong><i><u style={{ width: `${Math.max(3, Math.min(100, item.normalized_score))}%` }} /></i></div>)}</div><RoleSkillSignalPlot fit={fit} /></div>;
}

function scoreLabel(score: number): string {
  if (score >= 75) return "Strong signal";
  if (score >= 55) return "Growing signal";
  return "Starting signal";
}

function scoreTone(score: number): "strong" | "growing" | "starting" {
  if (score >= 75) return "strong";
  if (score >= 55) return "growing";
  return "starting";
}

function RoleAlignmentDashboard({ role, selectedRole, roleFits, loading, failed, onRetry, onSelectRole }: { role: RoleKey; selectedRole: Exclude<RoleKey, ""> | ""; roleFits: RoleFitMap; loading: boolean; failed: boolean; onRetry: () => void; onSelectRole: (roleKey: Exclude<RoleKey, "">) => void }) {
  const roleKeys = Object.keys(roles) as Exclude<RoleKey, "">[];
  const activeRole = (selectedRole || role || roleKeys[0]) as Exclude<RoleKey, "">;
  const selectedFit = roleFits[activeRole];
  return <section className="role-alignment-dashboard" aria-labelledby="role-alignment-title"><header><div><span>Role-family alignment</span><h2 id="role-alignment-title">How your evidence travels across roles</h2><p>Choose a role family to compare its benchmark with the same personal evidence record. Treat the signal as a progress guide, not a judgement or hiring prediction.</p></div><div className="role-alignment-meta"><span className="role-alignment-note"><Network size={14} />One evidence baseline · {roleKeys.length} role families</span>{selectedFit?.benchmark_methodology && <small>{selectedFit.benchmark_methodology}</small>}{selectedFit?.market_posting_count ? <small>{selectedFit.market_posting_count} indexed postings calibrate the selected benchmark.</small> : null}{selectedFit?.benchmark_sources?.length ? <details className="role-alignment-sources"><summary>View benchmark sources</summary><div>{selectedFit.benchmark_sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.name}<ArrowRight size={11} /></a>)}</div></details> : null}</div></header><div className="role-alignment-cards">{roleKeys.map((roleKey) => { const fit = roleFits[roleKey]; const active = roleKey === activeRole; const tone = fit ? scoreTone(fit.score) : "starting"; return <button type="button" key={roleKey} className={`role-alignment-card${active ? " active" : ""}`} aria-pressed={active} onClick={() => onSelectRole(roleKey)}><span className="role-alignment-card-name"><RoleFamilyIcon roleKey={roleKey} size={17} /><strong>{roles[roleKey]}</strong></span><span className="role-alignment-card-score-label">Evidence signal</span><span className={`role-alignment-card-score score-tone-${tone}`}>{fit ? Math.round(fit.score) : "—"}<small>/ 100</small></span><span className="role-alignment-card-meter"><i><u style={{ width: `${fit ? Math.max(8, Math.min(100, fit.score)) : 8}%` }} /></i></span><span className="role-alignment-card-status">{fit ? scoreLabel(fit.score) : loading ? "Loading" : "Unavailable"}</span><span className="role-alignment-card-meta">Coverage {fit ? `${Math.round(fit.coverage)}%` : "—"} · {fit ? fit.contributions.filter((item) => item.required && item.evidence_level === 0).length : "—"} priority gaps</span></button>; })}</div>{selectedFit ? <RoleAlignmentRadar fit={selectedFit} /> : <div className="alignment-loading">{loading ? <><RefreshCw size={18} className="spin" />Loading role-family benchmarks</> : failed ? <><span>Role-family benchmarks could not be loaded.</span><button type="button" className="text-button" onClick={onRetry}>Retry</button></> : <><RefreshCw size={18} className="spin" />Preparing role-family benchmarks</>}</div>}</section>;
}

function RoleComparisonRadar({ skillDemands, focus }: { skillDemands: SkillDemand[]; focus: "all" | Exclude<RoleKey, ""> }) {
  const tableItems = skillDemands.filter((item) => focus === "all" || item.role_families.includes(focus)).sort((left, right) => right.demand_score - left.demand_score || right.mention_count - left.mention_count || left.name.localeCompare(right.name));
  const items = tableItems.slice(0, 8);
  const cx = 220; const cy = 190; const radius = 125;
  const point = (index: number, value: number, scale = 1) => { const angle = -Math.PI / 2 + (index * Math.PI * 2) / items.length; return `${cx + Math.cos(angle) * radius * scale * value / 100},${cy + Math.sin(angle) * radius * scale * value / 100}`; };
  const ring = (scale: number) => items.map((_, index) => point(index, 100, scale)).join(" ");
  if (!items.length) return null;
  return <div className="comparison-radar"><div><div className="radar-legend"><span className="job-legend">JD priority</span><span className="candidate-legend">Your evidence</span></div><svg className="capability-radar" viewBox="0 0 440 390" role="img" aria-labelledby="comparison-radar-title comparison-radar-desc"><title id="comparison-radar-title">Job requirements and candidate evidence comparison</title><desc id="comparison-radar-desc">The red shape shows the priority of capabilities in the job advertisement. The teal shape shows the evidence currently confirmed in your profile.</desc><polygon points={ring(1)} className="radar-ring" />{[.8,.6,.4,.2].map((scale) => <polygon points={ring(scale)} className="radar-grid" key={scale} />)}{items.map((_, index) => <line key={index} x1={cx} y1={cy} x2={point(index, 100).split(",")[0]} y2={point(index, 100).split(",")[1]} className="radar-axis" />)}<polygon points={items.map((item, index) => point(index, item.demand_score)).join(" ")} className="job-radar-fill" /><polygon points={items.map((item, index) => point(index, item.evidence_score)).join(" ")} className="candidate-radar-fill" />{items.map((item, index) => { const angle = -Math.PI / 2 + (index * Math.PI * 2) / items.length; return <text key={item.slug} x={cx + Math.cos(angle) * 166} y={cy + Math.sin(angle) * 166} className="radar-label" textAnchor="middle">{item.name}</text>; })}</svg>{tableItems.length > items.length && <p className="radar-limit-note">Radar shows the eight highest-priority capabilities. The comparison includes all {tableItems.length} detected requirements.</p>}</div><div className="comparison-table" role="region" aria-label="Detailed job capability comparison"><div className="comparison-heading"><span>JD capability</span><span>JD priority</span><span>Your evidence</span></div>{tableItems.map((item) => <div key={item.slug} className={item.evidence_score + 5 < item.demand_score ? "comparison-gap" : "comparison-covered"}><span><b>{item.name}</b><small>{item.importance === "essential" ? "Strong requirement signal" : item.importance === "supporting" ? "Bonus or supporting signal" : "Explicitly named"} · {item.mention_count} mention{item.mention_count === 1 ? "" : "s"}</small></span><strong title={`Explicit mention ${item.explicit_mention}; repetition +${item.repetition_signal}; requirement language +${item.requirement_signal}; title +${item.title_signal}`}>{Math.round(item.demand_score)}<small>/ 100 · JD</small></strong><strong title={`Evidence base ${item.evidence_base_score}; confidence ${item.confidence_adjustment.toFixed(1)}; specificity ${(item.specificity_bonus ?? 0).toFixed(1)}; verification +${(item.verification_bonus ?? 0).toFixed(1)}; outcome +${(item.outcome_bonus ?? 0).toFixed(1)}; corroboration +${item.corroboration_bonus.toFixed(1)}; diversity +${item.diversity_bonus.toFixed(1)}`}>{Math.round(item.evidence_score)}<small>/ 100 · {evidenceLabel(item.evidence_level)}{item.source_count ? ` · ${item.source_count} source${item.source_count === 1 ? "" : "s"}` : ""}{item.score_factors?.[0] ? ` · ${item.score_factors[0]}` : ""}</small></strong></div>)}<p>The radar shows the highest-priority capabilities explicitly found in this JD; the table retains every detected requirement. JD priority uses section context, requirement language, repetition and title context. Your score uses reviewed CV and GitHub evidence for the same capabilities.</p></div></div>;
}

const adjacentRoles: Record<Exclude<RoleKey, "">, Exclude<RoleKey, "">[]> = {
  software: ["cloud-devops", "ai", "data-engineer", "data-analyst"],
  "data-analyst": ["data-engineer", "ai", "software", "cloud-devops"],
  "data-engineer": ["data-analyst", "cloud-devops", "software", "ai"],
  ai: ["software", "data-engineer", "cloud-devops", "data-analyst"],
  "cloud-devops": ["software", "data-engineer", "ai", "data-analyst"],
};

function MarketView({ market, quality, targetRole, navigate }: { market: MarketSummary | null; quality: MarketQuality | null; targetRole: RoleKey; navigate: (path: string) => void }) {
  const initialRole = targetRole || (market?.roles.find((item) => item.count > 0)?.role_family as Exclude<RoleKey, ""> | undefined) || "software";
  const [focus, setFocus] = useState<Exclude<RoleKey, "">>(initialRole);

  if (!market?.posting_count) return <div className="tool-page"><header><p className="page-kicker-icon"><BarChart3 size={15} />Your market</p><h1>Technology opportunities</h1><span>Use current, governed job records to make a more informed search decision.</span></header><section className="tool-panel market-empty-panel"><div className="market-empty"><span className="empty-state-mark"><BarChart3 size={22} /></span><p className="empty-state-kicker">Data coverage</p><h2>Market coverage is not ready yet</h2><p>No permitted job records are currently indexed for this workspace. Your profile and role decoder remain available while the next market collection is processed.</p><div className="empty-state-actions"><button type="button" className="primary-button" onClick={() => navigate(productRoutes.decoder)}>Analyse a job advertisement <ArrowRight size={15} /></button><button type="button" className="secondary-button" onClick={() => navigate(productRoutes.workspace)}>Review my profile</button></div></div></section></div>;

  const focusCount = market.roles.find((item) => item.role_family === focus)?.count ?? 0;
  const marketShare = Math.round((focusCount / market.posting_count) * 100);
  const earlyCareerCount = market.role_seniority
    .filter((item) => item.role_family === focus && ["graduate", "junior"].includes(item.seniority.toLowerCase()))
    .reduce((sum, item) => sum + item.count, 0);
  const skills = market.role_skills.filter((item) => item.role_family === focus).slice(0, 8);
  const displayedSkills = skills.length ? skills : market.top_skills.slice(0, 8);
  const skillMax = Math.max(...displayedSkills.map((item) => item.count), 1);
  const locations = market.role_locations.filter((item) => item.role_family === focus).slice(0, 6);
  const displayedLocations = locations.length ? locations : market.locations.slice(0, 6);
  const locationMax = Math.max(...displayedLocations.map((item) => item.count), 1);
  const alternatives = adjacentRoles[focus]
    .map((roleKey) => ({ roleKey, count: market.roles.find((item) => item.role_family === roleKey)?.count ?? 0 }))
    .filter((item) => item.count > 0)
    .slice(0, 3);
  const freshness = market.latest_retrieved_at ? new Date(market.latest_retrieved_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" }) : "Unavailable";
  const nextRefresh = quality?.sources.map((source) => source.next_run_at).filter((value): value is string => Boolean(value)).sort()[0];

  return <div className="tool-page market-page">
    <header className="market-header"><div><p className="page-kicker-icon"><TrendingUp size={15} />Market intelligence</p><h1>{roles[focus]} opportunities</h1><span>A focused view of the permitted New Zealand job records currently indexed by CareerSignal. This is a directional sample, not an official labour-market total.</span></div><div className="market-header-meta"><span><Database size={14} />Indexed dataset</span><strong>{market.posting_count} records</strong><small><CalendarDays size={13} />Latest retrieval · {freshness}</small></div></header>
    <section className="market-workbench">
      <div className="market-toolbar"><div><span>Role family</span><strong>{roles[focus]}</strong><small>{targetRole ? `${roles[targetRole]} is selected in your profile.` : "Choose a segment to inspect."}</small></div><div className="market-role-selector" role="group" aria-label="Market role family">{Object.entries(roles).map(([key, label]) => <button type="button" key={key} aria-pressed={focus === key} className={focus === key ? "active" : ""} onClick={() => setFocus(key as Exclude<RoleKey, "">)}>{label}{targetRole === key && <small>Target</small>}</button>)}</div></div>
      <div className="market-summary" aria-label="Selected market summary"><div><span className="metric-icon"><BriefcaseBusiness size={18} /></span><span>Indexed opportunities</span><strong>{focusCount}</strong><small>in this role family</small></div><div><span className="metric-icon"><CircleGauge size={18} /></span><span>Share of current sample</span><strong>{marketShare}%</strong><small>{focusCount} of {market.posting_count} records</small></div><div><span className="metric-icon"><GraduationCap size={18} /></span><span>Graduate and junior</span><strong>{earlyCareerCount}</strong><small>explicitly classified openings</small></div><div><span className="metric-icon"><Database size={18} /></span><span>Source coverage</span><strong>{market.source_count}</strong><small>permitted source{market.source_count === 1 ? "" : "s"}</small></div></div>
      <div className="market-insights">
        <section className="market-data-block"><header><div className="data-block-title"><span className="section-icon"><Layers3 size={18} /></span><div><span className="panel-kicker">Employer demand</span><h2>Skills employers mention</h2></div></div><button className="text-button" onClick={() => navigate(productRoutes.evidence)}>Open evidence <ArrowRight size={14} /></button></header><p className="data-block-note">Ranked by frequency in the currently indexed {roles[focus]} sample.</p><div className="market-table" role="table" aria-label="Employer skills"><div className="market-table-head" role="row"><span>Skill</span><span>Records</span><span>Share</span></div>{displayedSkills.map((item, index) => <div className="market-table-row" role="row" key={item.skill_slug}><span><b>{String(index + 1).padStart(2, "0")}</b>{item.skill_name}</span><strong>{item.count}</strong><span><i><u style={{ width: `${Math.max((item.count / skillMax) * 100, 4)}%` }} /></i>{Math.round((item.count / Math.max(focusCount, 1)) * 100)}%</span></div>)}</div></section>
        <section className="market-data-block"><header><div><span className="panel-kicker">Geography</span><h2>Where opportunities appear</h2></div><MapPin size={18} /></header><p className="data-block-note">Normalised from each source's location text. Remote and hybrid labels may vary.</p><div className="market-table" role="table" aria-label="Opportunity locations"><div className="market-table-head" role="row"><span>Location</span><span>Records</span><span>Share</span></div>{displayedLocations.map((item) => <div className="market-table-row" role="row" key={item.location}><span><MapPin size={14} />{item.location}</span><strong>{item.count}</strong><span><i><u style={{ width: `${Math.max((item.count / locationMax) * 100, 4)}%` }} /></i>{Math.round((item.count / Math.max(focusCount, 1)) * 100)}%</span></div>)}</div></section>
      </div>
      <section className="market-next-step"><span className="next-step-icon"><Compass size={21} /></span><div><span className="panel-kicker">Next step</span><h2>Move from market signal to a real application decision</h2><p>Use the same role family and evidence baseline to compare a specific job advertisement or inspect your current gaps.</p></div><div><button className="primary-button" onClick={() => navigate(productRoutes.decoder)}>Compare a job <ArrowRight size={15} /></button><button className="secondary-button" onClick={() => navigate(productRoutes.graph)}>Review capability gaps</button></div></section>
      {alternatives.length > 0 && <section className="market-adjacent"><header><div><span className="panel-kicker">Adjacent demand</span><h2>Related role families</h2></div><span>Ordered by career proximity</span></header><div>{alternatives.map((item) => <button type="button" key={item.roleKey} onClick={() => setFocus(item.roleKey)}><span><strong>{roles[item.roleKey]}</strong><small>Inspect this segment</small></span><b>{item.count}<small>records</small></b><ArrowRight size={16} /></button>)}</div></section>}
       <details className="market-coverage"><summary><span><strong>Data coverage and limitations</strong><small>{market.posting_count} records from {market.source_count} permitted source{market.source_count === 1 ? "" : "s"}</small></span><ChevronDown size={17} /></summary><div><p>This view describes CareerSignal's current indexed sample, not every technology vacancy in New Zealand. Counts support comparison and investigation rather than official totals.</p>{quality?.sample_warnings?.length ? <ul className="market-warnings">{quality.sample_warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}<dl><div><dt>Graduate and junior</dt><dd>{quality?.graduate_junior_count ?? earlyCareerCount}</dd></div><div><dt>Normalised locations</dt><dd>{quality?.normalised_location_count ?? market.locations.length}</dd></div><div><dt>Missing publication dates</dt><dd>{quality?.missing_publication_date_percent ?? 0}%</dd></div><div><dt>Older than 90 days</dt><dd>{quality?.stale_posting_count ?? 0}</dd></div><div><dt>Automated source runs</dt><dd>{quality?.collector_completed_count ?? 0} completed</dd></div><div><dt>Next scheduled refresh</dt><dd>{nextRefresh ? new Date(nextRefresh).toLocaleString("en-NZ", { dateStyle: "medium", timeStyle: "short" }) : "Not scheduled"}</dd></div></dl></div></details>
    </section>
  </div>;
}

function CareerPathView({ role, market, roleFits, navigate, onSelectRole }: { role: RoleKey; market: MarketSummary | null; roleFits: RoleFitMap; navigate: (path: string) => void; onSelectRole: (roleKey: Exclude<RoleKey, "">) => void }) {
  const availableRoutes = role ? adjacentRoles[role] : [];
  const [selectedRoute, setSelectedRoute] = useState<Exclude<RoleKey, "">>(availableRoutes[0] || "software");
  if (!role) return <div className="tool-page pathway-page"><header><p className="page-kicker-icon"><Route size={15} />Career paths</p><h1>Compare credible next moves</h1><span>Start with a target role so each adjacent path has a clear professional baseline.</span></header><section className="pathway-empty"><Target size={22} /><div><span>Target required</span><h2>Set your current direction first</h2><p>CareerSignal needs a role family, market and level before it can frame adjacent options.</p></div><button className="primary-button" onClick={() => navigate(productRoutes.workspace)}>Set target role <ArrowRight size={15} /></button></section></div>;

  const currentFit = roleFits[role];
  const selectedFit = roleFits[selectedRoute];
  const selectedOpenings = market?.roles.find((item) => item.role_family === selectedRoute)?.count ?? null;
  const currentOpenings = market?.roles.find((item) => item.role_family === role)?.count ?? null;
  const nextProof = selectedFit?.contributions
    .filter((item) => item.evidence_level === 0)
    .sort((left, right) => Number(right.required) - Number(left.required) || right.weight - left.weight)
    .slice(0, 3) ?? [];

  return <div className="tool-page pathway-page">
    <header className="pathway-header"><div><p className="page-kicker-icon"><Route size={15} />Career paths</p><h1>Plan the next evidence move</h1><span>Start from your current role, choose one adjacent direction, then turn its gaps into a concrete proof plan.</span></div><button className="secondary-button" onClick={() => navigate(productRoutes.graph)}><FileCheck2 size={16} />Review my evidence</button></header>
    <section className="pathway-planner">
      <div className="pathway-planner-head"><div><span className="panel-kicker">01 · Current baseline</span><h2>{roles[role]}</h2><p>{currentFit ? `${Math.round(currentFit.coverage)}% of the current role benchmark is covered by your reviewed evidence.` : "Your role benchmark is being prepared."}</p></div><div className="pathway-baseline-metrics"><span><small>Evidence signal</small><strong>{currentFit ? Math.round(currentFit.score) : "—"}</strong></span><span><small>Indexed roles</small><strong>{currentOpenings ?? "—"}</strong></span></div></div>
      <div className="pathway-step-label"><span>02 · Choose a direction</span><small>Routes are ordered by role proximity, not a promise of eligibility.</small></div>
      <div className="pathway-route-grid">{availableRoutes.slice(0, 3).map((routeKey, index) => { const fit = roleFits[routeKey]; const openings = market?.roles.find((item) => item.role_family === routeKey)?.count ?? null; const active = selectedRoute === routeKey; return <button type="button" className={`pathway-route-card${active ? " active" : ""}`} key={routeKey} onClick={() => setSelectedRoute(routeKey)} aria-pressed={active}><span className="pathway-route-number">0{index + 1}</span><span className="pathway-role-icon"><RoleFamilyIcon roleKey={routeKey} size={20} /></span><strong>{roles[routeKey]}</strong><small>{fit ? `${Math.round(fit.coverage)}% coverage · ${scoreLabel(fit.score)}` : "Benchmark loading"}</small><span className="pathway-route-meta"><span>{openings ?? "—"} indexed roles</span><ArrowRight size={15} /></span></button>; })}</div>
      <section className="pathway-route-detail"><div><span className="panel-kicker">03 · Selected route</span><h2><RoleFamilyIcon roleKey={selectedRoute} size={20} />{roles[selectedRoute]}</h2><p>{selectedFit ? `Your current evidence provides a ${scoreLabel(selectedFit.score).toLowerCase()} for this direction. Build the missing proof in order of priority.` : "The benchmark will appear when role evidence finishes loading."}</p><div className="pathway-detail-metrics"><span><small>Evidence signal</small><strong>{selectedFit ? Math.round(selectedFit.score) : "—"}<em>/ 100</em></strong></span><span><small>Indexed roles</small><strong>{selectedOpenings ?? "—"}</strong></span><span><small>Priority gaps</small><strong>{selectedFit ? selectedFit.contributions.filter((item) => item.required && item.evidence_level === 0).length : "—"}</strong></span></div></div><div className="pathway-proof-list"><span>Build next</span>{nextProof.length ? nextProof.map((item) => <div key={item.skill_slug}><span><b>{item.skill_name}</b><small>{item.required ? "Essential capability" : "Supporting capability"}</small></span><ArrowRight size={14} /></div>) : <p>No priority gaps are available yet. Compare a live advertisement to choose a specific proof target.</p>}</div><div className="pathway-detail-actions"><button className="primary-button" onClick={() => { onSelectRole(selectedRoute); navigate(productRoutes.graph); }}><Network size={15} />Open role alignment</button><button className="secondary-button" onClick={() => navigate(productRoutes.decoder)}><BriefcaseBusiness size={15} />Compare a live role</button></div></section>
      <footer className="pathway-planner-footer"><ShieldCheck size={17} /><span>Use pathways to choose what to prove next. Validate the direction against a specific job advertisement before applying.</span></footer>
    </section>
  </div>;
}

type EvidenceRoleFilter = "all" | Exclude<RoleKey, "">;

function CapabilityProfileView({ role, evidence, roleFits, roleFitsLoading, roleFitsError, onRetryRoleFits, selectedRole, onSelectRole, evidenceFilter, onSelectEvidenceFilter, navigate }: { role: RoleKey; evidence: SkillEvidence[]; roleFits: RoleFitMap; roleFitsLoading: boolean; roleFitsError: boolean; onRetryRoleFits: () => void; selectedRole: Exclude<RoleKey, ""> | ""; onSelectRole: (roleKey: Exclude<RoleKey, "">) => void; evidenceFilter: EvidenceRoleFilter; onSelectEvidenceFilter: (filter: EvidenceRoleFilter) => void; navigate: (path: string) => void }) {
  const uniqueEvidence = dedupeSkillEvidence(evidence);
  const activeFit = evidenceFilter === "all" ? null : roleFits[evidenceFilter];
  const activeSlugs = activeFit ? new Set(activeFit.contributions.map((item) => item.skill_slug)) : null;
  const filteredEvidence = activeSlugs ? uniqueEvidence.filter((item) => activeSlugs.has(item.skill_slug)) : uniqueEvidence;
  return <div className="tool-page capability-page">
    <header className="capability-page-header"><div><p className="page-kicker-icon"><Network size={15} />My capability network</p><h1>All the evidence you can currently prove</h1><span>This is your portable capability record. It stays independent of a single target role and can be aligned to different technical directions.</span></div><div className="capability-header-context"><span><FileCheck2 size={14} />Evidence register</span><strong>{uniqueEvidence.length} confirmed skills</strong></div></header>
    {uniqueEvidence.length ? <section className="capability-report personal-capability-report">
      <div className="capability-report-bar"><div className="report-bar-item"><Network size={18} /><span><small>Personal capability map</small><strong>Confirmed evidence across your work</strong></span></div><div><button className="text-button" onClick={() => navigate(productRoutes.workspace)}><FileText size={15} />Manage evidence</button><button className="secondary-button" onClick={() => navigate(productRoutes.decoder)}><BriefcaseBusiness size={15} />Compare a JD</button></div></div>
      <div className="personal-graph-frame"><header><div><span>Evidence network</span><h2>Your skills, sources and evidence maturity</h2><p className="profile-filter-note">{filteredEvidence.length} matching capabilities from {uniqueEvidence.length} confirmed skills</p></div><div className="profile-role-filter" role="tablist" aria-label="Filter evidence by role family"><button type="button" role="tab" aria-selected={evidenceFilter === "all"} className={evidenceFilter === "all" ? "active" : ""} onClick={() => onSelectEvidenceFilter("all")}><Layers3 size={14} />All capabilities</button>{Object.entries(roles).map(([key, label]) => <button type="button" role="tab" aria-selected={evidenceFilter === key} className={evidenceFilter === key ? "active" : ""} onClick={() => onSelectEvidenceFilter(key as Exclude<RoleKey, "">)} key={key}><RoleFamilyIcon roleKey={key as Exclude<RoleKey, "">} size={14} />{label}</button>)}</div></header><PersonalEvidenceGraph evidence={filteredEvidence} /></div>
      <PersonalEvidenceAnalytics evidence={filteredEvidence} />
      <PersonalEvidenceVisuals evidence={filteredEvidence} />
      <CapabilityMethodology />
      <RoleAlignmentDashboard role={role} selectedRole={selectedRole} roleFits={roleFits} loading={roleFitsLoading} failed={roleFitsError} onRetry={onRetryRoleFits} onSelectRole={onSelectRole} />
      <footer className="capability-report-footer"><ShieldCheck size={17} /><p><strong>How to use this report</strong> This network shows what you have actually evidenced. Select a role family above to compare the same record with Software, Data, AI and Cloud benchmarks.</p></footer>
    </section> : <section className="pathway-empty"><FileText size={22} /><div><span>Evidence required</span><h2>Build your personal capability record first</h2><p>Complete Workspace setup and confirm CV or GitHub evidence. Your map will then work across every role family.</p></div><button className="primary-button" onClick={() => navigate(productRoutes.workspace)}>Open workspace <ArrowRight size={15} /></button></section>}
  </div>;
}

const applicationStages: SavedJob["status"][] = ["saved", "preparing", "applied", "interview", "offer", "rejected", "archived"];
const applicationStageLabels: Record<SavedJob["status"], string> = {
  saved: "Saved",
  preparing: "Preparing",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Closed",
  archived: "Archived",
};

function SavedRoleComparison({ jobs, details, loading, failed, onToggleCompare }: { jobs: SavedJob[]; details: AnalysisDetailsMap; loading: boolean; failed: boolean; onToggleCompare: (job: SavedJob) => void }) {
  const capabilityMap = new Map<string, { name: string; jobs: Map<string, SkillDemand> }>();
  jobs.forEach((job) => {
    details[job.id]?.skill_demands.forEach((demand) => {
      const current = capabilityMap.get(demand.slug) ?? { name: demand.name, jobs: new Map<string, SkillDemand>() };
      current.jobs.set(job.id, demand);
      capabilityMap.set(demand.slug, current);
    });
  });
  const capabilities = [...capabilityMap.entries()]
    .sort((left, right) => Math.max(...[...right[1].jobs.values()].map((item) => item.demand_score), 0) - Math.max(...[...left[1].jobs.values()].map((item) => item.demand_score), 0))
    .slice(0, 10);
  return <section className="jobs-compare-panel" aria-labelledby="jobs-compare-title"><header><div><span className="panel-kicker">Role comparison</span><h2 id="jobs-compare-title">Compare saved roles here</h2><p>This comparison stays in Applications: requirements, evidence coverage and priority signals are shown side by side without sending you back to Profile.</p></div><span className="jobs-compare-count">{jobs.length} selected</span></header><div className="jobs-compare-grid">{jobs.map((job) => <article key={job.id}><div className="jobs-compare-card-head"><span>{job.role_family && roles[job.role_family as Exclude<RoleKey, "">] ? roles[job.role_family as Exclude<RoleKey, "">] : "Role analysis"}</span><button type="button" aria-label={`Remove ${job.title} from comparison`} onClick={() => onToggleCompare(job)}><X size={15} /></button></div><h3>{job.title}</h3><p>{job.company} · {job.location}</p><div className="jobs-compare-readiness"><strong>{job.skill_count ? `${job.evidenced_skill_count}/${job.skill_count}` : "—"}</strong><span>evidence covered</span><i><u style={{ width: `${job.skill_count ? Math.max(4, Math.min(100, (job.evidenced_skill_count / job.skill_count) * 100)) : 4}%` }} /></i></div><small>{job.status === "saved" ? "Ready to review" : applicationStageLabels[job.status]}{job.top_gaps.length ? ` · Next: ${job.top_gaps.slice(0, 2).join(", ")}` : ""}</small><div className="jobs-compare-requirements"><span>Top requirements</span>{details[job.id]?.skill_demands.slice(0, 4).map((demand) => <b key={demand.slug}>{demand.name}<small>{Math.round(demand.demand_score)} · {demand.importance}</small></b>)}{!details[job.id] && <small>{loading ? "Loading saved analysis..." : "Analysis details unavailable"}</small>}</div></article>)}</div>{loading && <div className="jobs-compare-state"><RefreshCw size={16} className="spin" />Loading saved analysis details</div>}{failed && !loading && <div className="jobs-compare-state"><span>Some saved analysis details could not be loaded. The evidence coverage above is still available.</span></div>}{!loading && !failed && capabilities.length > 0 && <section className="jobs-compare-matrix" aria-labelledby="jobs-compare-matrix-title"><header><div><span className="panel-kicker">Requirement matrix</span><h3 id="jobs-compare-matrix-title">What each job is asking for</h3></div><small>Higher values indicate stronger demand in that advertisement.</small></header><div className="jobs-compare-matrix-table"><div className="jobs-compare-matrix-head"><strong>Capability</strong>{jobs.map((job) => <span key={job.id}>{job.title}</span>)}</div>{capabilities.map(([slug, capability]) => <div className="jobs-compare-matrix-row" key={slug}><strong>{capability.name}</strong>{jobs.map((job) => { const demand = capability.jobs.get(job.id); return <span className={demand ? "present" : "absent"} key={job.id}>{demand ? `${Math.round(demand.demand_score)} · ${demand.importance}` : "Not detected"}</span>; })}</div>)}</div></section>}</section>;
}

function JobsView({ jobs, loading, history, historyJobId, historyLoading, comparisonJobIds, comparisonDetails, comparisonDetailsLoading, comparisonDetailsError, onToggleCompare, onClearCompare, onHistory, onStatus, onNotes, onDelete, onReview, navigate }: { jobs: SavedJob[]; loading: boolean; history: JobStatusEvent[]; historyJobId: string | null; historyLoading: boolean; comparisonJobIds: string[]; comparisonDetails: AnalysisDetailsMap; comparisonDetailsLoading: boolean; comparisonDetailsError: boolean; onToggleCompare: (job: SavedJob) => void; onClearCompare: () => void; onHistory: (job: SavedJob) => void; onStatus: (job: SavedJob, status: SavedJob["status"]) => void; onNotes: (job: SavedJob, notes: string) => void; onDelete: (job: SavedJob) => void; onReview: (job: SavedJob) => void; navigate: (path: string) => void }) {
  const active = jobs.filter((job) => !["rejected", "archived"].includes(job.status));
  const [compareMode, setCompareMode] = useState(comparisonJobIds.length > 0);
  const comparisonJobs = jobs.filter((job) => comparisonJobIds.includes(job.id));
  return <div className="tool-page jobs-page">
    <header className="jobs-header"><div><p className="page-kicker-icon"><ClipboardList size={15} />Application tracker</p><h1>Your role decisions, in one place</h1><span>Keep saved opportunities, preparation and application outcomes connected to the same evidence profile.</span></div><div className="jobs-header-actions"><button className="secondary-button" onClick={() => { setCompareMode((current) => !current); if (compareMode) onClearCompare(); }}><Layers3 size={15} />{compareMode ? "Done selecting" : "Compare saved roles"}</button><button className="primary-button" onClick={() => navigate(productRoutes.decoder)}><BriefcaseBusiness size={15} />Compare another role</button></div></header>
    <section className="jobs-summary" aria-label="Application pipeline summary">
      <div><span>Active opportunities</span><strong>{active.length}</strong><small>excluding closed and archived roles</small></div>
      <div><span>Applications sent</span><strong>{jobs.filter((job) => ["applied", "interview", "offer"].includes(job.status)).length}</strong><small>currently in progress</small></div>
      <div><span>Interview stage</span><strong>{jobs.filter((job) => job.status === "interview").length}</strong><small>requiring preparation</small></div>
    </section>
    {compareMode && (comparisonJobs.length >= 2 ? <SavedRoleComparison jobs={comparisonJobs} details={comparisonDetails} loading={comparisonDetailsLoading} failed={comparisonDetailsError} onToggleCompare={onToggleCompare} /> : <section className="jobs-compare-panel" aria-labelledby="jobs-compare-title"><header><div><span className="panel-kicker">Role comparison</span><h2 id="jobs-compare-title">Compare saved analyses</h2><p>Select up to three saved roles below. The comparison stays here once two roles are selected.</p></div><span className="jobs-compare-count">{comparisonJobs.length} selected</span></header><div className="jobs-compare-empty"><Layers3 size={19} /><span>{comparisonJobs.length ? "Select one more saved role to compare." : "Select two or three saved roles from the list below."}</span></div></section>)}
    <section className="jobs-register">
      <header><div><span className="panel-kicker">Saved decisions</span><h2>Application pipeline</h2></div><small>{jobs.length} role{jobs.length === 1 ? "" : "s"}</small></header>
      {loading ? <div className="jobs-empty"><RefreshCw size={22} className="spin" /><h3>Loading your applications</h3></div> : jobs.length ? <div className="jobs-table" role="table" aria-label="Saved job applications">
         <div className="jobs-table-head" role="row"><span>Opportunity</span><span>Evidence readiness</span><span>Stage</span><span>Actions</span></div>
        {jobs.map((job) => <article className="jobs-row" role="row" key={job.id}>
          <div>{compareMode && <label className="job-compare-toggle"><input type="checkbox" checked={comparisonJobIds.includes(job.id)} onChange={() => onToggleCompare(job)} disabled={!comparisonJobIds.includes(job.id) && comparisonJobIds.length >= 3} /><span>Compare</span></label>}<a href={job.analysis_id ? productRoutes.decoder : job.source_url} target={job.analysis_id ? undefined : "_blank"} rel={job.analysis_id ? undefined : "noreferrer"} onClick={job.analysis_id ? (event) => { event.preventDefault(); navigate(productRoutes.decoder); } : undefined}>{job.title}</a><span>{job.company} · {job.analysis_id ? "Saved analysis" : job.location}</span><small>{job.analysis_id ? job.location : ""}</small></div>
          <div className="job-readiness">{job.skill_count > 0 ? <><strong>{job.evidenced_skill_count} / {job.skill_count}</strong><span>capabilities evidenced</span>{job.top_gaps.length > 0 && <small>Next: {job.top_gaps.slice(0, 2).join(", ")}</small>}</> : <><strong>Review needed</strong><span>Compare the full advertisement</span></>}</div>
          <label><span className="sr-only">Application status for {job.title}</span><select value={job.status} onChange={(event) => onStatus(job, event.target.value as SavedJob["status"])}>{applicationStages.map((stage) => <option key={stage} value={stage}>{applicationStageLabels[stage]}</option>)}</select></label>
          <div className="job-row-actions"><button type="button" className="secondary-button job-plan-button" onClick={() => onReview(job)}><FileCheck2 size={13} />{job.analysis_id ? "Review fit" : "Compare first"}</button><button type="button" className="text-button" onClick={() => onHistory(job)} aria-expanded={historyJobId === job.id}><History size={13} />{historyJobId === job.id ? "Hide" : "History"}</button><button type="button" className="text-button" onClick={() => { const notes = window.prompt("Notes for this opportunity", job.notes ?? ""); if (notes !== null) onNotes(job, notes); }}>Notes</button><button type="button" className="text-button danger-button" onClick={() => onDelete(job)}>Remove</button></div>
          {historyJobId === job.id && <div className="job-history-panel" aria-live="polite">{historyLoading ? <span><RefreshCw size={14} className="spin" />Loading stage history</span> : history.length ? <ol>{history.map((event) => <li key={event.id}><span>{event.from_status ? `${applicationStageLabels[event.from_status]} → ` : "Created as "}{applicationStageLabels[event.to_status]}</span><time dateTime={event.changed_at}>{new Date(event.changed_at).toLocaleString("en-NZ")}</time></li>)}</ol> : <span>No status changes recorded yet.</span>}</div>}
        </article>)}
      </div> : <div className="jobs-empty"><Bookmark size={25} /><h3>No saved opportunities yet</h3><p>Search employer evidence and save a real vacancy, or compare a job advertisement before adding it to your pipeline.</p><div><button className="primary-button" onClick={() => navigate(productRoutes.evidence)}>Search employer evidence</button><button className="secondary-button" onClick={() => navigate(productRoutes.decoder)}>Compare an advertisement</button></div></div>}
    </section>
  </div>;
}

function AccountSettingsView({ user, onExport, onDelete }: { user: SessionUser; onExport: () => Promise<void>; onDelete: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [localError, setLocalError] = useState("");
  async function submitDeletion(event: FormEvent) {
    event.preventDefault();
    if (!window.confirm("Permanently delete this account and all private evidence? This cannot be undone.")) return;
    setDeleting(true);
    setLocalError("");
    try {
      await onDelete(password);
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : "The account could not be deleted");
      setDeleting(false);
    }
  }
  return <div className="tool-page settings-page">
    <header><p className="page-kicker-icon"><Settings size={15} />Account settings</p><h1>Control your account data</h1><span>Review the identity attached to this workspace, download a portable record or permanently remove the account.</span></header>
    <section className="settings-sections">
      <article className="settings-panel"><div><span className="panel-kicker">Account identity</span><h2>{user.display_name}</h2><p>{user.email}</p></div><dl><div><dt>Email status</dt><dd>{user.is_verified ? "Verified" : "Verification required"}</dd></div><div><dt>Workspace</dt><dd>Private to this account</dd></div></dl></article>
      <article className="settings-panel"><div><span className="panel-kicker">Data portability</span><h2>Download your CareerSignal record</h2><p>The JSON export includes your profile, confirmed evidence, GitHub records, role analyses, development plan and application history. Private document binaries are not included.</p></div><button type="button" className="secondary-button" onClick={onExport}><Download size={15} />Download export</button></article>
      <article className="settings-panel danger-zone"><div><span className="panel-kicker">Permanent deletion</span><h2>Delete this account</h2><p>CareerSignal deletes the account database records and private uploaded files. Enter your password to confirm ownership.</p></div><form onSubmit={submitDeletion}><label className="field"><span>Current password</span><input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{localError && <p className="form-error" role="alert">{localError}</p>}<button type="submit" className="secondary-button danger-button" disabled={deleting}><Trash2 size={15} />{deleting ? "Deleting account..." : "Delete account"}</button></form></article>
    </section>
  </div>;
}

function AuthScreen({ onAuthenticated, initialMode = "register", onBack, onRoute }: { onAuthenticated: (token: string, user: SessionUser) => void; initialMode?: "login" | "register" | "reset"; onBack?: () => void; onRoute: (path: string) => void }) {
  const search = new URLSearchParams(window.location.search);
  const resetToken = window.location.pathname === "/reset-password" ? search.get("token") : search.get("reset");
  const verifyToken = window.location.pathname === "/verify-email" ? search.get("token") : search.get("verify");
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(search.get("password") === "updated" ? "Password updated. Sign in with your new password." : "");

  useEffect(() => {
    if (!verifyToken) return;
    fetch(`${API_URL}/api/v1/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: verifyToken }),
    }).then((response) => {
      setMessage(response.ok ? "Email verified. You can now sign in." : "This verification link is invalid or expired.");
    }).catch(() => setMessage("Could not verify this email link."));
  }, [verifyToken]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      if (mode === "forgot") {
        const response = await fetch(`${API_URL}/api/v1/auth/forgot-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
        if (!response.ok) throw new Error("Could not request a reset link");
        setMessage("If that account exists, a reset link has been sent.");
        return;
      }
      if (mode === "reset") {
        const response = await fetch(`${API_URL}/api/v1/auth/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: resetToken, password }) });
        if (!response.ok) throw new Error("This reset link is invalid or expired");
        onRoute("/login?password=updated");
        return;
      }
      const response = await fetch(`${API_URL}/api/v1/auth/${mode}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "register" ? { display_name: name, email, password } : { email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(apiError(data, "Authentication failed"));
      onAuthenticated(data.access_token, data.user);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  const title = mode === "register" ? "Create your career workspace" : mode === "login" ? "Welcome back" : mode === "forgot" ? "Reset your password" : "Choose a new password";
  const description = mode === "register" ? "Build an evidence-based profile for the New Zealand technology market." : mode === "login" ? "Sign in to continue your market and evidence analysis." : mode === "forgot" ? "Enter your account email and we will send a reset link." : "Your new password must contain at least 12 characters.";
  return <div className="auth-page"><div className="auth-brand"><span className="auth-brand-mark"><CareerSignalMark size={30} /></span><strong>CareerSignal</strong>{onBack && <button className="auth-back" onClick={onBack}>Back to product overview</button>}</div><section className="auth-panel"><p className="auth-kicker">CareerSignal Tech NZ</p><h1>{title}</h1><p>{description}</p><form onSubmit={submit}>{mode === "register" && <label className="field"><span>Name</span><input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>}{mode !== "reset" && <label className="field"><span>Email</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>}{mode !== "forgot" && <label className="field"><span>Password</span><input required minLength={mode === "login" ? 1 : 12} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>}{(mode === "register" || mode === "reset") && <small>Use at least 12 characters.</small>}{mode === "login" && <button type="button" className="forgot-link" onClick={() => setMode("forgot")}>Forgot password?</button>}{message && <p className="success-message">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button auth-submit" disabled={submitting}>{submitting ? "Please wait..." : mode === "register" ? "Create account" : mode === "login" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Update password"}<ArrowRight size={15} /></button></form><div className="auth-switch">{mode === "register" ? "Already have an account?" : mode === "login" ? "New to CareerSignal?" : "Return to sign in"}<button onClick={() => { if (mode === "forgot" || mode === "reset") { setMode("login"); } else { onRoute(mode === "register" ? "/login" : "/register"); } setError(""); setMessage(""); }}>{mode === "register" ? "Sign in" : mode === "login" ? "Create account" : "Sign in"}</button></div></section><p className="auth-note"><ShieldCheck size={14} />Your private evidence is never published as market data.</p></div>;
}

function WelcomeScreen({ onChoose }: { onChoose: (mode: "login" | "register") => void }) {
  return <div className="welcome-page">
    <header className="welcome-nav">
      <div className="auth-brand"><span className="auth-brand-mark"><CareerSignalMark size={30} /></span><strong>CareerSignal</strong></div>
      <nav className="welcome-nav-links"><a href="#how-it-works">Product</a><a href="#evidence">Methodology</a></nav>
      <button className="welcome-login" onClick={() => onChoose("login")}>Sign in</button>
    </header>
    <main className="welcome-main">
      <section className="welcome-hero">
        <img className="welcome-hero-image" src="/images/auckland-skyline.jpg" alt="" aria-hidden="true" />
        <div className="welcome-hero-shade" aria-hidden="true"></div>
        <div className="welcome-hero-inner">
          <p className="welcome-location"><MapPin size={15} /> New Zealand technology careers</p>
          <h1>CareerSignal Tech NZ</h1>
          <p className="welcome-lede"><strong>Make career decisions from evidence, not job-title guesswork.</strong> Compare your demonstrated experience with current roles, skills and hiring signals across New Zealand.</p>
          <div className="welcome-actions">
            <button className="primary-button" onClick={() => onChoose("register")}>Create a career profile <ArrowRight size={15} /></button>
            <button className="welcome-secondary" onClick={() => onChoose("login")}>Sign in to your profile</button>
          </div>
        </div>
        <a className="welcome-photo-credit" href="https://unsplash.com/photos/OtP_YdrgDG4" target="_blank" rel="noreferrer">Auckland photograph by Timo Volz / Unsplash</a>
      </section>

      <div className="welcome-content">
        <section id="how-it-works" className="welcome-grid" aria-label="Product capabilities">
          <article><div className="welcome-capability-head"><span>01</span><FileText size={20} /></div><h2>Build an evidence profile</h2><p>Connect a CV and public GitHub projects, then approve the skills that are supported by real work.</p></article>
          <article><div className="welcome-capability-head"><span>02</span><BarChart3 size={20} /></div><h2>Understand the market</h2><p>Explore New Zealand job evidence by role, capability and location, with every finding linked to its source.</p></article>
          <article><div className="welcome-capability-head"><span>03</span><GitBranch size={20} /></div><h2>Plan your next move</h2><p>Compare adjacent roles and focus your next project on the evidence that employers are asking for.</p></article>
        </section>

        <section className="welcome-preview" aria-label="Product preview">
          <div className="preview-intro"><span className="journey-label">Working view</span><h2>Turn a job description into a decision</h2><p>The workspace keeps the role requirements, your evidence and the next action in one place.</p></div>
          <div className="preview-window">
            <div className="preview-window-bar"><span><i></i><i></i><i></i></span><small>Example role analysis</small><b>NZ</b></div>
            <div className="preview-window-body">
              <div className="preview-role"><span>Role decoder</span><h3>Data &amp; Systems Analyst</h3><p>Manukau · Graduate / Junior</p><div className="preview-tags"><em>Data analysis</em><em>SQL</em><em>ETL</em><em>Systems thinking</em></div></div>
              <div className="preview-score"><span>Match with your evidence</span><strong>74<small>/ 100</small></strong><div><i style={{width:"74%"}}></i></div><p>Strongest evidence: SQL, Python, data quality</p></div>
              <div className="preview-gap"><span>Next evidence to build</span><b>Automated testing</b><p>Add tests and a reproducible deployment example to strengthen this match.</p><button type="button" onClick={() => onChoose("register")}>Build a profile <ArrowRight size={13} /></button></div>
            </div>
          </div>
        </section>

        <section id="evidence" className="welcome-journey">
          <div><span className="journey-label">How it works</span><h2>One profile, grounded decisions</h2></div>
          <ol><li><strong>Set your target market</strong><span>Choose the role, location and career level you want to evaluate.</span></li><li><strong>Verify your evidence</strong><span>Review extracted CV and GitHub evidence before it enters your profile.</span></li><li><strong>Compare your options</strong><span>Use market demand and capability gaps to decide what to build next.</span></li></ol>
        </section>
        <p className="welcome-trust"><ShieldCheck size={17} />Your private evidence remains attached to your account and is never published as market data.</p>
      </div>
    </main>
  </div>;
}

function VerifyEmailScreen({ token, user, onVerified, onSignOut }: { token: string; user: SessionUser; onVerified: () => void; onSignOut: () => void }) {
  const search = new URLSearchParams(window.location.search);
  const verificationToken = search.get("token") ?? search.get("verify");
  const [status, setStatus] = useState<"waiting" | "verifying" | "sent" | "error">(verificationToken ? "verifying" : "waiting");

  useEffect(() => {
    if (!verificationToken) return;
    fetch(`${API_URL}/api/v1/auth/verify-email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: verificationToken }) })
      .then((response) => { if (!response.ok) throw new Error(); window.history.replaceState({}, "", window.location.pathname); onVerified(); })
      .catch(() => setStatus("error"));
  }, [verificationToken, onVerified]);

  async function resend() {
    setStatus("verifying");
    const response = await fetch(`${API_URL}/api/v1/auth/resend-verification`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    setStatus(response.ok ? "sent" : "error");
  }

  return <div className="auth-page"><div className="auth-brand"><span className="auth-brand-mark"><CareerSignalMark size={30} /></span><strong>CareerSignal</strong></div><section className="auth-panel verify-panel"><span className="verify-icon"><ShieldCheck size={22} /></span><p className="auth-kicker">Secure your account</p><h1>{status === "verifying" ? "Verifying your email..." : "Check your email"}</h1><p>We sent a verification link to <strong>{user.email}</strong>. Verify the address before creating a career profile.</p>{status === "sent" && <p className="success-message">A new link has been sent.</p>}{status === "error" && <p className="form-error">The link is invalid or expired. Request a new one.</p>}<button className="primary-button auth-submit" onClick={resend} disabled={status === "verifying"}>Resend verification email</button><button className="text-button verify-signout" onClick={onSignOut}>Sign out</button></section><p className="auth-note"><ShieldCheck size={14} />Verification links expire after 24 hours.</p></div>;
}

function NotFoundScreen({ authenticated = false, onHome }: { authenticated?: boolean; onHome: () => void }) {
  return <main className="not-found-page"><div className="auth-brand"><span className="auth-brand-mark"><CareerSignalMark size={30} /></span><strong>CareerSignal</strong></div><section><p className="auth-kicker">404 · Page not found</p><h1>This page is not part of your career workspace.</h1><p>The address may be outdated, or the page may have moved.</p><button className="primary-button" onClick={onHome}>{authenticated ? "Return to workspace" : "Return to home"}<ArrowRight size={15} /></button></section></main>;
}

export default function App() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState<RoleKey>("");
  const [location, setLocation] = useState("Auckland");
  const [seniority, setSeniority] = useState("Graduate / Junior");
  const [cv, setCv] = useState<File | null>(null);
  const [cvFilename, setCvFilename] = useState("");
  const [cvUploadId, setCvUploadId] = useState<string | null>(null);
  const [cvStatus, setCvStatus] = useState<string>("");
  const [cvFailureReason, setCvFailureReason] = useState<string | null>(null);
  const [cvLabel, setCvLabel] = useState("");
  const [cvTargetRole, setCvTargetRole] = useState<RoleKey>("");
  const [cvVersions, setCvVersions] = useState<UploadRecord[]>([]);
  const [suggestions, setSuggestions] = useState<EvidenceSuggestion[]>([]);
  const [confirmedSuggestions, setConfirmedSuggestions] = useState<Set<string>>(new Set());
  const [github, setGithub] = useState("");
  const [savedGithubUrls, setSavedGithubUrls] = useState<Set<string>>(new Set());
  const [githubProjects, setGithubProjects] = useState<GithubProject[]>([]);
  const [githubCandidates, setGithubCandidates] = useState<GithubCandidate[]>([]);
  const [selectedGithubUrls, setSelectedGithubUrls] = useState<Set<string>>(new Set());
  const [confirmedGithub, setConfirmedGithub] = useState<Set<string>>(new Set());
  const [portfolio, setPortfolio] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editingProfile, setEditingProfile] = useState(true);
  const [profileUpdatedAt, setProfileUpdatedAt] = useState<string | null>(null);
  const [roleFits, setRoleFits] = useState<RoleFitMap>({});
  const [roleFitsLoading, setRoleFitsLoading] = useState(false);
  const [roleFitsError, setRoleFitsError] = useState(false);
  const [roleFitsRefresh, setRoleFitsRefresh] = useState(0);
  const [selectedProfileRole, setSelectedProfileRole] = useState<Exclude<RoleKey, ""> | "">("");
  const [personalEvidence, setPersonalEvidence] = useState<SkillEvidence[]>([]);
  const view = routeViews[routerLocation.pathname];
  const [decoderTitle, setDecoderTitle] = useState("");
  const [decoderDescription, setDecoderDescription] = useState("");
  const [decodedRole, setDecodedRole] = useState<DecodedRole | null>(null);
  const [decodingJob, setDecodingJob] = useState(false);
  const [decoderFocus, setDecoderFocus] = useState<"all" | Exclude<RoleKey, "">>("all");
  const [market, setMarket] = useState<MarketSummary | null>(null);
  const [marketQuality, setMarketQuality] = useState<MarketQuality | null>(null);
  const [evidenceQuery, setEvidenceQuery] = useState("");
  const [evidenceResults, setEvidenceResults] = useState<EvidenceResult[] | null>(null);
  const [searchingEvidence, setSearchingEvidence] = useState(false);
  const [judgedEvidence, setJudgedEvidence] = useState<Set<string>>(new Set());
  const [retrievalQuality, setRetrievalQuality] = useState<{ labelled_count: number; relevant_count: number; relevance_rate: number | null; relevant_mean_rank: number | null } | null>(null);
  const [aiExplanation, setAiExplanation] = useState<{ answer: string; model: string } | null>(null);
  const [explainingEvidence, setExplainingEvidence] = useState(false);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [comparisonJobIds, setComparisonJobIds] = useState<string[]>([]);
  const [comparisonDetails, setComparisonDetails] = useState<AnalysisDetailsMap>({});
  const [comparisonDetailsLoading, setComparisonDetailsLoading] = useState(false);
  const [comparisonDetailsError, setComparisonDetailsError] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobHistory, setJobHistory] = useState<JobStatusEvent[]>([]);
  const [historyJobId, setHistoryJobId] = useState<string | null>(null);
  const [loadingJobHistory, setLoadingJobHistory] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<JobAnalysisSummary[]>([]);
  const [profileEvidenceFilter, setProfileEvidenceFilter] = useState<EvidenceRoleFilter>("all");

  useEffect(() => {
    const search = new URLSearchParams(routerLocation.search);
    const legacyVerify = search.get("verify");
    const legacyReset = search.get("reset");
    if (routerLocation.pathname === "/" && legacyVerify) navigate(`/verify-email?token=${encodeURIComponent(legacyVerify)}`, { replace: true });
    if (routerLocation.pathname === "/" && legacyReset) navigate(`/reset-password?token=${encodeURIComponent(legacyReset)}`, { replace: true });
  }, [navigate, routerLocation.pathname, routerLocation.search]);

  useEffect(() => {
    const label = view ? routeTitles[view] : routerLocation.pathname === "/" ? "Career intelligence" : "CareerSignal";
    document.title = `${label} | CareerSignal Tech NZ`;
  }, [routerLocation.pathname, view]);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/auth/refresh`, { method: "POST", credentials: "include" })
      .then(async (response) => response.ok ? response.json() : Promise.reject())
      .then((data) => { setToken(data.access_token); setUser(data.user); })
      .catch(() => undefined)
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!token || !user?.is_verified) return;
    let active = true;
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API_URL}/api/v1/profile`, { headers }),
      fetch(`${API_URL}/api/v1/evidence/uploads`, { headers }),
    ]).then(async ([profileResponse, uploadsResponse]) => {
      if (!active) return;
      if (uploadsResponse.ok) {
        const uploads: UploadRecord[] = await uploadsResponse.json();
        setCvVersions(uploads);
        const current = uploads.find((item) => !["failed", "rejected", "scan_failed", "parse_failed"].includes(item.status));
        if (current) {
          setCvUploadId(current.id);
          setCvFilename(current.original_filename);
          setCvStatus(current.status);
          setCvFailureReason(current.failure_reason ?? null);
          setCvLabel(current.cv_label ?? "");
          setCvTargetRole((current.target_role as RoleKey) || "");
        }
      }
      if (!profileResponse.ok) {
        setEditingProfile(true);
        return;
      }
      const profile: ProfileData = await profileResponse.json();
      setRole(profile.role_family);
      setLocation(profile.location);
      setSeniority(profile.seniority);
      setProfileUpdatedAt(profile.updated_at);
      const githubSources = expandGithubSources(profile.evidence_sources.filter((item) => item.source_type === "github").map((item) => item.source_reference));
      const portfolioSource = profile.evidence_sources.find((item) => item.source_type === "portfolio");
      setGithub(githubSources.join(", "));
      setSavedGithubUrls(new Set(githubSources.map(normalizeSourceUrl)));
      setPortfolio(portfolioSource?.source_reference ?? "");
      setSaved(true);
      setEditingProfile(false);
    }).catch(() => {
      if (active) setError("Your saved profile could not be loaded.");
    }).finally(() => { if (active) setLoadingProfile(false); });
    return () => { active = false; };
  }, [token, user?.is_verified]);

  useEffect(() => {
    if (!token || !cvUploadId || !["queued_for_scan", "scanning", "queued_for_parsing", "parsing"].includes(cvStatus)) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`${API_URL}/api/v1/evidence/uploads`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) return;
      const uploads = await response.json();
      const current = uploads.find((upload: { id: string }) => upload.id === cvUploadId);
       if (current) { setCvStatus(current.status); setCvFailureReason(current.failure_reason ?? null); }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [token, cvUploadId, cvStatus]);

  useEffect(() => {
    if (!token || !cvUploadId || cvStatus !== "awaiting_review") return;
    fetch(`${API_URL}/api/v1/evidence/uploads/${cvUploadId}/extraction`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        setSuggestions(data.suggestions);
        setConfirmedSuggestions(new Set(data.suggestions.map((item: EvidenceSuggestion) => item.id)));
      })
      .catch(() => setError("The CV was parsed, but its evidence could not be loaded."));
  }, [token, cvUploadId, cvStatus]);

  useEffect(() => {
    if (!token || !view || !["market", "path"].includes(view)) return;
    let active = true;
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API_URL}/api/v1/market/summary`, { headers }),
      fetch(`${API_URL}/api/v1/market/quality`, { headers }),
    ]).then(async ([summaryResponse, qualityResponse]) => {
      if (!active) return;
      if (summaryResponse.ok) setMarket(await summaryResponse.json());
      if (qualityResponse.ok) setMarketQuality(await qualityResponse.json());
    }).catch(() => {
      if (active) setError("Market data could not be loaded.");
    });
    return () => { active = false; };
  }, [token, view]);

  useEffect(() => {
    if (!token || !view || !["workspace", "jobs", "decoder"].includes(view)) return;
    let active = true;
    // This state mirrors an explicit route transition while the persisted records are fetched.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingJobs(true);
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API_URL}/api/v1/jobs`, { headers }),
      fetch(`${API_URL}/api/v1/role-decoder/history`, { headers }),
    ]).then(async ([jobsResponse, historyResponse]) => {
      if (!active) return;
      if (jobsResponse.ok) setSavedJobs(await jobsResponse.json());
      if (historyResponse.ok) setAnalysisHistory(await historyResponse.json());
    }).catch(() => {
      if (active) setError("Your saved job activity could not be loaded.");
    }).finally(() => {
      if (active) setLoadingJobs(false);
    });
    return () => { active = false; };
  }, [token, view]);

  useEffect(() => {
    if (!token || view !== "jobs" || comparisonJobIds.length < 2) {
      setComparisonDetails({});
      setComparisonDetailsLoading(false);
      setComparisonDetailsError(false);
      return;
    }
    let active = true;
    const selectedJobs = savedJobs.filter((job) => comparisonJobIds.includes(job.id));
    if (!selectedJobs.length) {
      setComparisonDetails({});
      setComparisonDetailsLoading(false);
      setComparisonDetailsError(false);
      return;
    }
    setComparisonDetailsLoading(true);
    setComparisonDetailsError(false);
    const headers = { Authorization: `Bearer ${token}` };
    (async () => {
      const results = await Promise.allSettled(selectedJobs.map(async (job) => {
        let current = job;
        if (!current.analysis_id) {
          const ensureResponse = await fetch(`${API_URL}/api/v1/jobs/${job.id}/analysis`, { method: "POST", headers });
          const ensured = await apiPayload(ensureResponse) as SavedJob | { detail?: unknown } | null;
          if (!ensureResponse.ok || !ensured || !("id" in ensured)) throw new Error(apiError(ensured, "Saved job could not be prepared for comparison"));
          current = ensured as SavedJob;
        }
        const response = await fetch(`${API_URL}/api/v1/role-decoder/history/${current.analysis_id}`, { headers });
        if (!response.ok) throw new Error(`Saved analysis request failed: ${response.status}`);
        const payload = await response.json() as { result?: DecodedRole };
        if (!payload.result) throw new Error("Saved analysis result missing");
        return { id: job.id, job: current, result: payload.result };
      }));
      if (!active) return;
      const next: AnalysisDetailsMap = {};
      let failed = false;
      const updatedJobs = new Map<string, SavedJob>();
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          next[result.value.id] = result.value.result;
          updatedJobs.set(result.value.job.id, result.value.job);
        } else failed = true;
      });
      if (updatedJobs.size) setSavedJobs((current) => current.map((job) => updatedJobs.get(job.id) ?? job));
      setComparisonDetails(next);
      setComparisonDetailsError(failed);
    })().catch(() => {
      if (active) setComparisonDetailsError(true);
    }).finally(() => {
      if (active) setComparisonDetailsLoading(false);
    });
    return () => { active = false; };
  }, [comparisonJobIds, savedJobs, token, view]);

  useEffect(() => {
    if (!token || !["graph", "path"].includes(view ?? "") || !role) return;
    let active = true;
    const headers = { Authorization: `Bearer ${token}` };
    const roleKeys = Object.keys(roles) as Exclude<RoleKey, "">[];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRoleFitsLoading(true);
    setRoleFitsError(false);
    Promise.allSettled(roleKeys.map(async (roleKey) => {
      const response = await fetch(`${API_URL}/api/v1/evidence/fit?role_family=${encodeURIComponent(roleKey)}`, { headers });
      if (!response.ok) throw new Error(`Role fit request failed: ${response.status}`);
      return [roleKey, await response.json() as RoleFit] as const;
    })).then((results) => {
      if (!active) return;
      const nextFits: RoleFitMap = {};
      results.forEach((result) => { if (result.status === "fulfilled") nextFits[result.value[0]] = result.value[1]; });
      setRoleFits(nextFits);
      setSelectedProfileRole((current) => current || role);
      if (!Object.keys(nextFits).length) setRoleFitsError(true);
    }).catch(() => { if (active) setRoleFitsError(true); })
      .finally(() => { if (active) setRoleFitsLoading(false); });
    return () => { active = false; };
  }, [role, roleFitsRefresh, token, view]);

  useEffect(() => {
    if (!token || !["graph", "workspace"].includes(view ?? "")) return;
    let active = true;
    const graphRole = role || "software";
    fetch(`${API_URL}/api/v1/evidence/graph?role_family=${encodeURIComponent(graphRole)}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<{ evidence: SkillEvidence[] }>;
      })
      .then((data) => { if (active) setPersonalEvidence(dedupeSkillEvidence(data.evidence ?? [])); })
      .catch(() => { if (active) setError("Your capability evidence could not be loaded."); });
    return () => { active = false; };
  }, [role, token, view]);

  async function uploadCv(file: File) {
    if (!token) return;
    setError("");
    setCv(file);
    setCvFilename(file.name);
    setCvStatus("uploading");
    const contentType = file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    try {
      const initiated = await fetch(`${API_URL}/api/v1/evidence/uploads`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ filename: file.name, content_type: contentType, size: file.size, cv_label: cvLabel.trim() || null, target_role: cvTargetRole || role || null }) });
      const upload = await initiated.json();
      if (!initiated.ok) throw new Error(apiError(upload, "Could not prepare upload"));
      setCvUploadId(upload.id);
      setCvFailureReason(null);
      const stored = await fetch(upload.upload_url, { method: "PUT", headers: { "Content-Type": contentType, "x-amz-meta-expected-size": String(file.size) }, body: file });
      if (!stored.ok) throw new Error("Object storage rejected the upload");
      const completed = await fetch(`${API_URL}/api/v1/evidence/uploads/${upload.id}/complete`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const result = await completed.json();
      if (!completed.ok) throw new Error(apiError(result, "Could not complete upload"));
      setCvStatus(result.status);
      setCvFailureReason(result.failure_reason ?? null);
      setCvVersions((current) => [{ ...result, cv_label: result.cv_label ?? (cvLabel.trim() || null), target_role: result.target_role ?? (cvTargetRole || role || null) }, ...current.filter((item) => item.id !== result.id)]);
    } catch (caught) {
      setCvStatus("failed");
      setError(caught instanceof Error ? caught.message : "Upload failed");
    }
  }

  async function removeCv() {
    if (token && cvUploadId) await fetch(`${API_URL}/api/v1/evidence/uploads/${cvUploadId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setCv(null);
    setCvFilename("");
    setCvUploadId(null);
    setCvStatus("");
    setCvFailureReason(null);
    setCvLabel("");
    setCvTargetRole("");
    setSuggestions([]);
    setConfirmedSuggestions(new Set());
  }

  async function retryCv() {
    if (!token || !cvUploadId) return;
    const response = await fetch(`${API_URL}/api/v1/evidence/uploads/${cvUploadId}/retry`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const result = await apiPayload(response) as UploadRecord | { detail?: unknown } | null;
    if (!response.ok) { setError(apiError(result, "This CV could not be retried")); return; }
    const upload = result as UploadRecord;
    setCvStatus(upload.status);
    setCvFailureReason(upload.failure_reason ?? null);
    setError("");
  }

  async function saveProfile() {
    if (!token || !role || savingProfile) return;
    setError("");
    setSavingProfile(true);
    try {
      if (cvUploadId && cvStatus === "awaiting_review") {
        const review = await fetch(`${API_URL}/api/v1/evidence/uploads/${cvUploadId}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ decisions: suggestions.map((item) => ({ suggestion_id: item.id, decision: confirmedSuggestions.has(item.id) ? "confirmed" : "rejected" })) }),
        });
        const reviewed = await apiPayload(review) as UploadRecord | { detail?: unknown } | null;
        if (!review.ok) throw new Error(apiError(reviewed, `Evidence review failed (${review.status})`));
        setCvStatus((reviewed as UploadRecord).status);
      }
      for (const githubProject of githubProjects.filter((item) => item.status === "awaiting_review")) {
        const review = await fetch(`${API_URL}/api/v1/evidence/github/${githubProject.id}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ decisions: githubProject.suggestions.map((item) => ({ suggestion_id: item.id, decision: confirmedGithub.has(item.id) ? "confirmed" : "rejected" })) }),
        });
        const reviewed = await apiPayload(review) as GithubProject | { detail?: unknown } | null;
        if (!review.ok) throw new Error(apiError(reviewed, `GitHub evidence review failed (${review.status})`));
        const reviewedProject = reviewed as GithubProject;
        setGithubProjects((current) => current.map((item) => item.id === reviewedProject.id ? reviewedProject : item));
      }
      const githubUrls = github.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
      const evidence_sources = [
        ...githubUrls.map((url) => ({ source_type: "github", source_reference: url.startsWith("http") ? url : `https://${url}` })),
        ...(portfolio.trim() ? [{ source_type: "portfolio", source_reference: portfolio.startsWith("http") ? portfolio : `https://${portfolio}` }] : []),
      ];
      const response = await fetch(`${API_URL}/api/v1/profile`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ role_family: role, location, seniority, evidence_sources }) });
      const data = await apiPayload(response) as ProfileData | { detail?: unknown } | null;
      if (!response.ok) throw new Error(apiError(data, `Profile could not be saved (${response.status})`));
      const savedProfile = data as ProfileData;
      setSaved(true);
      setEditingProfile(false);
      setProfileUpdatedAt(savedProfile.updated_at);
      setSavedGithubUrls(new Set(githubUrls.map((url) => normalizeSourceUrl(url.startsWith("http") ? url : `https://${url}`))));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The evidence profile could not be created. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function logout() {
    await fetch(`${API_URL}/api/v1/auth/logout`, { method: "POST", credentials: "include" });
    setToken(null);
    setUser(null);
    setStep(1);
    setSaved(false);
    setEditingProfile(true);
    setRoleFits({});
    setSelectedProfileRole("");
    setPersonalEvidence([]);
    navigate("/login", { replace: true });
  }

  async function decodeJob(event: FormEvent) {
    event.preventDefault();
    setError("");
    setDecodingJob(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/role-decoder`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ title: decoderTitle, description: decoderDescription }) });
      const result = await response.json();
      if (!response.ok) { setError(apiError(result, "Could not decode this role")); return; }
      setDecodedRole(result);
      setDecoderFocus(result.scope_status === "mixed" ? result.role_family : "all");
      const historyResponse = await fetch(`${API_URL}/api/v1/role-decoder/history`, { headers: { Authorization: `Bearer ${token}` } });
      if (historyResponse.ok) setAnalysisHistory(await historyResponse.json());
    } catch {
      setError("The role could not be analysed. Check your connection and try again.");
    } finally {
      setDecodingJob(false);
    }
  }

  async function restoreAnalysis(analysisId: string) {
    if (!token) return;
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/v1/role-decoder/history/${analysisId}`, { headers: { Authorization: `Bearer ${token}` } });
      const result = await apiPayload(response) as { title?: string; description?: string; result?: DecodedRole; detail?: unknown } | null;
      if (!response.ok || !result?.result) throw new Error(apiError(result, "The saved analysis could not be restored"));
      setDecoderTitle(result.title ?? "");
      setDecoderDescription(result.description ?? "");
      setDecodedRole(result.result);
      setDecoderFocus(result.result.scope_status === "mixed" ? result.result.role_family : "all");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The saved analysis could not be restored");
    }
  }

  function openMarket() {
    navigate(productRoutes.market);
  }

  async function searchEvidence(event: FormEvent) {
    event.preventDefault();
    setSearchingEvidence(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/v1/rag/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: evidenceQuery, role_family: null, location: null, market_window_days: 180, limit: 8 }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(apiError(result, "Could not search market evidence"));
      setEvidenceResults(result.citations);
      setAiExplanation(null);
      const quality = await fetch(`${API_URL}/api/v1/rag/judgements/quality`, { headers: { Authorization: `Bearer ${token}` } });
      if (quality.ok) setRetrievalQuality(await quality.json());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not search market evidence");
    } finally {
      setSearchingEvidence(false);
    }
  }

  async function explainEvidence() {
    if (!evidenceResults?.length) return;
    setExplainingEvidence(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/v1/rag/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: evidenceQuery, role_family: null, location: null, market_window_days: 180, limit: 8 }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(apiError(result, "Could not generate an AI explanation"));
      setAiExplanation({ answer: result.answer, model: result.model });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not generate an AI explanation");
    } finally {
      setExplainingEvidence(false);
    }
  }

  async function judgeEvidence(item: EvidenceResult, relevant: boolean, rank: number) {
    const response = await fetch(`${API_URL}/api/v1/rag/judgements`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ citation_id: item.citation_id, query: evidenceQuery, role_family: role || null, location, result_rank: rank, relevant }),
    });
    if (response.ok) setJudgedEvidence((current) => new Set(current).add(item.citation_id));
  }

  async function saveEvidenceJob(item: EvidenceResult) {
    if (!token) return;
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/v1/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          source_url: item.source_url,
          title: item.title,
          company: item.company,
          location: item.location,
          role_family: role || null,
          description: item.excerpt,
        }),
      });
      const result = await apiPayload(response) as SavedJob | { detail?: unknown } | null;
      if (!response.ok) throw new Error(apiError(result, "The job could not be saved"));
      const savedJob = result as SavedJob;
      setSavedJobs((current) => [savedJob, ...current.filter((job) => job.id !== savedJob.id)]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The job could not be saved");
    }
  }

  async function saveDecodedJob() {
    if (!token || !decodedRole?.analysis_id) return;
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/v1/jobs/from-analysis/${decodedRole.analysis_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ location, company: "Employer not specified" }),
      });
      const result = await apiPayload(response) as SavedJob | { detail?: unknown } | null;
      if (!response.ok) throw new Error(apiError(result, "The role analysis could not be added to your tracker"));
      const savedJob = result as SavedJob;
      setSavedJobs((current) => [savedJob, ...current.filter((job) => job.id !== savedJob.id)]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The role analysis could not be added to your tracker");
    }
  }

  async function updateJobStatus(job: SavedJob, nextStatus: SavedJob["status"]) {
    if (!token) return;
    const previous = job.status;
    setSavedJobs((current) => current.map((item) => item.id === job.id ? { ...item, status: nextStatus } : item));
    try {
      const response = await fetch(`${API_URL}/api/v1/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await apiPayload(response) as SavedJob | { detail?: unknown } | null;
      if (!response.ok) throw new Error(apiError(result, "Application status could not be updated"));
      const updated = result as SavedJob;
      setSavedJobs((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (caught) {
      setSavedJobs((current) => current.map((item) => item.id === job.id ? { ...item, status: previous } : item));
      setError(caught instanceof Error ? caught.message : "Application status could not be updated");
    }
  }

  async function updateJobNotes(job: SavedJob, notes: string) {
    if (!token) return;
    const response = await fetch(`${API_URL}/api/v1/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ notes }),
    });
    const result = await apiPayload(response) as SavedJob | { detail?: unknown } | null;
    if (!response.ok) {
      setError(apiError(result, "Notes could not be saved"));
      return;
    }
    setSavedJobs((current) => current.map((item) => item.id === job.id ? result as SavedJob : item));
  }

  function toggleJobComparison(job: SavedJob) {
    setComparisonJobIds((current) => current.includes(job.id)
      ? current.filter((id) => id !== job.id)
      : current.length >= 3 ? current : [...current, job.id]);
  }

  function reviewSavedJob(job: SavedJob) {
    if (!job.analysis_id || !job.role_family || !(job.role_family in roles)) {
      setDecoderTitle(job.title);
      setDecoderDescription(job.description ?? "");
      navigate(productRoutes.decoder);
      return;
    }
    setSelectedProfileRole(job.role_family as Exclude<RoleKey, "">);
    navigate(productRoutes.graph);
  }

  async function toggleJobHistory(job: SavedJob) {
    if (!token) return;
    if (historyJobId === job.id) {
      setHistoryJobId(null);
      return;
    }
    setHistoryJobId(job.id);
    setJobHistory([]);
    setLoadingJobHistory(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/jobs/${job.id}/history`, { headers: { Authorization: `Bearer ${token}` } });
      const result = await apiPayload(response) as JobStatusEvent[] | { detail?: unknown } | null;
      if (!response.ok) throw new Error(apiError(result, "Application history could not be loaded"));
      setJobHistory(result as JobStatusEvent[]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Application history could not be loaded");
    } finally {
      setLoadingJobHistory(false);
    }
  }

  async function deleteJob(job: SavedJob) {
    if (!token || !window.confirm(`Remove ${job.title} from your application tracker?`)) return;
    const response = await fetch(`${API_URL}/api/v1/jobs/${job.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      const result = await apiPayload(response);
      setError(apiError(result, "The opportunity could not be removed"));
      return;
    }
    setSavedJobs((current) => current.filter((item) => item.id !== job.id));
    if (historyJobId === job.id) setHistoryJobId(null);
  }

  async function exportAccountData() {
    if (!token) return;
    const response = await fetch(`${API_URL}/api/v1/account/export`, { headers: { Authorization: `Bearer ${token}` } });
    const result = await apiPayload(response);
    if (!response.ok) {
      setError(apiError(result, "Your account export could not be created"));
      return;
    }
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `careersignal-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount(password: string) {
    if (!token) return;
    const response = await fetch(`${API_URL}/api/v1/account`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password }),
    });
    const result = await apiPayload(response);
    if (!response.ok) throw new Error(apiError(result, "The account could not be deleted"));
    setToken(null);
    setUser(null);
    setSaved(false);
    navigate("/", { replace: true });
  }

  if (checkingSession || (token && user?.is_verified && loadingProfile)) return <div className="session-loading"><span>CS</span><div><i /><i /><i /></div></div>;
  if (!token || !user) {
    if (routerLocation.pathname.startsWith("/app")) return <Navigate to={`/login?returnTo=${encodeURIComponent(`${routerLocation.pathname}${routerLocation.search}`)}`} replace />;
    if (routerLocation.pathname === "/") return <WelcomeScreen onChoose={(mode) => navigate(`/${mode}`)} />;
    if (["/login", "/register", "/reset-password", "/verify-email"].includes(routerLocation.pathname)) {
      const initialMode = routerLocation.pathname === "/register" ? "register" : routerLocation.pathname === "/reset-password" ? "reset" : "login";
      return <AuthScreen key={`${routerLocation.pathname}${routerLocation.search}`} initialMode={initialMode} onBack={() => navigate("/")} onRoute={(path) => navigate(path)} onAuthenticated={(accessToken, sessionUser) => {
        setToken(accessToken);
        setUser(sessionUser);
        const returnTo = new URLSearchParams(routerLocation.search).get("returnTo");
        const requestedPath = returnTo && routeViews[returnTo.split("?")[0]] ? returnTo : productRoutes.workspace;
        navigate(sessionUser.is_verified ? requestedPath : "/verify-email", { replace: true });
      }} />;
    }
    return <NotFoundScreen onHome={() => navigate("/")} />;
  }
  if (!user.is_verified) {
    if (routerLocation.pathname !== "/verify-email") return <Navigate to="/verify-email" replace />;
    return <VerifyEmailScreen token={token} user={user} onVerified={() => { setUser({ ...user, is_verified: true }); navigate(productRoutes.workspace, { replace: true }); }} onSignOut={logout} />;
  }
  if (routerLocation.pathname === "/app") return <Navigate to={productRoutes.workspace} replace />;
  if (["/", "/login", "/register", "/verify-email", "/reset-password"].includes(routerLocation.pathname)) {
    const returnTo = new URLSearchParams(routerLocation.search).get("returnTo");
    const target = returnTo && routeViews[returnTo.split("?")[0]] ? returnTo : productRoutes.workspace;
    return <Navigate to={target} replace />;
  }
  if (!view) return <NotFoundScreen authenticated onHome={() => navigate(productRoutes.workspace)} />;

  function continueFromTarget() {
    if (!role) {
      setError("Choose a target role to continue.");
      return;
    }
    setError("");
    setStep(2);
  }

  async function continueFromEvidence() {
    if (cvUploadId && ["uploading", "queued_for_scan", "scanning", "queued_for_parsing", "parsing", "failed", "rejected", "scan_failed", "parse_failed"].includes(cvStatus)) {
      setError("Wait for CV processing to finish, resolve the problem, or remove the file.");
      return;
    }
    if (!cvUploadId && !github.trim() && !portfolio.trim()) {
      setError("Add at least one evidence source, or skip this step and add evidence manually later.");
      return;
    }
    const enteredGithubUrls = github.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
    const hasOnlySavedGithub = enteredGithubUrls.length > 0 && enteredGithubUrls.every((url) => savedGithubUrls.has(normalizeSourceUrl(url)));
    if (/^https?:\/\/github\.com\/[^/]+\/?$/.test(github.trim()) && githubCandidates.length === 0 && !savedGithubUrls.has(normalizeSourceUrl(github))) {
      const response = await fetch(`${API_URL}/api/v1/evidence/github/profile?url=${encodeURIComponent(github.trim())}`, { headers: { Authorization: `Bearer ${token}` } });
      const candidates = await response.json();
      if (!response.ok) { setError(apiError(candidates, "Could not load GitHub repositories")); return; }
      setGithubCandidates(candidates);
      setSelectedGithubUrls(new Set(candidates.slice(0, 6).map((item: GithubCandidate) => item.url)));
      setError("Select the public repositories you want to use, then click Review evidence again.");
      return;
    }
    let githubValue = github;
    if (githubCandidates.length > 0) {
      if (!selectedGithubUrls.size) { setError("Select at least one GitHub repository."); return; }
      githubValue = Array.from(selectedGithubUrls).join(", ");
      setGithub(githubValue);
    }
    if (githubValue.trim() && githubProjects.length === 0 && !hasOnlySavedGithub) {
      const urls = githubValue.split(/[\n,]+/).map((item) => item.trim()).filter((item) => item && !savedGithubUrls.has(normalizeSourceUrl(item)));
      const projects: GithubProject[] = [];
      for (const rawUrl of urls) {
        const response = await fetch(`${API_URL}/api/v1/evidence/github`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ url: rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}` }) });
        const project = await response.json();
        if (!response.ok) { setError(apiError(project, `Could not inspect ${rawUrl}`)); return; }
        projects.push(project);
      }
      setGithubProjects(projects);
      setConfirmedGithub(new Set(projects.flatMap((project) => project.suggestions.map((item) => item.id))));
    }
    setError("");
    setStep(3);
  }

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
    <div className="product-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark" aria-hidden="true"><CareerSignalMark size={38} /></span><div><strong>CareerSignal</strong><small>Tech NZ</small></div></div>
        <nav aria-label="Product navigation">
          <div className="nav-group"><span>Orient</span>
            <button type="button" aria-current={view === "workspace" ? "page" : undefined} className={view === "workspace" ? "active" : ""} onClick={() => navigate(productRoutes.workspace)} title="Workspace"><LayoutDashboard size={17} />Workspace</button>
            <button type="button" aria-current={view === "market" ? "page" : undefined} className={view === "market" ? "active" : ""} onClick={openMarket} title="Market intelligence"><BarChart3 size={16} />Market</button>
          </div>
          <div className="nav-group"><span>Investigate</span>
            <button type="button" aria-current={view === "decoder" ? "page" : undefined} className={view === "decoder" ? "active" : ""} onClick={() => navigate(productRoutes.decoder)} title="Role decoder"><BriefcaseBusiness size={16} />Decode role</button>
            <button type="button" aria-current={view === "evidence" ? "page" : undefined} className={view === "evidence" ? "active" : ""} onClick={() => navigate(productRoutes.evidence)} title="Employer evidence"><Search size={16} />Evidence</button>
          </div>
          <div className="nav-group"><span>Act</span>
            <button type="button" aria-current={view === "path" ? "page" : undefined} className={view === "path" ? "active" : ""} onClick={() => navigate(productRoutes.path)} title="Career paths"><Target size={16} />Pathways</button>
            <button type="button" aria-current={view === "graph" ? "page" : undefined} className={view === "graph" ? "active" : ""} onClick={() => navigate(productRoutes.graph)} title="My capability profile"><FileText size={16} />Profile</button>
            <button type="button" aria-current={view === "jobs" ? "page" : undefined} className={view === "jobs" ? "active" : ""} onClick={() => navigate(productRoutes.jobs)} title="Application tracker"><ClipboardList size={16} />Applications{savedJobs.filter((job) => !["rejected", "archived"].includes(job.status)).length > 0 && <small className="nav-count">{savedJobs.filter((job) => !["rejected", "archived"].includes(job.status)).length}</small>}</button>
          </div>
        </nav>
        <div className="sidebar-target" aria-label="Current target">
          <span>Current target</span>
          <strong>{role ? roles[role] : "No target selected"}</strong>
          <small>{role ? `${location} · ${seniority}` : "Set a target in Workspace"}</small>
        </div>
        <div className="sidebar-bottom"><div className="account"><UserRound size={18} /><span className="account-name">{user.display_name}</span><button className="account-action" type="button" onClick={() => navigate(productRoutes.settings)} aria-label="Account settings" title="Account settings"><Settings size={15} /><span>Settings</span></button><button className="account-action account-logout" type="button" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={15} /><span>Sign out</span></button></div></div>
      </aside>

      <main id="main-content" tabIndex={-1}>
        <header className="topbar">
          <div className="mobile-brand"><CareerSignalMark size={34} /></div>
          <div className="topbar-context"><span className="topbar-section">CAREERSIGNAL</span><span className="topbar-separator">/</span><strong>{routeTitles[view]}</strong></div>
          <div className="topbar-status"><span className="status-dot" />NZ technology market<span className="topbar-divider" />{role ? roles[role] : "No target selected"}</div><button type="button" className="topbar-signout" onClick={logout}><LogOut size={14} />Sign out</button>
        </header>

        {view === "decoder" && <div className="tool-page">
          <header><p className="page-kicker-icon"><BriefcaseBusiness size={15} />Role analysis</p><h1>Compare a role with your evidence</h1><span>CareerSignal builds the capability profile from this advertisement, then checks your saved evidence against the same capabilities.</span></header>
          <section className="tool-panel decoder-workbench" aria-busy={decodingJob}>
            <form className="decoder-form" onSubmit={decodeJob}><div className="decoder-form-main"><label className="field"><span>Advertised title <small>Optional</small></span><input id="decoder-title" value={decoderTitle} onChange={(event) => setDecoderTitle(event.target.value)} placeholder="e.g. Graduate Data Engineer" /></label><label className="field"><span>Job advertisement</span><textarea id="decoder-description" required minLength={40} value={decoderDescription} onChange={(event) => setDecoderDescription(event.target.value)} placeholder="Paste the responsibilities and requirements from the job advertisement" /></label><button type="submit" className="primary-button" disabled={decodingJob}>{decodingJob ? "Analysing advertisement..." : "Compare with my profile"} {!decodingJob && <ArrowRight size={15} />}</button></div><aside className="decoder-process"><span className="panel-kicker">Analysis flow</span><h2><ListChecks size={18} />What CareerSignal extracts</h2><ol><li><b><Compass size={15} /></b><span><strong>Role scope</strong><small>Identify the closest technical families and seniority.</small></span></li><li><b><Layers3 size={15} /></b><span><strong>JD requirements</strong><small>Keep skills and hard conditions tied to the advertisement.</small></span></li><li><b><Network size={15} /></b><span><strong>Evidence comparison</strong><small>Compare the JD signals with your saved CV and project evidence.</small></span></li></ol><p>Your profile is reused automatically. No re-upload is needed for each job.</p></aside></form>
            {decodedRole && <div className="decoder-result">
              <div className="decoder-summary"><span><small>Analysis</small><h2>{decodedRole.role_label}</h2></span><span><small>Seniority</small><strong>{decodedRole.seniority}</strong></span><span><small>Closest family match</small><strong>{Math.round(decodedRole.role_matches[0]?.match_score ?? 0)}%</strong></span><button type="button" className="secondary-button" onClick={saveDecodedJob}><Bookmark size={15} />Add to tracker</button></div>
              {decodedRole.eligibility_requirements?.length > 0 && <section className="eligibility-panel" aria-labelledby="eligibility-heading">
                <div className="eligibility-heading"><span className="eligibility-icon"><ShieldCheck size={19} /></span><div><h3 id="eligibility-heading">Application requirements</h3><p>Confirm these conditions before applying. They are taken directly from the advertisement and are not included in the capability match.</p></div></div>
                <div className="eligibility-list">{decodedRole.eligibility_requirements.map((requirement, index) => <div className="eligibility-row" key={`${requirement.category}-${index}`}><div><strong>{requirement.label}</strong><span className={`requirement-level ${requirement.importance}`}>{requirement.importance === "required" ? "Required" : requirement.importance === "preferred" ? "Preferred" : "Stated condition"}</span></div><q>{requirement.excerpt}</q></div>)}</div>
              </section>}
              <div className="role-match-panel">
                <header><div><span className="panel-kicker">Role-family comparison</span><h3>Where this advertisement sits</h3><p>Independent proximity signals, not shares of a forced classification.</p></div><span className="role-match-count">{decodedRole.role_matches.length} families compared</span></header>
                <div className="role-match-list">{decodedRole.role_matches.map((item, index) => <article className={`role-match-item${index === 0 ? " leading" : ""}`} key={item.role_family}><div className="role-match-item-head"><span className="role-match-rank">0{index + 1}</span><RoleFamilyIcon roleKey={item.role_family} size={17} /><strong>{item.role_label}</strong><span>{index === 0 ? "Closest match" : "Adjacent signal"}</span></div><div className="role-match-meter"><i><u style={{ width: `${Math.max(4, Math.min(100, item.match_score))}%` }} /></i><b>{Math.round(item.match_score)}%</b></div></article>)}</div>
                {(decodedRole.scope_status !== "matched" || decodedRole.unmapped_skills.length > 0) && <p className="scope-note">{scopeMessage(decodedRole.scope_status)} {decodedRole.unmapped_skills.length > 0 ? `Additional capabilities identified: ${decodedRole.unmapped_skills.join(", ")}.` : ""}</p>}
              </div>
              <div className="comparison-title"><h3>JD capabilities vs your evidence</h3><p>The radar axes are selected from this advertisement itself. Skills that are absent from the JD are not inserted from a role template.</p>{decodedRole.scope_status === "mixed" && <div className="jd-focus" role="group" aria-label="Radar focus"><button type="button" aria-pressed={decoderFocus === "all"} className={decoderFocus === "all" ? "active" : ""} onClick={() => setDecoderFocus("all")}>Full JD</button>{decodedRole.role_matches.filter((item) => item.match_score >= 35).slice(0, 3).map((item) => <button type="button" aria-pressed={decoderFocus === item.role_family} className={decoderFocus === item.role_family ? "active" : ""} key={item.role_family} onClick={() => setDecoderFocus(item.role_family)}>{item.role_label}</button>)}</div>}</div>
              <RoleComparisonRadar skillDemands={decodedRole.skill_demands} focus={decoderFocus} />
            </div>}
            {analysisHistory.length > 0 && <details className="analysis-history"><summary><span><History size={15} /><strong>Recent role analyses</strong><small>Saved to your workspace</small></span><ChevronDown size={16} /></summary><div>{analysisHistory.slice(0, 5).map((analysis) => <button type="button" key={analysis.id} onClick={() => restoreAnalysis(analysis.id)}><span><strong>{analysis.title || "Untitled advertisement"}</strong><small>{analysis.role_family} · {new Date(analysis.created_at).toLocaleDateString("en-NZ")}</small></span><b>{Math.round(analysis.confidence)}%</b></button>)}</div></details>}
            {error && <p className="form-error" role="alert">{error}</p>}
          </section>
        </div>}
         {view === "evidence" && <div className="tool-page"><header><p className="page-kicker-icon"><Search size={15} />Employer evidence</p><h1>Search current hiring demand</h1><span>Ask a market question and review the underlying New Zealand job records behind the answer.</span></header><section className="tool-panel evidence-search" aria-busy={searchingEvidence || explainingEvidence}><form onSubmit={searchEvidence}><label className="field"><span>Market question or capability</span><input id="evidence-query" required minLength={3} maxLength={500} value={evidenceQuery} onChange={(event) => setEvidenceQuery(event.target.value)} placeholder="e.g. testing expectations for junior data engineers" /></label><button type="submit" className="primary-button" disabled={searchingEvidence}><Search size={15} />{searchingEvidence ? "Searching..." : "Search evidence"}</button></form>{retrievalQuality?.labelled_count ? <div className="retrieval-quality" aria-live="polite"><span>Feedback labels <b>{retrievalQuality.labelled_count}</b></span><span>Relevant <b>{Math.round((retrievalQuality.relevance_rate ?? 0) * 100)}%</b></span><span>Mean relevant rank <b>{retrievalQuality.relevant_mean_rank ?? "-"}</b></span></div> : null}{evidenceResults && evidenceResults.length > 0 && <div className="ai-action"><div><strong>Summarise the findings</strong><span>Create a concise interpretation using only these job records and citations.</span></div><button type="button" className="secondary-button" onClick={explainEvidence} disabled={explainingEvidence}>{explainingEvidence ? "Analysing..." : "Generate summary"}</button></div>}{aiExplanation && <article className="ai-explanation" aria-live="polite"><div><span>Market summary</span><small>{aiExplanation.model}</small></div><p>{aiExplanation.answer}</p></article>}{evidenceResults && <div className="citation-list">{evidenceResults.length ? evidenceResults.map((item, index) => <article className="citation-card" key={item.citation_id}><header className="citation-card-header"><div className="citation-reference"><b>J{index + 1}</b><span><strong>{item.company}</strong><small>{item.location}</small></span></div><span className="citation-date">{item.published_at ? new Date(item.published_at).toLocaleDateString("en-NZ") : "Date unavailable"}</span></header><div className="citation-card-body"><h2>{item.title}</h2><p className="citation-preview">{evidencePreview(item.excerpt)}</p>{item.excerpt.length > 260 && <details className="citation-excerpt"><summary>Read full evidence excerpt</summary><p>{item.excerpt}</p></details>}</div><footer className="citation-card-footer"><div className="citation-feedback"><span className="citation-footer-label">Relevance</span>{judgedEvidence.has(item.citation_id) ? <span className="feedback-saved">Feedback saved</span> : <><button type="button" onClick={() => judgeEvidence(item, true, index + 1)}>Relevant</button><button type="button" onClick={() => judgeEvidence(item, false, index + 1)}>Not relevant</button></>}</div><div className="citation-actions"><button type="button" className="citation-save" disabled={savedJobs.some((job) => job.source_url.replace(/\/$/, "") === item.source_url.replace(/\/$/, ""))} onClick={() => saveEvidenceJob(item)}><Bookmark size={13} />{savedJobs.some((job) => job.source_url.replace(/\/$/, "") === item.source_url.replace(/\/$/, "")) ? "Saved" : "Save role"}</button><a href={item.source_url} target="_blank" rel="noreferrer">View source <ArrowRight size={13} /></a></div></footer></article>) : <div className="market-empty"><Search size={24} /><h2>No matching indexed evidence</h2><p>Try a broader query or remove the current role and location filters from your career profile.</p></div>}</div>}{error && <p className="form-error" role="alert">{error}</p>}</section></div>}
        {view === "market" && <MarketView key={role || "default-market"} market={market} quality={marketQuality} targetRole={role} navigate={navigate} />}
        {view === "path" && <CareerPathView key={role || "empty"} role={role} market={market} roleFits={roleFits} navigate={navigate} onSelectRole={setSelectedProfileRole} />}
        {view === "graph" && <CapabilityProfileView role={role} evidence={personalEvidence} roleFits={roleFits} roleFitsLoading={roleFitsLoading} roleFitsError={roleFitsError} onRetryRoleFits={() => setRoleFitsRefresh((current) => current + 1)} selectedRole={selectedProfileRole} onSelectRole={setSelectedProfileRole} evidenceFilter={profileEvidenceFilter} onSelectEvidenceFilter={setProfileEvidenceFilter} navigate={navigate} />}
        {view === "route" && <Navigate to={productRoutes.graph} replace />}
        {view === "jobs" && <JobsView jobs={savedJobs} loading={loadingJobs} history={jobHistory} historyJobId={historyJobId} historyLoading={loadingJobHistory} comparisonJobIds={comparisonJobIds} comparisonDetails={comparisonDetails} comparisonDetailsLoading={comparisonDetailsLoading} comparisonDetailsError={comparisonDetailsError} onToggleCompare={toggleJobComparison} onClearCompare={() => setComparisonJobIds([])} onHistory={toggleJobHistory} onStatus={updateJobStatus} onNotes={updateJobNotes} onDelete={deleteJob} onReview={reviewSavedJob} navigate={navigate} />}
        {view === "settings" && <AccountSettingsView user={user} onExport={exportAccountData} onDelete={deleteAccount} />}
        {view === "workspace" && <div className="setup-page">
          {(!saved || editingProfile || !role) && <header className="setup-header workspace-page-header">
            <p className="page-kicker-icon"><UserRound size={15} />Career profile</p>
            <h1>{saved && !editingProfile && role ? roles[role] : "Build your market profile"}</h1>
            <span>{saved && !editingProfile ? "Your saved evidence is reused across role analysis, career paths and market comparisons." : "Set a target market, add evidence of your work and review what can be demonstrated."}</span>
          </header>}

          {saved && !editingProfile && role ? <section className="workspace-brief">
            <header className="brief-header">
              <div className="brief-heading"><div className="brief-state"><CircleGauge size={14} />Personal capability workspace</div><h1>Your evidence, ready for different technical directions</h1><p>A portable record of the skills you can currently prove. Compare it with role families only when you are ready to choose a direction.</p></div>
              <div className="brief-actions"><button className="secondary-button" onClick={() => { setEditingProfile(true); setStep(2); }}><FileCheck2 size={15} />Manage evidence</button><button className="primary-button" onClick={() => navigate(productRoutes.graph)}><Network size={15} />Compare role families</button></div>
            </header>
            <dl className="brief-context" aria-label="Analysis context">
              <div><dt><Network size={14} />Confirmed skills</dt><dd>{personalEvidence.length}</dd></div>
              <div><dt><FileCheck2 size={14} />Evidence sources</dt><dd>{[cvUploadId, github, portfolio].filter(Boolean).length}</dd></div>
              <div><dt><MapPin size={14} />Market context</dt><dd>{location} · {seniority}</dd></div>
              <div><dt><CalendarDays size={14} />Reviewed</dt><dd>{profileUpdatedAt ? new Date(profileUpdatedAt).toLocaleDateString("en-NZ") : "Not yet"}</dd></div>
            </dl>
            {personalEvidence.length ? <section className="workspace-snapshot"><div className="snapshot-heading"><span className="panel-kicker">Evidence snapshot</span><h2>{personalEvidence.length} capabilities are ready for review</h2><p>Workspace keeps the operational record concise. Open Profile for the network, maturity analysis, source triangulation and role-family comparisons.</p></div><div className="snapshot-metrics"><div><strong>{personalEvidence.filter((item) => item.evidence_level >= 3).length}</strong><span>implemented or verified</span></div><div><strong>{new Set(personalEvidence.map((item) => item.source_type)).size}</strong><span>evidence source types</span></div><div><strong>{new Set(personalEvidence.map((item) => item.category)).size}</strong><span>capability domains</span></div></div><button className="primary-button" onClick={() => navigate(productRoutes.graph)}><Network size={15} />Open capability report <ArrowRight size={14} /></button></section> : <section className="brief-loading"><FileText size={20} /><div><h2>Build your personal evidence record</h2><p>Confirm CV or GitHub evidence to make the full capability report available.</p></div><button className="secondary-button" onClick={() => { setEditingProfile(true); setStep(2); }}>Manage evidence</button></section>}
            <section className="evidence-register">
              <div className="register-heading"><div><span>Evidence register</span><h2>Sources used in this brief</h2></div><button className="text-button" onClick={() => { setEditingProfile(true); setStep(2); }}>Update sources <ArrowRight size={14} /></button></div>
              <div className="register-table" role="table" aria-label="Evidence sources">
                <div className="register-row register-labels" role="row"><span>Source</span><span>Record</span><span>Status</span></div>
                <div className="register-row" role="row"><span><FileText size={16} />CV or resume</span><strong>{cvFilename || "No CV added"}</strong><small className={cvUploadId ? "source-ready" : "source-empty"}>{cvUploadId ? cvStatus.replaceAll("_", " ") : "Not connected"}</small></div>
                <div className="register-row" role="row"><span><GitBranch size={16} />GitHub</span><strong>{githubProjects.length ? `${githubProjects.length} reviewed repositor${githubProjects.length === 1 ? "y" : "ies"}` : github ? "Profile connected" : "No profile added"}</strong><small className={github ? "source-ready" : "source-empty"}>{github ? "Public evidence" : "Not connected"}</small></div>
                <div className="register-row" role="row"><span><Link2 size={16} />Portfolio</span><strong>{portfolio || "No portfolio link"}</strong><small className={portfolio ? "source-ready" : "source-empty"}>{portfolio ? "Public evidence" : "Optional"}</small></div>
              </div>
            </section>
             <footer className="brief-method"><ShieldCheck size={17} /><p><strong>How to use this workspace</strong> The network records evidence independently of any role. Profile shows how the same evidence aligns with Software, Data, AI and Cloud role families.</p><button className="text-button" onClick={() => navigate(productRoutes.graph)}>Open full capability report</button></footer>
          </section> : <>
          <ol className="stepper" aria-label="Profile setup progress">
            {["Career target", "Evidence sources", "Review"].map((label, index) => {
              const number = (index + 1) as Step;
              return <li className={step === number ? "current" : step > number ? "complete" : ""} key={label}><i>{step > number ? <Check size={13} /> : number}</i><span>{label}</span></li>;
            })}
          </ol>

          <section className="setup-panel">
            {step === 1 && <>
              <div className="panel-title"><span className="panel-icon"><Target size={20} /></span><div><h2>Set your target market</h2><p>Your role, location and career level define the benchmark used throughout CareerSignal.</p></div></div>
              <div className="form-grid">
                <label className="field full"><span>Target role</span><div className="select-control"><select value={role} onChange={(event) => setRole(event.target.value as RoleKey)}><option value="">Select a role family</option>{Object.entries(roles).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select><ChevronDown size={16} /></div></label>
                <label className="field"><span>Location</span><div className="input-control"><MapPin size={16} /><input value={location} onChange={(event) => setLocation(event.target.value)} /></div></label>
                <label className="field"><span>Career level</span><div className="select-control"><select value={seniority} onChange={(event) => setSeniority(event.target.value)}><option>Graduate / Junior</option><option>Intermediate</option><option>Senior</option><option>Lead / Manager</option></select><ChevronDown size={16} /></div></label>
              </div>
              <div className="scope-note"><ShieldCheck size={18} /><div><strong>Scores are context-bound</strong><p>Changing the role, location or level creates a different assessment. CareerSignal does not produce a universal ability score.</p></div></div>
            </>}

            {step === 2 && <>
              <div className="panel-title"><span className="panel-icon"><FileText size={20} /></span><div><h2>Add evidence of your work</h2><p>Use one or more sources. You will review extracted evidence before it affects your profile.</p></div></div>
              <div className="source-list">
                 <div className={`source-row ${cvUploadId ? "added" : ""}`}><span className="source-icon"><FileText size={19} /></span><div><strong>CV or resume</strong><p>{cvUploadId ? `${cvFilename || cv?.name || "Saved CV"} · ${cvStatus.replaceAll("_", " ")}` : "PDF or DOCX, up to 10 MB"}</p>{cvFailureReason && <small className="source-error">{cvFailureReason}</small>}</div>{cvUploadId ? <span className="source-actions">{["scan_failed", "parse_failed"].includes(cvStatus) && <button className="text-button" type="button" onClick={retryCv}><RefreshCw size={14} />Retry</button>}<button className="icon-action" aria-label="Remove CV" onClick={removeCv}><X size={17} /></button></span> : <label className="upload-button"><UploadCloud size={15} />Choose file<input type="file" accept=".pdf,.docx" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadCv(file); }} /></label>}</div>
                 <div className="cv-version-fields"><label className="field"><span>CV label</span><input value={cvLabel} onChange={(event) => setCvLabel(event.target.value)} placeholder="e.g. Data Engineer version" /></label><label className="field"><span>Target role</span><div className="select-control"><select value={cvTargetRole} onChange={(event) => setCvTargetRole(event.target.value as RoleKey)}><option value="">Use workspace role</option>{Object.entries(roles).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select><ChevronDown size={16} /></div></label></div>
                 {cvVersions.length > 0 && <div className="cv-version-list"><strong>Saved CV versions</strong>{cvVersions.slice(0, 6).map((version) => <span key={version.id}>{version.cv_label || version.original_filename} · {version.target_role ? roles[version.target_role as Exclude<RoleKey, "">] || version.target_role : "general"} · {version.status.replaceAll("_", " ")}</span>)}</div>}
                <label className="source-row"><span className="source-icon"><GitBranch size={19} /></span><div><strong>GitHub projects</strong><p>Use a profile URL to choose from all public repositories</p></div><div className="url-control"><Link2 size={15} /><input placeholder="https://github.com/username" value={github} onChange={(event) => { setGithub(event.target.value); setGithubProjects([]); setGithubCandidates([]); }} /></div></label>
                {githubCandidates.length > 0 && <div className="github-candidates"><div><strong>Select projects to analyse</strong><span>{selectedGithubUrls.size} selected</span></div>{githubCandidates.map((candidate) => <label key={candidate.url}><input type="checkbox" checked={selectedGithubUrls.has(candidate.url)} onChange={() => setSelectedGithubUrls((current) => { const next = new Set(current); if (next.has(candidate.url)) next.delete(candidate.url); else next.add(candidate.url); return next; })} /><span><b>{candidate.name}</b><small>{candidate.language ?? "Repository"} · {candidate.stars} stars</small></span></label>)}</div>}
                <label className="source-row"><span className="source-icon"><Link2 size={19} /></span><div><strong>Portfolio or project</strong><p>Optional public URL</p></div><div className="url-control"><Link2 size={15} /><input placeholder="https://" value={portfolio} onChange={(event) => setPortfolio(event.target.value)} /></div></label>
                <button className="manual-source"><Plus size={16} />Add evidence manually</button>
              </div>
              <p className="privacy-note"><ShieldCheck size={15} />Private documents remain attached to your profile and are not published.</p>
            </>}

            {step === 3 && <>
              <div className="panel-title"><span className="panel-icon"><ShieldCheck size={20} /></span><div><h2>Review your analysis scope</h2><p>Confirm what CareerSignal should compare. No score has been generated yet.</p></div></div>
              <dl className="review-list">
                <div><dt>Target market</dt><dd><strong>{role ? roles[role] : "Not selected"}</strong><span>{location} · {seniority}</span></dd><button onClick={() => setStep(1)}>Edit</button></div>
                <div><dt>CV</dt><dd><strong>{cvFilename || cv?.name || "Not added"}</strong><span>{cvUploadId ? `Security status: ${cvStatus.replaceAll("_", " ")}` : "You can add one later"}</span></dd><button onClick={() => setStep(2)}>Edit</button></div>
                <div><dt>GitHub</dt><dd><strong>{github || "Not added"}</strong><span>{github ? `${githubProjects.length || "Selected"} public repositories will be reviewed` : "You can connect it later"}</span></dd><button onClick={() => setStep(2)}>Edit</button></div>
                {portfolio && <div><dt>Portfolio</dt><dd><strong>{portfolio}</strong><span>Public page</span></dd><button onClick={() => setStep(2)}>Edit</button></div>}
              </dl>
              <div className="consent"><label><input type="checkbox" defaultChecked /><span>I understand that generated findings must be reviewed before I use them in an application.</span></label></div>
              <div className="not-live"><strong>Evidence processing</strong><p>CVs are stored privately and must pass file-signature and malware checks before extraction. Evidence extraction begins only after a clean result.</p></div>
              {suggestions.length > 0 && <div className="evidence-review"><div className="evidence-review-heading"><strong>Review extracted evidence</strong><span>{confirmedSuggestions.size} of {suggestions.length} selected</span></div>{suggestions.map((item) => <label className="evidence-item" key={item.id}><input type="checkbox" checked={confirmedSuggestions.has(item.id)} onChange={() => setConfirmedSuggestions((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} /><span><b>{item.canonical_skill}</b><small>{item.category} · proposed level {item.proposed_level}/5 · {Math.round(item.confidence * 100)}% match</small><q>{item.excerpt}</q></span></label>)}</div>}
              {githubProjects.map((githubProject) => <div className="evidence-review" key={githubProject.id}><div className="evidence-review-heading"><strong>Review GitHub evidence · {githubProject.repository}</strong><span>{githubProject.suggestions.filter((item) => confirmedGithub.has(item.id)).length} of {githubProject.suggestions.length} selected</span></div>{githubProject.suggestions.map((item) => <label className="evidence-item" key={item.id}><input type="checkbox" checked={confirmedGithub.has(item.id)} onChange={() => setConfirmedGithub((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} /><span><b>{item.canonical_skill}</b><small>{item.category} · conservative level {item.proposed_level}/5 · public repository</small><q>{item.excerpt}</q></span></label>)}</div>)}
            </>}

            {error && <p className="form-error" role="alert">{error}</p>}
            <footer className="panel-actions">
              {step > 1 ? <button className="secondary-button" onClick={() => { setError(""); setStep((step - 1) as Step); }}><ArrowLeft size={15} />Back</button> : <span />}
              {step === 1 && <button className="primary-button" onClick={continueFromTarget}>Continue <ArrowRight size={15} /></button>}
              {step === 2 && <div className="action-group"><button className="text-button" onClick={() => { setError(""); setStep(3); }}>Skip for now</button><button className="primary-button" onClick={continueFromEvidence}>Review evidence <ArrowRight size={15} /></button></div>}
              {step === 3 && <button className="primary-button" onClick={saveProfile} disabled={savingProfile}>{savingProfile ? "Creating evidence profile..." : saved ? <>Save profile <ArrowRight size={15} /></> : <>Create evidence profile <ArrowRight size={15} /></>}</button>}
            </footer>
          </section>
          </>}
        </div>}
      </main>
    </div>
    </>
  );
}
