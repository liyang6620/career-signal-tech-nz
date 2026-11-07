import { Fragment, useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BarChart3,
  Bookmark,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ClipboardList,
  Compass,
  Download,
  FileText,
  GitBranch,
  Layers3,
  Link2,
  History,
  MapPin,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Target,
  Trash2,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import { API_URL, apiError, apiPayload, fetchWithRecovery, type ServiceState } from "./api/client";
import { dedupeSkillEvidence, evidenceLabel, evidencePreview, scopeMessage } from "./domain/evidence";
import {
  productRoutes,
  roles,
  routeTitles,
  routeViews,
  type AnalysisDetailsMap,
  type DecodedRole,
  type EvidenceResult,
  type EvidenceRoleFilter,
  type EvidenceSuggestion,
  type GithubCandidate,
  type GithubProject,
  type JobAnalysisSummary,
  type JobStatusEvent,
  type MarketQuality,
  type MarketSummary,
  type ProfileData,
  type PwaInstallEvent,
  type RoleFit,
  type RoleFitMap,
  type RoleKey,
  type SavedJob,
  type SessionUser,
  type SkillDemand,
  type SkillEvidence,
  type Step,
  type UploadRecord,
} from "./domain/types";
import { DEMO_SESSION_KEY, DEMO_TOKEN, demoFetch, demoLandingData, demoUser, resetDemoData } from "./demo/demoApi";
import "./App.css";


function CareerSignalMark({ size = 40 }: { size?: number }) {
  return <svg className="career-signal-mark" width={size} height={size} viewBox="0 0 22 20" role="img" aria-label="CareerSignal mark" focusable="false">
    <rect x="0" y="12" width="4" height="8" fill="currentColor" />
    <rect x="6" y="8" width="4" height="12" fill="currentColor" />
    <rect x="12" y="4" width="4" height="16" fill="currentColor" />
    <rect x="18" y="0" width="4" height="20" fill="currentColor" />
  </svg>;
}

const normalizeSourceUrl = (value: string) => value.trim().replace(/\/+$/, "");
function expandGithubSources(values: string[]) {
  return values.flatMap((value) => value.split(",")).map((value) => {
    try { return decodeURIComponent(value).trim(); } catch { return value.trim(); }
  }).filter(Boolean);
}

function CapabilityMethodology() {
  return <section className="capability-methodology" aria-labelledby="capability-methodology-title"><header><div><span>Methodology references</span><h2 id="capability-methodology-title">Why this profile is evidence-led</h2></div><small>Published research and occupational frameworks used as design constraints</small></header><div className="methodology-grid"><article><span>01</span><h3>Competency, not keyword count</h3><p>Competency models work best when capabilities are defined, organised and used consistently. A named skill is therefore separated from work that can be inspected.</p><a href="https://doi.org/10.1111/j.1744-6570.2010.01207.x" target="_blank" rel="noreferrer">Campion et al. · competency modelling <ArrowRight size={13} /></a><a href="https://www.naceweb.org/career-readiness/competencies/career-readiness-defined/" target="_blank" rel="noreferrer">NACE career readiness framework <ArrowRight size={13} /></a></article><article><span>02</span><h3>Fit is a comparison, not a label</h3><p>Person–job fit research treats fit as the relationship between a person and a job's demands. The alignment score therefore compares evidence with a role benchmark rather than declaring a fixed identity.</p><a href="https://doi.org/10.1111/j.1744-6570.2005.00672.x" target="_blank" rel="noreferrer">Kristof-Brown et al. · person–job fit meta-analysis <ArrowRight size={13} /></a><a href="https://doi.org/10.1093/oso/9780195100143.003.0007" target="_blank" rel="noreferrer">DeFillippi &amp; Arthur · career competencies <ArrowRight size={13} /></a></article><article><span>03</span><h3>Skills inferred from labour demand</h3><p>Job-posting research shows that repeated skill requirements reveal differences across firms and labour markets. Role benchmarks combine occupational taxonomies with indexed NZ postings.</p><a href="https://doi.org/10.1086/694106" target="_blank" rel="noreferrer">Deming &amp; Kahn · job-posting skill signals <ArrowRight size={13} /></a><a href="https://www.onetonline.org/skills/" target="_blank" rel="noreferrer">O*NET skills reference <ArrowRight size={13} /></a></article><article><span>04</span><h3>Adaptability and local context</h3><p>Career adaptability research supports comparing a current evidence base with adjacent directions, while Tāhatu keeps the interpretation grounded in New Zealand occupations and pathways.</p><a href="https://doi.org/10.1016/j.jvb.2012.01.010" target="_blank" rel="noreferrer">Savickas &amp; Porfeli · career adaptability <ArrowRight size={13} /></a><a href="https://tahatu.govt.nz/" target="_blank" rel="noreferrer">Tāhatu career information <ArrowRight size={13} /></a></article><article><span>05</span><h3>Transferable skills vocabulary</h3><p>O*NET, ESCO and SFIA provide reference vocabularies so related capabilities can be compared across job titles. They are anchors for classification, not substitutes for current NZ evidence.</p><a href="https://esco.ec.europa.eu/en/classification/skill" target="_blank" rel="noreferrer">ESCO skills classification <ArrowRight size={13} /></a><a href="https://sfia-online.org/en/sfia-9" target="_blank" rel="noreferrer">SFIA 9 professional skills framework <ArrowRight size={13} /></a></article><article><span>06</span><h3>Responsible AI and production evidence</h3><p>AI application roles need more than model keywords. The benchmark keeps API delivery, testing, deployment and risk controls visible alongside model and retrieval skills.</p><a href="https://www.nist.gov/itl/ai-risk-management-framework" target="_blank" rel="noreferrer">NIST AI Risk Management Framework <ArrowRight size={13} /></a><a href="https://www.nist.gov/itl/ai-risk-management-framework/ai-rmf-playbook" target="_blank" rel="noreferrer">NIST AI RMF Playbook <ArrowRight size={13} /></a></article></div><footer className="methodology-note"><BookOpen size={15} /><span>Sources establish the measurement frame; the displayed score still depends on the candidate evidence and the indexed New Zealand postings available in this workspace.</span></footer></section>;
}



function scoreLabel(score: number): string {
  if (score >= 75) return "Strong signal";
  if (score >= 55) return "Growing signal";
  return "Starting signal";
}

function importanceLabel(importance: SkillDemand["importance"]): string {
  return importance.charAt(0).toUpperCase() + importance.slice(1);
}



function AnnotatedAdvert({ text, demands }: { text: string; demands: SkillDemand[] }) {
  const named = demands.filter((item) => item.name.length > 1).slice(0, 8);
  const pattern = named.length ? new RegExp(`(${named.map((item) => item.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi") : null;
  const parts = pattern ? text.split(pattern) : [text];
  const demandFor = (value: string) => named.find((item) => item.name.toLowerCase() === value.toLowerCase());
  return <section className="decoder-advert-layout"><article className="decoder-advert"><header><h2>Annotated advertisement</h2><span>Highlights are detected requirements, not added role-template skills.</span></header><p>{parts.map((part, index) => { const demand = demandFor(part); const number = demand ? named.indexOf(demand) + 1 : 0; return demand ? <mark className={demand.evidence_level === 0 ? "gap" : undefined} key={`${part}-${index}`}>{part}<sup>{number}</sup></mark> : <Fragment key={`${part}-${index}`}>{part}</Fragment>; })}</p></article><aside className="decoder-margin-notes" aria-label="Evidence annotations">{named.map((item, index) => <div className={item.evidence_level === 0 ? "gap" : undefined} key={item.slug}><b>{index + 1}</b><span><strong>{item.name}</strong><small>{importanceLabel(item.importance)} · JD {Math.round(item.demand_score)} · evidence {Math.round(item.evidence_score)}</small></span></div>)}</aside></section>;
}

function DecoderScoreTable({ skillDemands, focus }: { skillDemands: SkillDemand[]; focus: "all" | Exclude<RoleKey, ""> }) {
  const items = skillDemands.filter((item) => focus === "all" || item.role_families.includes(focus)).sort((a, b) => b.demand_score - a.demand_score);
  return <section className="decoder-score-panel"><header><h2>Advert priority vs your evidence</h2><span>Every component is shown; nothing is hidden in a tooltip.</span></header><div className="signal-table-wrap"><table><thead><tr><th>Capability</th><th>JD priority</th><th>Proof</th><th>Evidence score</th><th>Score composition</th></tr></thead><tbody>{items.map((item) => <tr className={item.evidence_score + 5 < item.demand_score ? "gap" : ""} key={item.slug}><td><b>{item.name}</b><small>{importanceLabel(item.importance)} · {item.mention_count} mention{item.mention_count === 1 ? "" : "s"}</small></td><td><b>{Math.round(item.demand_score)}</b><small>explicit {item.explicit_mention} · repetition {item.repetition_signal.toFixed(1)} · requirement {item.requirement_signal.toFixed(1)} · title {item.title_signal.toFixed(1)}</small></td><td><ProofGlyph level={item.evidence_level} /><small>{evidenceLabel(item.evidence_level)}</small></td><td><b>{Math.round(item.evidence_score)}</b></td><td><small>base {Math.round(item.evidence_base_score)} · confidence {item.confidence_adjustment.toFixed(1)} · specificity {(item.specificity_bonus ?? 0).toFixed(1)} · verification {(item.verification_bonus ?? 0).toFixed(1)} · outcome {(item.outcome_bonus ?? 0).toFixed(1)} · corroboration {item.corroboration_bonus.toFixed(1)} · diversity {item.diversity_bonus.toFixed(1)}</small></td></tr>)}</tbody></table></div></section>;
}

function SignalDecoderResult({ result, advert, focus, onFocus, onSave }: { result: DecodedRole; advert: string; focus: "all" | Exclude<RoleKey, "">; onFocus: (focus: "all" | Exclude<RoleKey, "">) => void; onSave: () => void }) {
  const proven = result.skill_demands.filter((item) => item.evidence_level > 0).length;
  const gaps = result.skill_demands.length - proven;
  return <div className="signal-decoder-result"><section className="decoder-jobhead"><div><p className="signal-context">Decoded job advertisement</p><h1>{result.role_label}</h1><p>{result.seniority} · closest to {result.role_matches[0]?.role_label ?? roles[result.role_family]} at {Math.round(result.role_matches[0]?.match_score ?? result.confidence)}%</p></div><button type="button" className="primary-button" onClick={onSave}>Add to tracker</button></section><section className="decoder-verdict" aria-label="Job evidence verdict"><div><span>Requirements</span><b>{result.skill_demands.length}</b></div><div><span>Already proven</span><b>{proven}</b></div><div><span>Evidence gaps</span><b>{gaps}</b></div><p>{gaps ? `${proven} requirements have evidence. Prioritise the ${gaps} remaining gap${gaps === 1 ? "" : "s"} before applying.` : "Every detected requirement has evidence on record; review depth and application conditions next."}</p></section>{result.eligibility_requirements?.length > 0 && <section className="decoder-eligibility"><header><h2>Application conditions</h2><span>Quoted from the advert and excluded from capability matching.</span></header>{result.eligibility_requirements.map((item, index) => <article key={`${item.category}-${index}`}><div><b>{item.label}</b><span>{item.importance}</span></div><q>{item.excerpt}</q></article>)}</section>}<section className="decoder-role-proximity"><header><h2>Advert proximity across role families</h2><span>Independent signals, not shares of a forced classification.</span></header>{result.role_matches.map((item) => <div key={item.role_family}><span>{item.role_label}</span><i><u style={{ width: `${item.match_score}%` }} /></i><b>{Math.round(item.match_score)}%</b></div>)}{(result.scope_status !== "matched" || result.unmapped_skills.length > 0) && <p>{scopeMessage(result.scope_status)} {result.unmapped_skills.length ? `Additional capabilities: ${result.unmapped_skills.join(", ")}.` : ""}</p>}</section>{advert.trim() && <AnnotatedAdvert text={advert} demands={result.skill_demands} />}{result.scope_status === "mixed" && <div className="jd-focus" role="group" aria-label="Job description focus"><button type="button" aria-pressed={focus === "all"} className={focus === "all" ? "active" : ""} onClick={() => onFocus("all")}>Full JD</button>{result.role_matches.filter((item) => item.match_score >= 35).slice(0, 3).map((item) => <button type="button" aria-pressed={focus === item.role_family} className={focus === item.role_family ? "active" : ""} onClick={() => onFocus(item.role_family)} key={item.role_family}>{item.role_label}</button>)}</div>}<DecoderScoreTable skillDemands={result.skill_demands} focus={focus} /></div>;
}

const adjacentRoles: Record<Exclude<RoleKey, "">, Exclude<RoleKey, "">[]> = {
  software: ["cloud-devops", "ai", "data-engineer", "data-analyst"],
  "data-analyst": ["data-engineer", "ai", "software", "cloud-devops"],
  "data-engineer": ["data-analyst", "cloud-devops", "software", "ai"],
  ai: ["software", "data-engineer", "cloud-devops", "data-analyst"],
  "cloud-devops": ["software", "data-engineer", "ai", "data-analyst"],
};

function ProofGlyph({ level }: { level: number }) {
  const safeLevel = Math.max(0, Math.min(5, Math.round(level)));
  return <span className={`proof-glyph${safeLevel === 0 ? " empty" : ""}`} role="img" aria-label={`Proof level ${safeLevel} of 5`}>
    {[1, 2, 3, 4, 5].map((bar) => <i className={bar <= safeLevel ? "on" : ""} key={bar} />)}
  </span>;
}

function SignalPageHead({ context, title, description, actions }: { context: string; title: string; description: string; actions?: ReactNode }) {
  return <header className="signal-pagehead"><div><p className="signal-context">{context}</p><h1>{title}</h1><p>{description}</p></div>{actions && <div className="signal-page-actions">{actions}</div>}</header>;
}

function OverviewView({ role, location, seniority, reviewedAt, evidence, roleFits, market, jobs, cvFilename, cvStatus, github, githubProjects, portfolio, onEdit, navigate }: {
  role: Exclude<RoleKey, "">; location: string; seniority: string; reviewedAt: string | null; evidence: SkillEvidence[]; roleFits: RoleFitMap; market: MarketSummary | null; jobs: SavedJob[];
  cvFilename: string; cvStatus: string; github: string; githubProjects: GithubProject[]; portfolio: string; onEdit: () => void; navigate: (path: string) => void;
}) {
  const fit = roleFits[role];
  const contributions = fit?.contributions ?? [];
  const gaps = contributions.filter((item) => item.evidence_level === 0).sort((a, b) => Number(b.required) - Number(a.required) || b.weight - a.weight || b.market_frequency - a.market_frequency);
  const topGap = gaps[0];
  const provenCore = contributions.filter((item) => item.required && item.evidence_level > 0).length;
  const coreCount = contributions.filter((item) => item.required).length;
  const roleCount = market?.roles.find((item) => item.role_family === role)?.count ?? fit?.market_posting_count ?? 0;
  const juniorCount = market?.role_seniority.filter((item) => item.role_family === role && /graduate|junior/i.test(item.seniority)).reduce((sum, item) => sum + item.count, 0) ?? 0;
  const reviewed = reviewedAt ? new Date(reviewedAt).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" }) : "not reviewed yet";
  const activeJobs = jobs.filter((job) => !["rejected", "archived"].includes(job.status));
  const sourceTypes = new Set(evidence.map((item) => item.source_type.toLowerCase()));
  const nextSteps = gaps.slice(0, 3).map((gap) => ({
    title: `Add ${gap.skill_name} proof`,
    detail: gap.required
      ? `This required capability has no confirmed evidence${gap.market_mention_count ? ` and appears in ${gap.market_mention_count} indexed adverts` : ""}.`
      : `This supporting capability has no confirmed evidence; add an inspectable project or work example.`,
  }));
  if (!nextSteps.length) {
    contributions.filter((item) => item.evidence_level > 0).sort((a, b) => a.source_count - b.source_count || b.market_frequency - a.market_frequency).slice(0, 3).forEach((item) => nextSteps.push({ title: `Strengthen ${item.skill_name}`, detail: `Add a second independent source or a measured outcome to make this signal easier to verify.` }));
  }
  const verdict = coreCount
    ? `${provenCore} of ${coreCount} core skills are proven.${topGap ? ` ${topGap.skill_name} is the priority gap.` : " No required gaps remain."}`
    : `${evidence.length} confirmed skills are ready to compare with this role family.`;

  return <div className="signal-page overview-page">
    <SignalPageHead context={`Your target · ${location} · ${seniority}`} title={roles[role]} description={`Your profile was last reviewed ${reviewed}. Here is where your record stands and what to do next.`} actions={<><button className="secondary-button" onClick={onEdit}>Edit target</button><button className="primary-button" onClick={() => navigate(productRoutes.decoder)}>Decode a job advert</button></>} />
    <section className="signal-report" aria-label="Match summary"><div className="signal-report-main"><p className="signal-context">Skill match · {roles[role]}</p><h2>{verdict}</h2><p>{roleCount ? `The current market sample contains ${roleCount} ${roles[role]} advert${roleCount === 1 ? "" : "s"}${juniorCount ? `, including ${juniorCount} graduate or junior openings` : ""}.` : "The evidence signal currently uses the role benchmark; market calibration appears when job records are available."}</p><div className="signal-score"><b>{Math.round(fit?.score ?? 0)}</b><span>/ 100 evidence signal<br />{fit ? scoreLabel(fit.score).toLowerCase() : "benchmark loading"}</span></div></div><div className="signal-report-side"><div className="signal-meter"><span>Benchmark covered<small>skills with any proof</small></span><i><u style={{ width: `${Math.round(fit?.coverage ?? 0)}%` }} /></i><b>{Math.round(fit?.coverage ?? 0)}%</b></div><div className="signal-meter"><span>Evidence depth<small>how strong that proof is</small></span><i><u style={{ width: `${Math.round(fit?.evidence_depth ?? 0)}%` }} /></i><b>{Math.round(fit?.evidence_depth ?? 0)}</b></div><div className="signal-meter"><span>Priority gaps<small>required, nothing on record</small></span><i><u style={{ width: `${Math.min(100, gaps.filter((item) => item.required).length * 20)}%` }} /></i><b>{gaps.filter((item) => item.required).length}</b></div><button className="signal-link inverse" onClick={() => navigate(productRoutes.graph)}>Open the full analysis</button></div></section>
    <div className="signal-grid overview-grid">
      <section className="signal-section"><header><h2>Your evidence</h2><button className="signal-link" onClick={() => navigate(productRoutes.record)}>Manage</button></header><div className="signal-figures"><div><b>{evidence.length}</b><span>confirmed skills</span></div><div><b>{evidence.filter((item) => item.evidence_level >= 3).length}</b><span>implemented or verified</span></div><div><b>{new Set(evidence.map((item) => item.category)).size}</b><span>capability domains</span></div></div><div className="signal-source-row"><b>CV</b><span><strong>{cvFilename || "No CV added"}</strong><small>{cvStatus ? cvStatus.replaceAll("_", " ") : "Not connected"}</small></span></div><div className="signal-source-row"><b>GH</b><span><strong>{githubProjects.length ? `${githubProjects.length} reviewed repositor${githubProjects.length === 1 ? "y" : "ies"}` : github || "No GitHub source"}</strong><small>{sourceTypes.has("github") ? "Public evidence" : "Not connected"}</small></span></div><div className="signal-source-row"><b>WEB</b><span><strong>{portfolio || "No portfolio added"}</strong><small>{portfolio ? "Public evidence" : "Optional"}</small></span></div></section>
      <section className="signal-section"><header><h2>Across role families</h2><button className="signal-link" onClick={() => navigate(productRoutes.graph)}>Compare</button></header><ul className="signal-role-list">{Object.entries(roles).map(([key, label]) => { const item = roleFits[key as Exclude<RoleKey, "">]; return <li className={key === role ? "target" : ""} key={key}><span>{label}</span><i><u style={{ width: `${Math.round(item?.score ?? 0)}%` }} /></i><b>{item ? Math.round(item.score) : "—"}</b></li>; })}</ul><p className="signal-small">Same evidence, five benchmarks. Scores describe your record, not your chance of being hired.</p></section>
      <section className="signal-section"><header><h2>Applications</h2><button className="signal-link" onClick={() => navigate(productRoutes.jobs)}>Tracker</button></header><div className="signal-stages">{(["saved", "preparing", "applied", "interview", "offer"] as const).map((stage) => <div className={activeJobs.some((job) => job.status === stage) ? "has" : ""} key={stage}><b>{activeJobs.filter((job) => job.status === stage).length}</b><span>{applicationStageLabels[stage]}</span></div>)}</div><ul className="signal-job-list">{activeJobs.slice(0, 3).map((job) => <li key={job.id}><b>{job.title}</b><span>{job.company} · {job.evidenced_skill_count} of {job.skill_count} evidenced</span><small>{applicationStageLabels[job.status]}{job.top_gaps.length ? ` · next: ${job.top_gaps[0]}` : ""}</small></li>)}{activeJobs.length === 0 && <li><span>No active opportunities yet.</span></li>}</ul></section>
      <section className="signal-section overview-next"><header><h2>Next steps</h2><span className="signal-small">ordered by effect on your {roles[role]} signal</span></header><div>{nextSteps.map((item, index) => <article key={item.title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{item.title}</h3><p>{item.detail}</p></div></article>)}</div></section>
    </div>
  </div>;
}

function EvidenceRecordView({ evidence, cvVersions, cvFilename, cvStatus, github, githubProjects, portfolio, reviewedAt, onManage }: { evidence: SkillEvidence[]; cvVersions: UploadRecord[]; cvFilename: string; cvStatus: string; github: string; githubProjects: GithubProject[]; portfolio: string; reviewedAt: string | null; onManage: () => void }) {
  const items = [...dedupeSkillEvidence(evidence)].sort((a, b) => b.evidence_level - a.evidence_level || b.confidence - a.confidence);
  const reviewed = reviewedAt ? new Date(reviewedAt).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" }) : "not reviewed";
  return <div className="signal-page evidence-page">
    <SignalPageHead context={`${cvVersions.length || (cvFilename ? 1 : 0)} CV · ${githubProjects.length} GitHub repositor${githubProjects.length === 1 ? "y" : "ies"} · ${portfolio ? 1 : 0} portfolio · reviewed ${reviewed}`} title="My evidence" description="Everything CareerSignal knows about your work. Nothing counts until you confirm it, and the same record is reused for every role, advert and comparison." actions={<><button className="secondary-button" onClick={onManage}>Review extracted evidence</button><button className="primary-button" onClick={onManage}>Add a source</button></>} />
    <div className="signal-grid evidence-layout"><section className="signal-section evidence-ledger"><header><h2>Confirmed skills</h2><span className="signal-small">{items.length} skills · sorted by proof level</span></header>{items.length ? <div className="signal-table-wrap"><table><thead><tr><th>Skill</th><th>Proof level</th><th>Where it is shown</th><th>Confidence</th></tr></thead><tbody>{items.map((item) => <tr key={item.skill_slug}><td><b>{item.skill_name}</b><small>{item.category}</small></td><td><ProofGlyph level={item.evidence_level} /><small>{evidenceLabel(item.evidence_level)}</small></td><td><span>{item.excerpt}</span><small>{item.source_type} · {item.locator}</small></td><td>{Math.round(item.confidence * 100)}%</td></tr>)}</tbody></table></div> : <p>No confirmed evidence yet. Add a CV, repository or manual work sample.</p>}</section><aside className="evidence-aside"><section className="signal-section"><header><h2>Sources</h2></header><div className="signal-source-row"><b>CV</b><span><strong>{cvFilename || "No CV added"}</strong><small>{cvStatus ? `Uploaded → scanned → parsed → ${cvStatus.replaceAll("_", " ")}` : "PDF or DOCX, up to 10 MB"}</small></span><em>{items.filter((item) => item.source_type.toLowerCase() === "cv").length} skills</em></div><div className="signal-source-row"><b>GH</b><span><strong>{github || "No GitHub source"}</strong><small>{githubProjects.length} reviewed public repositor{githubProjects.length === 1 ? "y" : "ies"}</small></span><em>{items.filter((item) => item.source_type.toLowerCase() === "github").length} skills</em></div><div className="signal-source-row"><b>WEB</b><span><strong>{portfolio || "No portfolio added"}</strong><small>Public portfolio or project</small></span></div><button className="signal-manual" type="button" onClick={onManage}>+ Add evidence manually</button></section><section className="signal-section"><header><h2>CV versions</h2><span className="signal-small">one per target</span></header>{cvVersions.length ? cvVersions.slice(0, 6).map((version) => <div className="cv-record" key={version.id}><b>{version.cv_label || version.original_filename}</b><span>{version.target_role ? roles[version.target_role as Exclude<RoleKey, "">] || version.target_role : "General"}</span><small>{version.status.replaceAll("_", " ")}</small></div>) : <p className="signal-small">Upload a version and give it a target role to keep applications focused.</p>}</section><section className="signal-section"><header><h2>Processing and privacy</h2></header><p className="signal-small">CVs remain private and must pass file-signature and malware checks before text extraction. Private evidence is never added to market counts.</p></section></aside></div>
  </div>;
}

function MarketView({ market, quality, targetRole, evidence = [], navigate }: { market: MarketSummary | null; quality: MarketQuality | null; targetRole: RoleKey; evidence?: SkillEvidence[]; navigate: (path: string) => void }) {
  const initialRole = targetRole || (market?.roles.find((item) => item.count > 0)?.role_family as Exclude<RoleKey, ""> | undefined) || "software";
  const [focus, setFocus] = useState<Exclude<RoleKey, "">>(initialRole);

  if (!market?.posting_count) return <div className="tool-page"><header><p className="page-kicker-icon"><BarChart3 size={15} />Your market</p><h1>Technology opportunities</h1><span>Use current, governed job records to make a more informed search decision.</span></header><section className="tool-panel market-empty-panel"><div className="market-empty"><span className="empty-state-mark"><BarChart3 size={22} /></span><p className="empty-state-kicker">Data coverage</p><h2>Market coverage is not ready yet</h2><p>No permitted job records are currently indexed for this workspace. Your profile and role decoder remain available while the next market collection is processed.</p><div className="empty-state-actions"><button type="button" className="primary-button" onClick={() => navigate(productRoutes.decoder)}>Analyse a job advertisement <ArrowRight size={15} /></button><button type="button" className="secondary-button" onClick={() => navigate(productRoutes.workspace)}>Review my profile</button></div></div></section></div>;

  const focusCount = market.roles.find((item) => item.role_family === focus)?.count ?? 0;
  const marketShare = Math.round((focusCount / market.posting_count) * 100);
  const earlyCareerCount = market.role_seniority
    .filter((item) => item.role_family === focus && /graduate|junior/i.test(item.seniority))
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
  const evidenceBySlug = new Map(dedupeSkillEvidence(evidence).map((item) => [item.skill_slug, item]));

  return <div className="tool-page market-page">
    <header className="market-header"><div><p className="page-kicker-icon">Market intelligence · bounded NZ sample</p><h1>{roles[focus]} opportunities</h1><span>A focused view of the permitted New Zealand job records currently indexed by CareerSignal. This is a directional sample, not an official labour-market total.</span></div><div className="market-header-meta"><span>Indexed dataset</span><strong>{market.posting_count} records</strong><small>Latest retrieval · {freshness}</small></div></header>
    <section className="market-workbench">
      <div className="market-toolbar"><div><span>Role family</span><strong>{roles[focus]}</strong><small>{targetRole ? `${roles[targetRole]} is selected in your profile.` : "Choose a segment to inspect."}</small></div><div className="market-role-selector" role="group" aria-label="Market role family">{Object.entries(roles).map(([key, label]) => <button type="button" key={key} aria-pressed={focus === key} className={focus === key ? "active" : ""} onClick={() => setFocus(key as Exclude<RoleKey, "">)}>{label}{targetRole === key && <small>Target</small>}</button>)}</div></div>
      <div className="market-summary" aria-label="Selected market summary"><div><span>Indexed opportunities</span><strong>{focusCount}</strong><small>in this role family</small></div><div><span>Share of current sample</span><strong>{marketShare}%</strong><small>{focusCount} of {market.posting_count} records</small></div><div><span>Graduate and junior</span><strong>{earlyCareerCount}</strong><small>explicitly classified openings</small></div><div><span>Source coverage</span><strong>{market.source_count}</strong><small>permitted source{market.source_count === 1 ? "" : "s"}</small></div></div>
      <div className="market-insights">
        <section className="market-data-block"><header><div><h2>Skills employers mention</h2></div><button className="text-button" onClick={() => document.getElementById("ask")?.scrollIntoView({ behavior: "smooth" })}>Ask the records</button></header><p className="data-block-note">Ranked by frequency in the currently indexed {roles[focus]} sample.</p><div className="market-table market-skill-table" aria-label="Employer skills"><div className="market-table-head"><span>Skill</span><span>Records</span><span>Share</span><span>Your evidence</span></div>{displayedSkills.map((item, index) => { const proof = evidenceBySlug.get(item.skill_slug); return <div className="market-table-row" key={item.skill_slug}><span><b>{String(index + 1).padStart(2, "0")}</b>{item.skill_name}</span><strong>{item.count}</strong><span><i><u style={{ width: `${Math.max((item.count / skillMax) * 100, 4)}%` }} /></i>{Math.round((item.count / Math.max(focusCount, 1)) * 100)}%</span><span>{proof ? <><ProofGlyph level={proof.evidence_level} /><small>{evidenceLabel(proof.evidence_level)}</small></> : <><ProofGlyph level={0} /><small>No proof</small></>}</span></div>; })}</div></section>
        <section className="market-data-block"><header><div><span className="panel-kicker">Geography</span><h2>Where opportunities appear</h2></div><MapPin size={18} /></header><p className="data-block-note">Normalised from each source's location text. Remote and hybrid labels may vary.</p><div className="market-table" aria-label="Opportunity locations"><div className="market-table-head"><span>Location</span><span>Records</span><span>Share</span></div>{displayedLocations.map((item) => <div className="market-table-row" key={item.location}><span><MapPin size={14} />{item.location}</span><strong>{item.count}</strong><span><i><u style={{ width: `${Math.max((item.count / locationMax) * 100, 4)}%` }} /></i>{Math.round((item.count / Math.max(focusCount, 1)) * 100)}%</span></div>)}</div></section>
      </div>
      {alternatives.length > 0 && <section className="market-adjacent"><header><div><span className="panel-kicker">Adjacent demand</span><h2>Related role families</h2></div><span>Ordered by career proximity</span></header><div>{alternatives.map((item) => <button type="button" key={item.roleKey} onClick={() => setFocus(item.roleKey)}><span><strong>{roles[item.roleKey]}</strong><small>Inspect this segment</small></span><b>{item.count}<small>records</small></b><ArrowRight size={16} /></button>)}</div></section>}
       <details className="market-coverage"><summary><span><strong>Data coverage and limitations</strong><small>{market.posting_count} records from {market.source_count} permitted source{market.source_count === 1 ? "" : "s"}</small></span><ChevronDown size={17} /></summary><div><p>This view describes CareerSignal's current indexed sample, not every technology vacancy in New Zealand. Counts support comparison and investigation rather than official totals.</p>{quality?.sample_warnings?.length ? <ul className="market-warnings">{quality.sample_warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}<dl><div><dt>Indexed postings</dt><dd>{quality?.posting_count ?? market.posting_count}</dd></div><div><dt>Active sources</dt><dd>{quality?.active_source_count ?? market.source_count}</dd></div><div><dt>Graduate and junior</dt><dd>{quality?.graduate_junior_count ?? earlyCareerCount}</dd></div><div><dt>Normalised locations</dt><dd>{quality?.normalised_location_count ?? market.locations.length}</dd></div><div><dt>Missing publication dates</dt><dd>{quality?.missing_publication_date_percent ?? 0}%</dd></div><div><dt>Low-confidence records</dt><dd>{quality?.low_confidence_count ?? 0}</dd></div><div><dt>Older than 90 days</dt><dd>{quality?.stale_posting_count ?? 0}</dd></div><div><dt>Collector runs</dt><dd>{quality?.collector_completed_count ?? 0} completed · {quality?.collector_failed_count ?? 0} failed</dd></div><div><dt>Latest retrieval</dt><dd>{quality?.latest_retrieved_at ? new Date(quality.latest_retrieved_at).toLocaleString("en-NZ", { dateStyle: "medium", timeStyle: "short" }) : "Unavailable"}</dd></div><div><dt>Next scheduled refresh</dt><dd>{nextRefresh ? new Date(nextRefresh).toLocaleString("en-NZ", { dateStyle: "medium", timeStyle: "short" }) : "Not scheduled"}</dd></div></dl>{quality?.sources.map((source) => <article className="market-source-quality" key={source.name}><b>{source.name}</b><span>{source.enabled ? "Enabled" : "Disabled"} · {source.adapter} · latest {source.latest_status ?? "unknown"}</span><small>{source.accepted_count} accepted · {source.rejected_count} rejected · every {source.refresh_interval_minutes} minutes</small></article>)}</div></details>
    </section>
  </div>;
}

function AdjacentPathsPanel({ role, market, roleFits, navigate, onSelectRole }: { role: RoleKey; market: MarketSummary | null; roleFits: RoleFitMap; navigate: (path: string) => void; onSelectRole: (roleKey: Exclude<RoleKey, "">) => void }) {
  if (!role) return null;
  const paths = adjacentRoles[role].slice(0, 3);
  return <section className="signal-section adjacent-paths"><header><div><h2>Adjacent paths</h2><p>Nearby role families ranked by the evidence already in your record.</p></div><span className="signal-small">Not a promise of eligibility</span></header><div className="adjacent-path-grid">{paths.map((path) => { const fit = roleFits[path]; const openings = market?.roles.find((item) => item.role_family === path)?.count ?? fit?.market_posting_count ?? 0; const nextGap = fit?.contributions.filter((item) => item.evidence_level === 0).sort((a, b) => Number(b.required) - Number(a.required) || b.weight - a.weight)[0]; return <article key={path}><p className="signal-context">Adjacent role family</p><h3>{roles[path]}</h3><dl><div><dt>Signal</dt><dd>{fit ? Math.round(fit.score) : "—"}</dd></div><div><dt>Coverage</dt><dd>{fit ? `${Math.round(fit.coverage)}%` : "—"}</dd></div><div><dt>Adverts</dt><dd>{openings || "—"}</dd></div></dl><p>{nextGap ? <>Build next <strong>{nextGap.skill_name}</strong></> : "No priority gap is available yet."}</p><footer><button className="signal-link" onClick={() => onSelectRole(path)}>View analysis</button><button className="signal-link" onClick={() => navigate(productRoutes.decoder)}>Decode a job</button></footer></article>; })}</div></section>;
}

function SignalLeveragePlot({ fit }: { fit: RoleFit }) {
  const items = [...fit.contributions].sort((left, right) => right.weight - left.weight).slice(0, 8);
  if (!fit.market_posting_count) return <section className="signal-analysis-panel signal-prior-only"><header><h2>Where to put effort</h2><span>Prior only</span></header><p>No permitted postings are available for this role family. The benchmark remains based on occupational priors and does not invent market demand.</p></section>;
  const left = 52; const top = 24; const width = 466; const height = 220;
  const x = (value: number) => left + Math.max(0, Math.min(1, value)) * width;
  const y = (value: number) => top + height - Math.max(0, Math.min(100, value)) / 100 * height;
  const points = items.map((item) => ({ item, cx: x(item.market_frequency), cy: y(item.normalized_score) }));
  const labelY = new Map<string, number>();
  const spreadLabels = (group: typeof points) => {
    const minimum = top + 12; const maximum = top + height - 8; const separation = 18;
    const sorted = [...group].sort((a, b) => a.cy - b.cy);
    sorted.forEach((point, index) => labelY.set(point.item.skill_slug, Math.max(point.cy, index ? (labelY.get(sorted[index - 1].item.skill_slug) ?? minimum) + separation : minimum)));
    const overflow = Math.max(0, (labelY.get(sorted.at(-1)?.item.skill_slug ?? "") ?? maximum) - maximum);
    if (overflow) sorted.forEach((point) => labelY.set(point.item.skill_slug, (labelY.get(point.item.skill_slug) ?? point.cy) - overflow));
  };
  spreadLabels(points.filter((point) => point.cx < left + width * .68));
  spreadLabels(points.filter((point) => point.cx >= left + width * .68));
  return <section className="signal-analysis-panel signal-leverage"><header><h2>Where to put effort</h2><span>Bubble size = benchmark weight</span></header><svg viewBox="0 0 570 310" role="img" aria-label="Market demand against your evidence"><rect className="leverage-zone" x={left + width * .5} y={top + height * .5} width={width * .5} height={height * .5} /><text className="leverage-zone-label" x={left + width - 8} y={top + height - 9} textAnchor="end">High demand, weak evidence</text>{[0,.25,.5,.75,1].map((value) => <g key={`x-${value}`}><line className="leverage-grid" x1={x(value)} x2={x(value)} y1={top} y2={top + height} /><text className="leverage-tick" x={x(value)} y={top + height + 18} textAnchor="middle">{Math.round(value * 100)}%</text></g>)}{[0,25,50,75,100].map((value) => <g key={`y-${value}`}><line className="leverage-grid" x1={left} x2={left + width} y1={y(value)} y2={y(value)} /><text className="leverage-tick" x={left - 8} y={y(value) + 4} textAnchor="end">{value}</text></g>)}<line className="leverage-axis" x1={left} x2={left + width} y1={top + height} y2={top + height} /><line className="leverage-axis" x1={left} x2={left} y1={top} y2={top + height} />{points.map(({ item, cx, cy }) => { const labelRight = cx < left + width * .68; const labelX = labelRight ? Math.min(left + width - 82, cx + 14) : Math.max(left + 82, cx - 14); const resolvedLabelY = labelY.get(item.skill_slug) ?? cy; return <g key={item.skill_slug}><circle className={item.evidence_level === 0 ? "leverage-point gap" : "leverage-point"} cx={cx} cy={cy} r={6 + item.weight * 2}><title>{item.skill_name}: {Math.round(item.market_frequency * 100)}% of adverts, evidence {Math.round(item.normalized_score)}</title></circle><line className="leverage-label-line" x1={cx} y1={cy} x2={labelX} y2={resolvedLabelY} /><text className="leverage-label" x={labelX} y={resolvedLabelY - 3} textAnchor={labelRight ? "start" : "end"}>{item.skill_name}</text></g>; })}<text className="leverage-axis-label" x={left + width / 2} y="302" textAnchor="middle">Share of adverts naming the skill</text><text className="leverage-axis-label" x="13" y={top + height / 2} textAnchor="middle" transform={`rotate(-90 13 ${top + height / 2})`}>Your evidence score</text></svg></section>;
}

function SignalEvidenceQuality({ evidence }: { evidence: SkillEvidence[] }) {
  const levels = [5,4,3,2,1,0].map((level) => ({ level, count: evidence.filter((item) => item.evidence_level === level).length }));
  const categories = [...new Set(evidence.map((item) => item.category))].sort();
  const sources = [...new Set(evidence.map((item) => item.source_type.toLowerCase()))].sort();
  const domains = categories.map((category) => { const items = evidence.filter((item) => item.category === category); return { category, average: items.reduce((sum, item) => sum + item.evidence_level, 0) / Math.max(1, items.length), count: items.length }; }).sort((a, b) => b.average - a.average);
  return <div className="signal-quality-grid"><section className="signal-analysis-panel"><header><h2>Proof levels</h2><span>{evidence.length} skills</span></header><div className="proof-distribution">{levels.filter((item) => item.count).map((item) => <div key={item.level}><ProofGlyph level={item.level} /><span>{evidenceLabel(item.level)}</span><i><u style={{ width: `${item.count / Math.max(1, evidence.length) * 100}%` }} /></i><b>{item.count}</b></div>)}</div></section><section className="signal-analysis-panel"><header><h2>Strength by domain</h2><span>Average level</span></header><div className="domain-strength">{domains.map((item) => <div key={item.category}><span>{item.category}</span><i><u style={{ width: `${item.average / 5 * 100}%` }} /></i><b>{item.average.toFixed(1)}</b><small>{item.count} skill{item.count === 1 ? "" : "s"}</small></div>)}</div></section><section className="signal-analysis-panel"><header><h2>Source coverage</h2><span>Evidence items</span></header><div className="signal-table-wrap"><table className="signal-source-matrix"><thead><tr><th>Domain</th>{sources.map((source) => <th key={source}>{source === "cv" ? "CV" : source === "github" ? "GitHub" : source}</th>)}</tr></thead><tbody>{categories.map((category) => <tr key={category}><th>{category}</th>{sources.map((source) => { const count = evidence.filter((item) => item.category === category && item.source_type.toLowerCase() === source).length; return <td className={count ? "has" : ""} key={source}>{count || "–"}</td>; })}</tr>)}</tbody></table></div></section></div>;
}

function SignalRoleAnalysis({ targetRole, evidence, roleFits, market, selectedRole, loading, failed, onRetry, onSelectRole }: { targetRole: RoleKey; evidence: SkillEvidence[]; roleFits: RoleFitMap; market: MarketSummary | null; selectedRole: Exclude<RoleKey, ""> | ""; loading: boolean; failed: boolean; onRetry: () => void; onSelectRole: (role: Exclude<RoleKey, "">) => void }) {
  const allRoleKeys = Object.keys(roles) as Exclude<RoleKey, "">[];
  const activeRole = (selectedRole || targetRole || allRoleKeys[0]) as Exclude<RoleKey, "">;
  const roleKeys = [activeRole, ...allRoleKeys.filter((roleKey) => roleKey !== activeRole)];
  const fit = roleFits[activeRole];
  const evidenceBySlug = new Map(dedupeSkillEvidence(evidence).map((item) => [item.skill_slug, item]));
  return <><div className="signal-rolecards" role="group" aria-label="Role family">{roleKeys.map((roleKey) => { const item = roleFits[roleKey]; const adverts = market?.roles.find((entry) => entry.role_family === roleKey)?.count ?? item?.market_posting_count ?? 0; const gaps = item?.contributions.filter((entry) => entry.required && entry.evidence_level === 0).length ?? 0; return <button type="button" aria-pressed={roleKey === activeRole} className={roleKey === activeRole ? "active" : ""} key={roleKey} onClick={() => onSelectRole(roleKey)}><span>{roleKey === targetRole ? "Your target" : "\u00a0"}</span><strong>{roles[roleKey]}</strong><b>{item ? Math.round(item.score) : "—"}<small>/ 100</small></b><i><u style={{ width: `${item?.score ?? 0}%` }} /></i><em>{item ? scoreLabel(item.score) : loading ? "Loading" : "Unavailable"}</em><small>{item ? `${Math.round(item.coverage)}% covered · ${gaps} priority gap${gaps === 1 ? "" : "s"} · ${adverts} adverts` : "Benchmark unavailable"}</small></button>; })}</div>{fit ? <div className="signal-analysis-grid"><section className="signal-analysis-panel signal-skill-table"><header><h2>{roles[activeRole]}: skill by skill</h2><span>Benchmark weight · market share · your proof</span></header><div className="signal-table-wrap" role="region" aria-label={`${roles[activeRole]} skill benchmark`} tabIndex={0}><table><thead><tr><th>Benchmark skill</th><th>In adverts</th><th>Your proof</th><th>Score</th><th>Shown in</th></tr></thead><tbody>{[...fit.contributions].sort((a, b) => Number(b.required) - Number(a.required) || b.weight - a.weight).map((item) => { const source = evidenceBySlug.get(item.skill_slug); return <tr className={item.evidence_level === 0 ? "gap" : ""} key={item.skill_slug}><td><b>{item.skill_name}</b><small>{item.required ? "Essential" : "Supporting"} · weight {item.weight}</small></td><td>{fit.market_posting_count ? <><i className="mini-demand"><u style={{ width: `${item.market_frequency * 100}%` }} /></i>{Math.round(item.market_frequency * 100)}%</> : "Prior only"}</td><td><ProofGlyph level={item.evidence_level} /><small>{evidenceLabel(item.evidence_level)}</small></td><td><b>{Math.round(item.normalized_score)}</b></td><td><small>{source ? `${source.source_type} · ${source.locator}` : "—"}</small></td></tr>; })}</tbody></table></div><p>Score uses the reviewed evidence base adjusted for confidence, specificity, verification, outcomes and corroboration. {fit.market_posting_count ? `Market calibration uses ${fit.market_posting_count} indexed postings.` : "No posting sample is available; demand remains prior only."}</p></section><SignalLeveragePlot fit={fit} /></div> : <div className="alignment-loading">{failed ? <><span>Role-family benchmarks could not be loaded.</span><button type="button" className="signal-link" onClick={onRetry}>Retry</button></> : <><RefreshCw size={18} className="spin" />Preparing role-family benchmarks</>}</div>}</>;
}

function CapabilityProfileView({ role, evidence, roleFits, market, roleFitsLoading, roleFitsError, onRetryRoleFits, selectedRole, onSelectRole, evidenceFilter, onSelectEvidenceFilter, navigate }: { role: RoleKey; evidence: SkillEvidence[]; roleFits: RoleFitMap; market: MarketSummary | null; roleFitsLoading: boolean; roleFitsError: boolean; onRetryRoleFits: () => void; selectedRole: Exclude<RoleKey, ""> | ""; onSelectRole: (roleKey: Exclude<RoleKey, "">) => void; evidenceFilter: EvidenceRoleFilter; onSelectEvidenceFilter: (filter: EvidenceRoleFilter) => void; navigate: (path: string) => void }) {
  const uniqueEvidence = dedupeSkillEvidence(evidence);
  const activeFit = evidenceFilter === "all" ? null : roleFits[evidenceFilter];
  const activeSlugs = activeFit ? new Set(activeFit.contributions.map((item) => item.skill_slug)) : null;
  const filteredEvidence = activeSlugs ? uniqueEvidence.filter((item) => activeSlugs.has(item.skill_slug)) : uniqueEvidence;
  return <div className="tool-page capability-page signal-analysis-page">
    <SignalPageHead context={`One evidence record · 5 role-family benchmarks · ${market?.roles.find((item) => item.role_family === (selectedRole || role))?.count ?? 0} indexed postings`} title="How your evidence travels across roles" description="Pick a role family to see its benchmark against your record, which skills carry the most weight, and the nearest paths you could move into." />
    {uniqueEvidence.length ? <section className="capability-report personal-capability-report">
      <SignalRoleAnalysis targetRole={role} evidence={uniqueEvidence} roleFits={roleFits} market={market} selectedRole={selectedRole} loading={roleFitsLoading} failed={roleFitsError} onRetry={onRetryRoleFits} onSelectRole={onSelectRole} />
      <AdjacentPathsPanel role={role} market={market} roleFits={roleFits} navigate={navigate} onSelectRole={(roleKey) => { onSelectRole(roleKey); onSelectEvidenceFilter(roleKey); }} />
      <section className="analysis-quality-head"><div><h2>Quality of your evidence</h2><p>{filteredEvidence.length} matching capabilities from {uniqueEvidence.length} confirmed skills.</p></div><div className="profile-role-filter" role="tablist" aria-label="Filter evidence by role family"><button type="button" role="tab" aria-selected={evidenceFilter === "all"} className={evidenceFilter === "all" ? "active" : ""} onClick={() => onSelectEvidenceFilter("all")}>All skills</button>{role && <button type="button" role="tab" aria-selected={evidenceFilter === role} className={evidenceFilter === role ? "active" : ""} onClick={() => onSelectEvidenceFilter(role)}>{roles[role]} skills</button>}</div></section>
      <SignalEvidenceQuality evidence={filteredEvidence} />
      <details className="analysis-method"><summary>How the scores work, and what they are based on</summary><CapabilityMethodology /></details>
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
  const matrixColumns = `minmax(150px, 1.1fr) minmax(165px, 1fr) repeat(${jobs.length}, minmax(145px, 1fr))`;
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
  return <section className="jobs-compare-panel" aria-labelledby="jobs-compare-title"><header><div><span className="panel-kicker">Technical comparison</span><h2 id="jobs-compare-title">How the evidence baseline lines up</h2><p>Named advert requirements appear first. When an advert is too short to name technologies, the transparent role-family benchmark is shown and labelled as a reference.</p></div><span className="jobs-compare-count">{jobs.length} selected</span></header><div className="jobs-compare-grid">{jobs.map((job) => <article key={job.id}><div className="jobs-compare-card-head"><span>{job.role_family && roles[job.role_family as Exclude<RoleKey, "">] ? roles[job.role_family as Exclude<RoleKey, "">] : "Role analysis"}</span><button type="button" aria-label={`Remove ${job.title} from comparison`} onClick={() => onToggleCompare(job)}><X size={15} /></button></div><h3>{job.title}</h3><p>{job.company} · {job.location}</p><div className="jobs-compare-readiness"><strong>{job.skill_count ? `${job.evidenced_skill_count}/${job.skill_count}` : "—"}</strong><span>evidence covered</span><i><u style={{ width: `${job.skill_count ? Math.max(4, Math.min(100, (job.evidenced_skill_count / job.skill_count) * 100)) : 4}%` }} /></i></div><small>{job.status === "saved" ? "Ready to review" : applicationStageLabels[job.status]}{job.top_gaps.length ? ` · Next: ${job.top_gaps.slice(0, 2).join(", ")}` : ""}</small><div className="jobs-compare-requirements"><span>{job.comparison_warning ? "Role benchmark reference" : "Advert requirements"}</span>{details[job.id]?.skill_demands.slice(0, 4).map((demand) => <b key={demand.slug}>{demand.name}<small>{Math.round(demand.demand_score)} · {demand.importance}</small></b>)}{details[job.id] && !details[job.id]?.skill_demands.length && <small>No named technical requirements in this advert.</small>}{!details[job.id] && <small>{loading ? "Loading saved analysis..." : "Analysis details unavailable"}</small>}</div></article>)}</div>{loading && <div className="jobs-compare-state"><RefreshCw size={16} className="spin" />Loading saved analysis details</div>}{failed && !loading && <div className="jobs-compare-state"><span>Some saved analysis details could not be loaded. The evidence coverage above is still available.</span></div>}{!loading && !failed && capabilities.length > 0 && <section className="jobs-compare-matrix" aria-labelledby="jobs-compare-matrix-title"><header><div><span className="panel-kicker">Requirement matrix</span><h3 id="jobs-compare-matrix-title">What each job is asking for</h3></div><small>Higher values indicate stronger demand in the advertisement or benchmark reference.</small></header><div className="jobs-compare-matrix-table"><div className="jobs-compare-matrix-head" style={{ gridTemplateColumns: matrixColumns }}><strong>Capability</strong><span>Your evidence</span>{jobs.map((job) => <span key={job.id}>{job.title}</span>)}</div>{capabilities.map(([slug, capability]) => { const strongest = [...capability.jobs.values()].sort((a, b) => b.evidence_score - a.evidence_score)[0]; return <div className="jobs-compare-matrix-row" style={{ gridTemplateColumns: matrixColumns }} key={slug}><strong>{capability.name}</strong><span data-label="Your evidence" className={strongest?.evidence_level ? "present" : "absent"}>{strongest ? <><ProofGlyph level={strongest.evidence_level} /> {Math.round(strongest.evidence_score)} · {evidenceLabel(strongest.evidence_level)}</> : "No proof"}</span>{jobs.map((job) => { const demand = capability.jobs.get(job.id); return <span data-label={job.title} className={demand ? "present" : "absent"} key={job.id}>{demand ? `${Math.round(demand.demand_score)} · ${demand.importance}` : "Not detected"}</span>; })}</div>; })}</div></section>}</section>;
}

function SavedJobDecisionFactors({ jobs }: { jobs: SavedJob[] }) {
  const labels = [...new Set(jobs.flatMap((job) => (job.comparison_facts ?? []).map((fact) => fact.label)))];
  const valueFor = (job: SavedJob, label: string) => job.comparison_facts?.find((fact) => fact.label === label)?.value ?? "Not stated";
  return <section className="jobs-decision-factors" aria-labelledby="jobs-decision-factors-title">
    <header><div><span className="panel-kicker">Decision summary</span><h2 id="jobs-decision-factors-title">Choose on the differences that matter</h2><p>These values are extracted from each saved advertisement. “Not stated” means the source did not provide a reliable signal.</p></div></header>
    <div className="jobs-decision-table" aria-label="Saved role decision summary"><div className="jobs-decision-row jobs-decision-head"><strong>Decision factor</strong>{jobs.map((job) => <span key={job.id}>{job.company} · {job.title}</span>)}</div>{labels.map((label) => <div className="jobs-decision-row" key={label}><strong>{label}</strong>{jobs.map((job) => <span key={job.id}>{valueFor(job, label)}</span>)}</div>)}</div>
    {jobs.some((job) => job.comparison_warning) && <p className="jobs-comparison-warning">Technical requirements were not named clearly in one or more saved adverts. The benchmark below is a transparent role-family reference, not a claim about that employer’s exact stack.</p>}
  </section>;
}

function JobsView({ jobs, loading, history, historyJobId, historyLoading, comparisonJobIds, comparisonDetails, comparisonDetailsLoading, comparisonDetailsError, onToggleCompare, onClearCompare, onHistory, onStatus, onNotes, onDelete, onReview, onOpenAnalysis, navigate }: { jobs: SavedJob[]; loading: boolean; history: JobStatusEvent[]; historyJobId: string | null; historyLoading: boolean; comparisonJobIds: string[]; comparisonDetails: AnalysisDetailsMap; comparisonDetailsLoading: boolean; comparisonDetailsError: boolean; onToggleCompare: (job: SavedJob) => void; onClearCompare: () => void; onHistory: (job: SavedJob) => void; onStatus: (job: SavedJob, status: SavedJob["status"]) => void; onNotes: (job: SavedJob, notes: string) => void; onDelete: (job: SavedJob) => void; onReview: (job: SavedJob) => void; onOpenAnalysis: (job: SavedJob) => void; navigate: (path: string) => void }) {
  const active = jobs.filter((job) => !["rejected", "archived"].includes(job.status));
  const [compareMode, setCompareMode] = useState(comparisonJobIds.length > 0);
  const [showClosed, setShowClosed] = useState(false);
  const [notesJob, setNotesJob] = useState<SavedJob | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const comparisonJobs = jobs.filter((job) => comparisonJobIds.includes(job.id));
  return <>
  <div className="tool-page jobs-page">
    <header className="jobs-header"><div><p className="page-kicker-icon"><ClipboardList size={15} />Application tracker</p><h1>Your role decisions, in one place</h1><span>Keep saved opportunities, preparation and application outcomes connected to the same evidence profile.</span></div><div className="jobs-header-actions"><button className="secondary-button" onClick={() => { setCompareMode((current) => !current); if (compareMode) onClearCompare(); }}><Layers3 size={15} />{compareMode ? "Done selecting" : "Compare saved roles"}</button><button className="primary-button" onClick={() => navigate(productRoutes.decoder)}><BriefcaseBusiness size={15} />Compare another role</button></div></header>
    <section className="jobs-summary" aria-label="Application pipeline summary">
      <div><span>Active opportunities</span><strong>{active.length}</strong><small>excluding closed and archived roles</small></div>
      <div><span>Applications sent</span><strong>{jobs.filter((job) => ["applied", "interview", "offer"].includes(job.status)).length}</strong><small>currently in progress</small></div>
      <div><span>Interview stage</span><strong>{jobs.filter((job) => job.status === "interview").length}</strong><small>requiring preparation</small></div>
    </section>
    {compareMode && comparisonJobs.length >= 2 && <SavedJobDecisionFactors jobs={comparisonJobs} />}
    {compareMode && (comparisonJobs.length >= 2 ? <SavedRoleComparison jobs={comparisonJobs} details={comparisonDetails} loading={comparisonDetailsLoading} failed={comparisonDetailsError} onToggleCompare={onToggleCompare} /> : <section className="jobs-compare-panel" aria-labelledby="jobs-compare-title"><header><div><span className="panel-kicker">Role comparison</span><h2 id="jobs-compare-title">Compare saved analyses</h2><p>Select up to three saved roles below. The comparison stays here once two roles are selected.</p></div><span className="jobs-compare-count">{comparisonJobs.length} selected</span></header><div className="jobs-compare-empty"><Layers3 size={19} /><span>{comparisonJobs.length ? "Select one more saved role to compare." : "Select two or three saved roles from the list below."}</span></div></section>)}
    <section className="jobs-register">
      <header><div><span className="panel-kicker">Saved decisions</span><h2>Application pipeline</h2></div><small>{jobs.length} role{jobs.length === 1 ? "" : "s"}</small></header>
      {loading ? <div className="jobs-empty"><RefreshCw size={22} className="spin" /><h3>Loading your applications</h3></div> : jobs.length ? <><div className="signal-board" aria-label="Saved job applications">{(["saved", "preparing", "applied", "interview", "offer"] as const).map((stage) => { const stageJobs = jobs.filter((job) => job.status === stage); return <section className="signal-board-column" key={stage}><h3>{applicationStageLabels[stage]} <span>{stageJobs.length}</span></h3><div>{stageJobs.length ? stageJobs.map((job) => <article className="signal-job-card" key={job.id}>{compareMode && <label className="job-compare-toggle"><input type="checkbox" checked={comparisonJobIds.includes(job.id)} onChange={() => onToggleCompare(job)} disabled={!comparisonJobIds.includes(job.id) && comparisonJobIds.length >= 3} /><span>Compare</span></label>}<a href={job.analysis_id ? productRoutes.decoder : job.source_url} target={job.analysis_id ? undefined : "_blank"} rel={job.analysis_id ? undefined : "noreferrer"} onClick={job.analysis_id ? (event) => { event.preventDefault(); onOpenAnalysis(job); } : undefined}>{job.title}</a><p>{job.company} · {job.location}</p>{job.skill_count > 0 ? <div className="signal-readiness"><span>{job.evidenced_skill_count} of {job.skill_count} capabilities evidenced</span><i>{Array.from({ length: job.skill_count }, (_, index) => <u className={index < job.evidenced_skill_count ? "ready" : "gap"} key={index} />)}</i>{job.top_gaps.length > 0 && <small>Next: {job.top_gaps.slice(0, 2).join(", ")}</small>}</div> : <p>Review the full advertisement to measure readiness.</p>}{job.comparison_facts?.length ? <p className="signal-job-facts">{job.comparison_facts.slice(0, 3).map((fact) => fact.value).join(" · ")}</p> : null}{job.notes && <blockquote>{job.notes}</blockquote>}<label className="signal-stage-select"><span>Stage</span><select value={job.status} onChange={(event) => onStatus(job, event.target.value as SavedJob["status"])}>{applicationStages.map((nextStage) => <option key={nextStage} value={nextStage}>{applicationStageLabels[nextStage]}</option>)}</select></label><div className="signal-card-actions"><button type="button" onClick={() => onOpenAnalysis(job)}>Open analysis</button><button type="button" onClick={() => onReview(job)}>Review fit</button><button type="button" onClick={() => { setNotesJob(job); setNotesDraft(job.notes ?? ""); }}>Notes</button><button type="button" onClick={() => onHistory(job)} aria-expanded={historyJobId === job.id}>History</button><button type="button" className="danger-button" onClick={() => onDelete(job)}>Remove</button></div>{historyJobId === job.id && <div className="job-history-panel" aria-live="polite">{historyLoading ? <span>Loading stage history</span> : history.length ? <ol>{history.map((event) => <li key={event.id}><span>{event.from_status ? `${applicationStageLabels[event.from_status]} → ` : "Created as "}{applicationStageLabels[event.to_status]}</span><time dateTime={event.changed_at}>{new Date(event.changed_at).toLocaleString("en-NZ")}</time></li>)}</ol> : <span>No status changes recorded yet.</span>}</div>}</article>) : <p className="signal-board-empty">No roles at this stage.</p>}</div></section>; })}</div><button type="button" className="signal-closed" aria-expanded={showClosed} onClick={() => setShowClosed((current) => !current)}>{showClosed ? "Hide" : "View"} Closed {jobs.filter((job) => job.status === "rejected").length} · Archived {jobs.filter((job) => job.status === "archived").length}</button>{showClosed && <section className="closed-archived-list" aria-label="Closed and archived applications">{jobs.filter((job) => ["rejected", "archived"].includes(job.status)).length ? jobs.filter((job) => ["rejected", "archived"].includes(job.status)).map((job) => <article key={job.id}><div><span>{applicationStageLabels[job.status]}</span><h3>{job.title}</h3><p>{job.company} · {job.location}</p></div><button type="button" onClick={() => onOpenAnalysis(job)}>Open analysis</button></article>) : <p>No closed or archived applications.</p>}</section>}</> : <div className="jobs-empty"><Bookmark size={25} /><h3>No saved opportunities yet</h3><p>Search employer evidence and save a real vacancy, or compare a job advertisement before adding it to your pipeline.</p><div><button className="primary-button" onClick={() => navigate(productRoutes.market)}>Search employer evidence</button><button className="secondary-button" onClick={() => navigate(productRoutes.decoder)}>Compare an advertisement</button></div></div>}
    </section>
  </div>
  {notesJob && <div className="app-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setNotesJob(null); }}><section className="app-modal notes-modal" role="dialog" aria-modal="true" aria-labelledby="notes-modal-title"><header><div><span className="panel-kicker">Application notes</span><h2 id="notes-modal-title">{notesJob.title}</h2><p>Add a private reminder for this opportunity.</p></div><button type="button" className="icon-button" aria-label="Close notes" onClick={() => setNotesJob(null)}><X size={17} /></button></header><label className="field"><span>Notes</span><textarea autoFocus rows={6} value={notesDraft} onChange={(event) => setNotesDraft(event.target.value)} placeholder="What do you want to remember before the next step?" /></label><footer><button type="button" className="secondary-button" onClick={() => setNotesJob(null)}>Cancel</button><button type="button" className="primary-button" onClick={() => { onNotes(notesJob, notesDraft); setNotesJob(null); }}>Save notes <Check size={15} /></button></footer></section></div>}
  </>;
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

function AuthScreen({ onAuthenticated, initialMode = "register", onBack, onRoute, serviceState, onServiceState }: { onAuthenticated: (token: string, user: SessionUser) => void; initialMode?: "login" | "register" | "reset"; onBack?: () => void; onRoute: (path: string) => void; serviceState: ServiceState; onServiceState: (state: ServiceState) => void }) {
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
    fetchWithRecovery(`${API_URL}/api/v1/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: verifyToken }),
    }, onServiceState).then((response) => {
      setMessage(response.ok ? "Email verified. You can now sign in." : "This verification link is invalid or expired.");
    }).catch(() => setMessage("Could not verify this email link."));
  }, [onServiceState, verifyToken]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      if (mode === "forgot") {
        const response = await fetchWithRecovery(`${API_URL}/api/v1/auth/forgot-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }, onServiceState);
        if (!response.ok) throw new Error("Could not request a reset link");
        setMessage("If that account exists, a reset link has been sent.");
        return;
      }
      if (mode === "reset") {
        const response = await fetchWithRecovery(`${API_URL}/api/v1/auth/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: resetToken, password }) }, onServiceState);
        if (!response.ok) throw new Error("This reset link is invalid or expired");
        onRoute("/login?password=updated");
        return;
      }
      const response = await fetchWithRecovery(`${API_URL}/api/v1/auth/${mode}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "register" ? { display_name: name, email, password } : { email, password }),
      }, onServiceState);
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
  return <div className="auth-page"><aside className="auth-brand"><div className="auth-logo"><span className="auth-brand-mark"><CareerSignalMark size={26} /></span><strong>CareerSignal</strong></div>{onBack && <button className="auth-back" onClick={onBack}>Back to product overview</button>}<div className="auth-brand-copy"><h2>See how your skills match NZ tech roles.</h2><p>One reviewed evidence record, five role-family benchmarks and current New Zealand job records to check it against.</p></div><small>Your private evidence is never published as market data.</small></aside><div className="auth-form-side"><section className="auth-panel"><p className="auth-kicker">CareerSignal Tech NZ</p><h1>{title}</h1><p>{description}</p><form onSubmit={submit}>{mode === "register" && <label className="field"><span>Name</span><input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>}{mode !== "reset" && <label className="field"><span>Email</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>}{mode !== "forgot" && <label className="field"><span>Password</span><input required minLength={mode === "login" ? 1 : 12} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>}{(mode === "register" || mode === "reset") && <small>Use at least 12 characters.</small>}{mode === "login" && <button type="button" className="forgot-link" onClick={() => setMode("forgot")}>Forgot password?</button>}{serviceState === "waking" && <p className="service-message" role="status">The secure service is waking up. Your request will continue automatically.</p>}{serviceState === "unavailable" && <p className="form-error" role="alert">The secure service is not responding. Please retry in a moment.</p>}{message && <p className="success-message">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button auth-submit" disabled={submitting}>{submitting ? serviceState === "waking" ? "Waking secure service..." : "Connecting securely..." : mode === "register" ? "Create account" : mode === "login" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Update password"}<ArrowRight size={15} /></button></form><div className="auth-switch">{mode === "register" ? "Already have an account?" : mode === "login" ? "New to CareerSignal?" : "Return to sign in"}<button onClick={() => { if (mode === "forgot" || mode === "reset") { setMode("login"); } else { onRoute(mode === "register" ? "/login" : "/register"); } setError(""); setMessage(""); }}>{mode === "register" ? "Sign in" : mode === "login" ? "Create account" : "Sign in"}</button></div></section><p className="auth-note"><ShieldCheck size={14} />Your private evidence remains attached to your account.</p></div></div>;
}

function WelcomeScreen({ onChoose, onDemo }: { onChoose: (mode: "login" | "register") => void; onDemo: () => void }) {
  const [installPrompt, setInstallPrompt] = useState<PwaInstallEvent | null>(null);
  useEffect(() => {
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as PwaInstallEvent);
    };
    const clearPrompt = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", clearPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", clearPrompt);
    };
  }, []);
  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }
  const landing = demoLandingData;
  const graduateCount = landing.market.seniority.find((item) => /graduate|junior/i.test(item.seniority))?.count ?? 0;
  const aucklandCount = landing.market.locations.find((item) => item.location === "Auckland")?.count ?? 0;
  const wellingtonCount = landing.market.locations.find((item) => item.location === "Wellington")?.count ?? 0;
  const landingRoleCount = landing.market.roles.find((item) => item.role_family === landing.profile.role_family)?.count ?? landing.market.posting_count;
  const landingSkillCounts = new Map(landing.market.role_skills.filter((item) => item.role_family === landing.profile.role_family).map((item) => [item.skill_slug, item.count]));
  return <div className="signal-landing">
    <header className="landing-hero"><nav className="landing-nav"><button className="landing-logo" onClick={() => window.scrollTo({ top: 0 })}><CareerSignalMark size={22} /><b>CareerSignal</b><small>Tech NZ</small></button><div><a href="#questions">What it answers</a><a href="#market">NZ market</a><a href="#grading">How proof is graded</a><button onClick={() => onChoose("login")}>Sign in</button></div></nav><div className="landing-hero-grid"><div><h1>See how your skills match NZ tech roles.</h1><p>CareerSignal grades the proof behind each skill in your CV and GitHub, then compares it with what New Zealand tech employers ask for: by role family, and advert by advert.</p><div className="landing-actions"><button className="landing-light" onClick={onDemo}>Explore live demo</button><button className="landing-outline" onClick={() => onChoose("register")}>Create an account</button><button className="landing-text" onClick={() => onChoose("login")}>Sign in</button>{installPrompt && <button className="landing-text" onClick={installApp}><Download size={15} />Install app</button>}</div><small>The demo uses a fictional graduate with one CV, one GitHub repository and a portfolio site.</small></div><div className="landing-preview" aria-label="Example skill match report"><header><span>Skill match · {roles[landing.profile.role_family]}</span><span>{demoUser.display_name}</span></header><div className="landing-preview-score"><b>{Math.round(landing.fit.score)}</b><span>/ 100 evidence signal<br />{landing.fit.contributions.filter((item) => item.required && item.evidence_level > 0).length} of {landing.fit.contributions.filter((item) => item.required).length} core skills proven</span></div><div className="landing-preview-list">{landing.fit.contributions.map((item) => { const count = landingSkillCounts.get(item.skill_slug); const share = count === undefined ? null : Math.round(count / Math.max(landingRoleCount, 1) * 100); return <div key={item.skill_slug}><span>{share === null ? <small>Benchmark only</small> : <><small>{share}% market signal</small><i><u style={{ width: `${share}%` }} /></i></>}</span><b>{item.skill_name}</b><span className={item.evidence_level ? "proof" : "gap"}>{item.evidence_level ? <><ProofGlyph level={item.evidence_level} /><small>{evidenceLabel(item.evidence_level)}</small></> : "No proof on record"}</span></div>; })}</div></div></div></header>
    <section className="landing-marketband" aria-label="Current sample"><div><b>{landing.market.posting_count}</b><span>tech adverts in the current sample</span></div><div><b>{graduateCount}</b><span>open to graduates or juniors</span></div><div><b>{aucklandCount}</b><span>in Auckland</span></div><div><b>{wellingtonCount}</b><span>in Wellington</span></div><div><b>{landing.market.latest_retrieved_at ? new Date(landing.market.latest_retrieved_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short" }) : "—"}</b><span>last collected</span></div></section>
    <main className="landing-main"><section id="questions" className="landing-section"><header><h2>Three questions, answered from your own record.</h2><p>Every answer points to the advert line and the CV or GitHub file it came from, so you can check it and use it in an application.</p></header><div className="landing-three"><article><h3>Can I prove what this advert asks for?</h3><p>Paste an advert. Each requirement is matched to your strongest proof, or marked as a gap.</p></article><article><h3>Which roles is my record closest to?</h3><p>The same proof is scored against five NZ tech role families, weighted by current demand.</p></article><article><h3>What should I build next?</h3><p>Gaps are ranked by requirement, benchmark weight and observed market frequency.</p></article></div></section><section id="market" className="landing-section"><header><h2>What NZ tech adverts ask for.</h2><p>Counted across the bounded demo sample. Counts show what employers wrote, not who they hired.</p></header><div className="landing-market-grid"><table><thead><tr><th>Skill</th><th>Adverts</th><th>Share</th></tr></thead><tbody>{landing.market.top_skills.slice(0, 5).map((item) => <tr key={item.skill_slug}><td><b>{item.skill_name}</b></td><td>{item.count}</td><td><i><u style={{ width: `${item.count / landing.market.posting_count * 100}%` }} /></i>{Math.round(item.count / landing.market.posting_count * 100)}%</td></tr>)}</tbody></table><ul>{landing.market.roles.map((item) => <li key={item.role_family}><span>{roles[item.role_family as Exclude<RoleKey, "">]}</span><i><u style={{ width: `${item.count / Math.max(...landing.market.roles.map((roleItem) => roleItem.count)) * 100}%` }} /></i><b>{item.count}</b></li>)}</ul></div></section><section id="grading" className="landing-section"><header><h2>How proof is graded.</h2><p>Five levels, from a line on a CV to paid production work. You confirm every level before it counts.</p></header><div className="landing-proof-table">{[[1,"Claim","The skill is listed, with no inspectable example."],[2,"Used","A task describes where and why the skill was used."],[3,"Implemented","Something was built that another person can inspect."],[4,"Verified","The work includes tests, review or measured results."],[5,"Professional","Paid or production work is backed by a reference."]].map(([level,label,description]) => <div key={level}><ProofGlyph level={Number(level)} /><b>{label}</b><span>{description}</span></div>)}</div></section></main><footer className="landing-footer"><span>CareerSignal Tech NZ · Auckland</span><span>Bounded market sample, not the whole NZ market. Private evidence is never added to market counts.</span></footer>
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
  const [githubProfileLookupDone, setGithubProfileLookupDone] = useState(false);
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
  const [serviceState, setServiceState] = useState<ServiceState>("ready");
  const isDemo = token === DEMO_TOKEN;

  const authenticatedFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = token === DEMO_TOKEN
      ? await demoFetch(input, init)
      : await fetchWithRecovery(input, init, setServiceState);
    if (response.status === 401 && token && token !== DEMO_TOKEN) {
      const returnTo = `${routerLocation.pathname}${routerLocation.search}`;
      setToken(null);
      setUser(null);
      setSaved(false);
      setEditingProfile(true);
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
    }
    return response;
  }, [navigate, routerLocation.pathname, routerLocation.search, token]);

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
    if (window.sessionStorage.getItem(DEMO_SESSION_KEY) === "active") {
      // Session state is restored once when the application shell mounts.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(DEMO_TOKEN);
      setUser(demoUser);
      setCheckingSession(false);
      return;
    }
    fetchWithRecovery(`${API_URL}/api/v1/auth/refresh`, { method: "POST", credentials: "include" }, setServiceState)
      .then(async (response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        if (window.sessionStorage.getItem(DEMO_SESSION_KEY) === "active") return;
        setToken(data.access_token);
        setUser(data.user);
      })
      .catch(() => undefined)
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!token || !user?.is_verified) return;
    let active = true;
    const headers = { Authorization: `Bearer ${token}` };
    // Route entry synchronises the persisted profile into the workspace shell.
    Promise.all([
      // eslint-disable-next-line react-hooks/set-state-in-effect
      authenticatedFetch(`${API_URL}/api/v1/profile`, { headers }),
      authenticatedFetch(`${API_URL}/api/v1/evidence/uploads`, { headers }),
      authenticatedFetch(`${API_URL}/api/v1/evidence/github/projects`, { headers }),
    ]).then(async ([profileResponse, uploadsResponse, githubProjectsResponse]) => {
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
      if (githubProjectsResponse.ok) {
        const projects: GithubProject[] = await githubProjectsResponse.json();
        setGithubProjects(projects);
        setConfirmedGithub(new Set(projects.flatMap((project) => project.suggestions
          .filter((item) => item.review_status !== "rejected")
          .map((item) => item.id))));
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
  }, [authenticatedFetch, token, user?.is_verified]);

  useEffect(() => {
    if (!token || !cvUploadId || !["queued_for_scan", "scanning", "queued_for_parsing", "parsing"].includes(cvStatus)) return;
    const timer = window.setInterval(async () => {
      const response = await authenticatedFetch(`${API_URL}/api/v1/evidence/uploads`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) return;
      const uploads = await response.json();
      const current = uploads.find((upload: { id: string }) => upload.id === cvUploadId);
       if (current) { setCvStatus(current.status); setCvFailureReason(current.failure_reason ?? null); }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [authenticatedFetch, token, cvUploadId, cvStatus]);

  useEffect(() => {
    if (!token || !cvUploadId || cvStatus !== "awaiting_review") return;
    // Extraction completion synchronises server-reviewed suggestions into the form.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    authenticatedFetch(`${API_URL}/api/v1/evidence/uploads/${cvUploadId}/extraction`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        setSuggestions(data.suggestions);
        setConfirmedSuggestions(new Set(data.suggestions.map((item: EvidenceSuggestion) => item.id)));
      })
      .catch(() => setError("The CV was parsed, but its evidence could not be loaded."));
  }, [authenticatedFetch, token, cvUploadId, cvStatus]);

  useEffect(() => {
    if (!token || !view || !["market", "path", "graph"].includes(view)) return;
    let active = true;
    const headers = { Authorization: `Bearer ${token}` };
    // Market route entry synchronises the latest governed snapshot.
    Promise.all([
      // eslint-disable-next-line react-hooks/set-state-in-effect
      authenticatedFetch(`${API_URL}/api/v1/market/summary`, { headers }),
      authenticatedFetch(`${API_URL}/api/v1/market/quality`, { headers }),
    ]).then(async ([summaryResponse, qualityResponse]) => {
      if (!active) return;
      if (summaryResponse.ok) setMarket(await summaryResponse.json());
      if (qualityResponse.ok) setMarketQuality(await qualityResponse.json());
    }).catch(() => {
      if (active) setError("Market data could not be loaded.");
    });
    return () => { active = false; };
  }, [authenticatedFetch, token, view]);

  useEffect(() => {
    if (!token || !view || !["workspace", "jobs", "decoder"].includes(view)) return;
    let active = true;
    // This state mirrors an explicit route transition while the persisted records are fetched.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingJobs(true);
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      authenticatedFetch(`${API_URL}/api/v1/jobs`, { headers }),
      authenticatedFetch(`${API_URL}/api/v1/role-decoder/history`, { headers }),
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
  }, [authenticatedFetch, token, view]);

  useEffect(() => {
    if (!token || view !== "jobs" || comparisonJobIds.length < 2) {
      // Leaving comparison mode clears route-specific request state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
          const ensureResponse = await authenticatedFetch(`${API_URL}/api/v1/jobs/${job.id}/analysis`, { method: "POST", headers });
          const ensured = await apiPayload(ensureResponse) as SavedJob | { detail?: unknown } | null;
          if (!ensureResponse.ok || !ensured || !("id" in ensured)) throw new Error(apiError(ensured, "Saved job could not be prepared for comparison"));
          current = ensured as SavedJob;
        }
        const response = await authenticatedFetch(`${API_URL}/api/v1/role-decoder/history/${current.analysis_id}`, { headers });
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
      if (updatedJobs.size) {
        setSavedJobs((current) => {
          let changed = false;
          const next = current.map((job) => {
            const updated = updatedJobs.get(job.id);
            if (!updated || updated.analysis_id === job.analysis_id) return job;
            changed = true;
            return updated;
          });
          return changed ? next : current;
        });
      }
      setComparisonDetails(next);
      setComparisonDetailsError(failed);
    })().catch(() => {
      if (active) setComparisonDetailsError(true);
    }).finally(() => {
      if (active) setComparisonDetailsLoading(false);
    });
    return () => { active = false; };
  }, [authenticatedFetch, comparisonJobIds, savedJobs, token, view]);

  useEffect(() => {
    if (!token || !["graph", "path", "workspace"].includes(view ?? "") || !role) return;
    let active = true;
    const headers = { Authorization: `Bearer ${token}` };
    const roleKeys = Object.keys(roles) as Exclude<RoleKey, "">[];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRoleFitsLoading(true);
    setRoleFitsError(false);
    Promise.allSettled(roleKeys.map(async (roleKey) => {
      const response = await authenticatedFetch(`${API_URL}/api/v1/evidence/fit?role_family=${encodeURIComponent(roleKey)}`, { headers });
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
  }, [authenticatedFetch, role, roleFitsRefresh, token, view]);

  useEffect(() => {
    if (!token || !["graph", "workspace", "record", "market"].includes(view ?? "")) return;
    let active = true;
    const graphRole = role || "software";
    // Evidence is reloaded when entering a surface that reads the shared record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    authenticatedFetch(`${API_URL}/api/v1/evidence/graph?role_family=${encodeURIComponent(graphRole)}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<{ evidence: SkillEvidence[] }>;
      })
      .then((data) => { if (active) setPersonalEvidence(dedupeSkillEvidence(data.evidence ?? [])); })
      .catch(() => { if (active) setError("Your capability evidence could not be loaded."); });
    return () => { active = false; };
  }, [authenticatedFetch, role, token, view]);

  async function uploadCv(file: File) {
    if (!token) return;
    setError("");
    setCv(file);
    setCvFilename(file.name);
    setCvStatus("uploading");
    const contentType = file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    try {
      const initiated = await authenticatedFetch(`${API_URL}/api/v1/evidence/uploads`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ filename: file.name, content_type: contentType, size: file.size, cv_label: cvLabel.trim() || null, target_role: cvTargetRole || role || null }) });
      const upload = await initiated.json();
      if (!initiated.ok) throw new Error(apiError(upload, "Could not prepare upload"));
      setCvUploadId(upload.id);
      setCvFailureReason(null);
      const stored = await fetch(upload.upload_url, { method: "PUT", headers: { "Content-Type": contentType, "x-amz-meta-expected-size": String(file.size) }, body: file });
      if (!stored.ok) throw new Error("Object storage rejected the upload");
      const completed = await authenticatedFetch(`${API_URL}/api/v1/evidence/uploads/${upload.id}/complete`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
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
    if (token && cvUploadId) await authenticatedFetch(`${API_URL}/api/v1/evidence/uploads/${cvUploadId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
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
    const response = await authenticatedFetch(`${API_URL}/api/v1/evidence/uploads/${cvUploadId}/retry`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
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
        const review = await authenticatedFetch(`${API_URL}/api/v1/evidence/uploads/${cvUploadId}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ decisions: suggestions.map((item) => ({ suggestion_id: item.id, decision: confirmedSuggestions.has(item.id) ? "confirmed" : "rejected" })) }),
        });
        const reviewed = await apiPayload(review) as UploadRecord | { detail?: unknown } | null;
        if (!review.ok) throw new Error(apiError(reviewed, `Evidence review failed (${review.status})`));
        setCvStatus((reviewed as UploadRecord).status);
      }
      for (const githubProject of githubProjects.filter((item) => item.status === "awaiting_review")) {
        const review = await authenticatedFetch(`${API_URL}/api/v1/evidence/github/${githubProject.id}/review`, {
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
      const response = await authenticatedFetch(`${API_URL}/api/v1/profile`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ role_family: role, location, seniority, evidence_sources }) });
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

  async function refreshGithubProject(project: GithubProject) {
    if (!token) return;
    setError("");
    try {
      const response = await authenticatedFetch(`${API_URL}/api/v1/evidence/github/${project.id}/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const refreshed = await apiPayload(response) as GithubProject | { detail?: unknown } | null;
      if (!response.ok) throw new Error(apiError(refreshed, "Could not re-analyse this repository"));
      const nextProject = refreshed as GithubProject;
      setGithubProjects((current) => current.map((item) => item.id === nextProject.id ? nextProject : item));
      setConfirmedGithub((current) => {
        const next = new Set<string>();
        for (const item of nextProject.suggestions) {
          if (item.review_status === "confirmed" || item.review_status === "pending" && (current.has(item.id) || !current.size)) next.add(item.id);
        }
        return next;
      });
      setError(nextProject.status === "awaiting_review" ? "Repository re-analysed. Review the new or updated GitHub evidence before saving." : "Repository is up to date.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not re-analyse this repository");
    }
  }

  async function logout() {
    if (token === DEMO_TOKEN) {
      window.sessionStorage.removeItem(DEMO_SESSION_KEY);
      resetDemoData();
    } else {
      await fetchWithRecovery(`${API_URL}/api/v1/auth/logout`, { method: "POST", credentials: "include" }, setServiceState).catch(() => undefined);
    }
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
      const response = await authenticatedFetch(`${API_URL}/api/v1/role-decoder`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ title: decoderTitle, description: decoderDescription }) });
      const result = await response.json();
      if (!response.ok) { setError(apiError(result, "Could not decode this role")); return; }
      setDecodedRole(result);
      setDecoderFocus(result.scope_status === "mixed" ? result.role_family : "all");
      const historyResponse = await authenticatedFetch(`${API_URL}/api/v1/role-decoder/history`, { headers: { Authorization: `Bearer ${token}` } });
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
      const response = await authenticatedFetch(`${API_URL}/api/v1/role-decoder/history/${analysisId}`, { headers: { Authorization: `Bearer ${token}` } });
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
      const response = await authenticatedFetch(`${API_URL}/api/v1/rag/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: evidenceQuery, role_family: null, location: null, market_window_days: 180, limit: 8 }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(apiError(result, "Could not search market evidence"));
      setEvidenceResults(result.citations);
      setAiExplanation(null);
      const quality = await authenticatedFetch(`${API_URL}/api/v1/rag/judgements/quality`, { headers: { Authorization: `Bearer ${token}` } });
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
      const response = await authenticatedFetch(`${API_URL}/api/v1/rag/explain`, {
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
    const response = await authenticatedFetch(`${API_URL}/api/v1/rag/judgements`, {
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
      const response = await authenticatedFetch(`${API_URL}/api/v1/jobs`, {
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
      const response = await authenticatedFetch(`${API_URL}/api/v1/jobs/from-analysis/${decodedRole.analysis_id}`, {
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
      const response = await authenticatedFetch(`${API_URL}/api/v1/jobs/${job.id}`, {
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
    const response = await authenticatedFetch(`${API_URL}/api/v1/jobs/${job.id}`, {
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

  async function openSavedAnalysis(job: SavedJob) {
    if (!job.analysis_id) {
      setDecoderTitle(job.title);
      setDecoderDescription(job.description ?? "");
      setDecodedRole(null);
      navigate(productRoutes.decoder);
      return;
    }
    await restoreAnalysis(job.analysis_id);
    navigate(productRoutes.decoder);
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
      const response = await authenticatedFetch(`${API_URL}/api/v1/jobs/${job.id}/history`, { headers: { Authorization: `Bearer ${token}` } });
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
    const response = await authenticatedFetch(`${API_URL}/api/v1/jobs/${job.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
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
    const response = await authenticatedFetch(`${API_URL}/api/v1/account/export`, { headers: { Authorization: `Bearer ${token}` } });
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
    if (isDemo) throw new Error("Account deletion is disabled in the demo workspace.");
    const response = await authenticatedFetch(`${API_URL}/api/v1/account`, {
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

  if ((checkingSession && routerLocation.pathname.startsWith("/app")) || (token && user?.is_verified && loadingProfile)) return <div className="session-loading"><span>CS</span><div><i /><i /><i /></div>{serviceState === "waking" && <p>Secure service is waking up. This can take a few seconds.</p>}</div>;
  if (!token || !user) {
    if (routerLocation.pathname.startsWith("/app")) return <Navigate to={`/login?returnTo=${encodeURIComponent(`${routerLocation.pathname}${routerLocation.search}`)}`} replace />;
    if (routerLocation.pathname === "/") return <WelcomeScreen onChoose={(mode) => navigate(`/${mode}`)} onDemo={() => {
      resetDemoData();
      window.sessionStorage.setItem(DEMO_SESSION_KEY, "active");
      setToken(DEMO_TOKEN);
      setUser(demoUser);
      setLoadingProfile(true);
      navigate(productRoutes.workspace, { replace: true });
    }} />;
    if (["/login", "/register", "/reset-password", "/verify-email"].includes(routerLocation.pathname)) {
      const initialMode = routerLocation.pathname === "/register" ? "register" : routerLocation.pathname === "/reset-password" ? "reset" : "login";
      return <AuthScreen key={`${routerLocation.pathname}${routerLocation.search}`} initialMode={initialMode} onBack={() => navigate("/")} onRoute={(path) => navigate(path)} serviceState={serviceState} onServiceState={setServiceState} onAuthenticated={(accessToken, sessionUser) => {
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
    const isGithubProfileUrl = /^https?:\/\/github\.com\/[^/]+\/?$/.test(github.trim());
    if (isGithubProfileUrl && githubCandidates.length === 0 && !savedGithubUrls.has(normalizeSourceUrl(github))) {
      if (githubProfileLookupDone) {
        setError("This GitHub profile has no public repositories selected. Add a repository URL or choose another profile.");
        return;
      }
      const response = await authenticatedFetch(`${API_URL}/api/v1/evidence/github/profile?url=${encodeURIComponent(github.trim())}`, { headers: { Authorization: `Bearer ${token}` } });
      const candidates = await response.json();
      if (!response.ok) { setError(apiError(candidates, "Could not load GitHub repositories")); return; }
      setGithubCandidates(candidates);
      setGithubProfileLookupDone(true);
      if (!candidates.length) {
        setError("This GitHub profile has no public repositories. Add a repository URL or choose another profile.");
        return;
      }
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
        const response = await authenticatedFetch(`${API_URL}/api/v1/evidence/github`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ url: rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}` }) });
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
      <header className="signal-topbar">
        <div className="signal-topbar-inner">
          <button className="signal-logo" type="button" onClick={() => navigate(productRoutes.workspace)} aria-label="CareerSignal overview">
            <CareerSignalMark size={22} /><strong>CareerSignal</strong>
          </button>
          <nav aria-label="Product navigation">
            <button type="button" aria-current={view === "workspace" ? "page" : undefined} onClick={() => navigate(productRoutes.workspace)}>Overview</button>
            <button type="button" aria-current={view === "record" ? "page" : undefined} onClick={() => navigate(productRoutes.record)}>My evidence</button>
            <button type="button" aria-current={["graph", "path", "route"].includes(view) ? "page" : undefined} onClick={() => navigate(productRoutes.graph)}>Analysis</button>
            <button type="button" aria-current={view === "decoder" ? "page" : undefined} onClick={() => navigate(productRoutes.decoder)}>Job decoder</button>
            <button type="button" aria-current={["market", "evidence"].includes(view) ? "page" : undefined} onClick={openMarket}>Market</button>
            <button type="button" aria-current={view === "jobs" ? "page" : undefined} onClick={() => navigate(productRoutes.jobs)}>Applications{savedJobs.filter((job) => !["rejected", "archived"].includes(job.status)).length > 0 && <small className="nav-count">{savedJobs.filter((job) => !["rejected", "archived"].includes(job.status)).length}</small>}</button>
          </nav>
          <button className="signal-account" type="button" onClick={() => navigate(productRoutes.settings)} aria-label={`Settings for ${user.display_name}`}>
            <span>{user.display_name}</span><i>{user.display_name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</i>
          </button>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        {isDemo && <div className="demo-banner" role="status"><Compass size={15} /><span><strong>Demo workspace.</strong> Explore every feature; changes reset when you leave.</span></div>}
        {serviceState !== "ready" && !isDemo && <div className={`service-banner ${serviceState}`} role="status"><RefreshCw size={15} className={serviceState === "waking" ? "spin" : undefined} /><span>{serviceState === "waking" ? "Secure service is waking up. This can take a few seconds." : "The secure service is not responding. Your saved data has not changed."}</span>{serviceState === "unavailable" && <button type="button" onClick={() => window.location.reload()}>Retry</button>}</div>}

        {view === "decoder" && <div className="tool-page">
          {!decodedRole && <header><p className="page-kicker-icon"><BriefcaseBusiness size={15} />Role analysis</p><h1>Compare a role with your evidence</h1><span>CareerSignal builds the capability profile from this advertisement, then checks your saved evidence against the same capabilities.</span></header>}
          <section className="tool-panel decoder-workbench" aria-busy={decodingJob}>
            <details className="decoder-input" open={!decodedRole}><summary>{decodedRole ? "Decode another advert" : "Paste a job advertisement"}</summary><form className="decoder-form" onSubmit={decodeJob}><div className="decoder-form-main"><label className="field"><span>Advertised title <small>Optional</small></span><input id="decoder-title" value={decoderTitle} onChange={(event) => setDecoderTitle(event.target.value)} placeholder="e.g. Graduate Data Engineer" /></label><label className="field"><span>Job advertisement</span><textarea id="decoder-description" required minLength={40} value={decoderDescription} onChange={(event) => setDecoderDescription(event.target.value)} placeholder="Paste the responsibilities and requirements from the job advertisement" /></label><button type="submit" className="primary-button" disabled={decodingJob}>{decodingJob ? "Analysing advertisement..." : "Compare with my profile"} {!decodingJob && <ArrowRight size={15} />}</button></div><aside className="decoder-process"><h2>What CareerSignal extracts</h2><ol><li><span><strong>Role scope</strong><small>Identify the closest technical families and seniority.</small></span></li><li><span><strong>JD requirements</strong><small>Keep skills and hard conditions tied to the advertisement.</small></span></li><li><span><strong>Evidence comparison</strong><small>Compare the JD signals with your saved CV and project evidence.</small></span></li></ol><p>Your profile is reused automatically. No re-upload is needed for each job.</p></aside></form></details>
            {decodedRole && <SignalDecoderResult result={decodedRole} advert={decoderDescription} focus={decoderFocus} onFocus={setDecoderFocus} onSave={saveDecodedJob} />}
            {analysisHistory.length > 0 && <details className="analysis-history"><summary><span><History size={15} /><strong>Recent role analyses</strong><small>Saved to your workspace</small></span><ChevronDown size={16} /></summary><div>{analysisHistory.slice(0, 5).map((analysis) => <button type="button" key={analysis.id} onClick={() => restoreAnalysis(analysis.id)}><span><strong>{analysis.title || "Untitled advertisement"}</strong><small>{analysis.role_family} · {new Date(analysis.created_at).toLocaleDateString("en-NZ")}</small></span><b>{Math.round(analysis.confidence)}%</b></button>)}</div></details>}
            {error && <p className="form-error" role="alert">{error}</p>}
          </section>
        </div>}
         {view === "evidence" && <Navigate to={`${productRoutes.market}#ask`} replace />}
        {view === "market" && <><MarketView key={role || "default-market"} market={market} quality={marketQuality} targetRole={role} evidence={personalEvidence} navigate={navigate} /><section className="signal-page market-ask" id="ask" aria-busy={searchingEvidence || explainingEvidence}><div className="signal-section"><header><div><p className="signal-context">Grounded retrieval · indexed job records</p><h2>Ask the job records</h2><p>Ask a market question, inspect every source record, then generate a summary grounded only in those citations.</p></div></header><form onSubmit={searchEvidence}><label className="field"><span>Market question or capability</span><input id="evidence-query" required minLength={3} maxLength={500} value={evidenceQuery} onChange={(event) => setEvidenceQuery(event.target.value)} placeholder="e.g. testing expectations for junior data engineers" /></label><button type="submit" className="primary-button" disabled={searchingEvidence}>{searchingEvidence ? "Searching..." : "Search job records"}</button></form>{retrievalQuality?.labelled_count ? <div className="retrieval-quality" aria-live="polite"><span>Feedback labels <b>{retrievalQuality.labelled_count}</b></span><span>Relevant <b>{Math.round((retrievalQuality.relevance_rate ?? 0) * 100)}%</b></span><span>Mean relevant rank <b>{retrievalQuality.relevant_mean_rank ?? "-"}</b></span></div> : null}{evidenceResults && evidenceResults.length > 0 && <div className="ai-action"><div><strong>Summarise the findings</strong><span>Create a concise interpretation using only these records.</span></div><button type="button" className="secondary-button" onClick={explainEvidence} disabled={explainingEvidence}>{explainingEvidence ? "Analysing..." : "Generate summary"}</button></div>}{aiExplanation && <article className="ai-explanation" aria-live="polite"><div><span>Market summary</span><small>{aiExplanation.model}</small></div><p>{aiExplanation.answer}</p></article>}{evidenceResults && <div className="citation-list">{evidenceResults.length ? evidenceResults.map((item, index) => <article className="citation-card" key={item.citation_id}><header className="citation-card-header"><div className="citation-reference"><b>J{index + 1}</b><span><strong>{item.company}</strong><small>{item.location}</small></span></div><span className="citation-date">{item.published_at ? new Date(item.published_at).toLocaleDateString("en-NZ") : "Date unavailable"}</span></header><div className="citation-card-body"><h3>{item.title}</h3><p className="citation-preview">{evidencePreview(item.excerpt)}</p>{item.excerpt.length > 260 && <details className="citation-excerpt"><summary>Read full evidence excerpt</summary><p>{item.excerpt}</p></details>}</div><footer className="citation-card-footer"><div className="citation-feedback"><span className="citation-footer-label">Relevance</span>{judgedEvidence.has(item.citation_id) ? <span className="feedback-saved">Feedback saved</span> : <><button type="button" onClick={() => judgeEvidence(item, true, index + 1)}>Relevant</button><button type="button" onClick={() => judgeEvidence(item, false, index + 1)}>Not relevant</button></>}</div><div className="citation-actions"><button type="button" className="citation-save" disabled={savedJobs.some((job) => job.source_url.replace(/\/$/, "") === item.source_url.replace(/\/$/, ""))} onClick={() => saveEvidenceJob(item)}>{savedJobs.some((job) => job.source_url.replace(/\/$/, "") === item.source_url.replace(/\/$/, "")) ? "Saved" : "Save role"}</button><a href={item.source_url} target="_blank" rel="noreferrer">View source <ArrowRight size={13} /></a></div></footer></article>) : <div className="market-empty"><h3>No matching indexed evidence</h3><p>Try a broader query or remove role and location terms.</p></div>}</div>}{error && <p className="form-error" role="alert">{error}</p>}</div></section></>}
        {view === "path" && <Navigate to={productRoutes.graph} replace />}
        {view === "graph" && <CapabilityProfileView role={role} evidence={personalEvidence} roleFits={roleFits} market={market} roleFitsLoading={roleFitsLoading} roleFitsError={roleFitsError} onRetryRoleFits={() => setRoleFitsRefresh((current) => current + 1)} selectedRole={selectedProfileRole} onSelectRole={setSelectedProfileRole} evidenceFilter={profileEvidenceFilter} onSelectEvidenceFilter={setProfileEvidenceFilter} navigate={navigate} />}
        {view === "route" && <Navigate to={productRoutes.graph} replace />}
        {view === "jobs" && <JobsView jobs={savedJobs} loading={loadingJobs} history={jobHistory} historyJobId={historyJobId} historyLoading={loadingJobHistory} comparisonJobIds={comparisonJobIds} comparisonDetails={comparisonDetails} comparisonDetailsLoading={comparisonDetailsLoading} comparisonDetailsError={comparisonDetailsError} onToggleCompare={toggleJobComparison} onClearCompare={() => setComparisonJobIds([])} onHistory={toggleJobHistory} onStatus={updateJobStatus} onNotes={updateJobNotes} onDelete={deleteJob} onReview={reviewSavedJob} onOpenAnalysis={openSavedAnalysis} navigate={navigate} />}
        {view === "settings" && <AccountSettingsView user={user} onExport={exportAccountData} onDelete={deleteAccount} />}
        {view === "record" && <EvidenceRecordView evidence={personalEvidence} cvVersions={cvVersions} cvFilename={cvFilename} cvStatus={cvStatus} github={github} githubProjects={githubProjects} portfolio={portfolio} reviewedAt={profileUpdatedAt} onManage={() => { setEditingProfile(true); setStep(2); navigate(productRoutes.workspace); }} />}
        {view === "workspace" && <div className="setup-page">
          {(!saved || editingProfile || !role) && <header className="setup-header workspace-page-header">
            <p className="page-kicker-icon"><UserRound size={15} />Career profile</p>
            <h1>{saved && !editingProfile && role ? roles[role] : "Build your market profile"}</h1>
            <span>{saved && !editingProfile ? "Your saved evidence is reused across role analysis, career paths and market comparisons." : "Set a target market, add evidence of your work and review what can be demonstrated."}</span>
          </header>}

          {saved && !editingProfile && role ? <OverviewView role={role} location={location} seniority={seniority} reviewedAt={profileUpdatedAt} evidence={personalEvidence} roleFits={roleFits} market={market} jobs={savedJobs} cvFilename={cvFilename} cvStatus={cvStatus} github={github} githubProjects={githubProjects} portfolio={portfolio} onEdit={() => { setEditingProfile(true); setStep(1); }} navigate={navigate} /> : <>
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
                <label className="source-row"><span className="source-icon"><GitBranch size={19} /></span><div><strong>GitHub projects</strong><p>Use a profile URL to choose from all public repositories</p></div><div className="url-control"><Link2 size={15} /><input placeholder="https://github.com/username" value={github} onChange={(event) => { setGithub(event.target.value); setGithubProjects([]); setGithubCandidates([]); setGithubProfileLookupDone(false); }} /></div></label>
                {githubCandidates.length > 0 && <div className="github-candidates"><div><strong>Select projects to analyse</strong><span>{selectedGithubUrls.size} selected</span></div>{githubCandidates.map((candidate) => <label key={candidate.url}><input type="checkbox" checked={selectedGithubUrls.has(candidate.url)} onChange={() => setSelectedGithubUrls((current) => { const next = new Set(current); if (next.has(candidate.url)) next.delete(candidate.url); else next.add(candidate.url); return next; })} /><span><b>{candidate.name}</b><small>{candidate.language ?? "Repository"} · {candidate.stars} stars</small></span></label>)}</div>}
                {githubProfileLookupDone && githubCandidates.length === 0 && /^https?:\/\/github\.com\/[^/]+\/?$/.test(github.trim()) && <div className="github-empty-state"><GitBranch size={17} /><div><strong>No public repositories found</strong><span>This profile cannot provide project evidence yet. Add a repository URL or use another profile.</span></div></div>}
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
              {githubProjects.map((githubProject) => <div className="evidence-review" key={githubProject.id}><div className="evidence-review-heading"><strong>Review GitHub evidence · {githubProject.repository}</strong><div className="evidence-review-heading-actions"><span>{githubProject.suggestions.filter((item) => confirmedGithub.has(item.id)).length} of {githubProject.suggestions.length} selected</span><button type="button" className="text-button" onClick={() => refreshGithubProject(githubProject)}><RefreshCw size={14} />Re-analyse</button></div></div>{githubProject.suggestions.map((item) => <label className="evidence-item" key={item.id}><input type="checkbox" checked={confirmedGithub.has(item.id)} onChange={() => setConfirmedGithub((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} /><span><b>{item.canonical_skill}</b><small>{item.category} · conservative level {item.proposed_level}/5 · public repository</small><q>{item.excerpt}</q></span></label>)}</div>)}
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
