import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleHelp,
  FileText,
  GitBranch,
  LayoutDashboard,
  Link2,
  LogOut,
  MapPin,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Target,
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

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
type SessionUser = { id: string; email: string; display_name: string; is_verified: boolean };
type EvidenceSuggestion = { id: string; canonical_skill: string; category: string; excerpt: string; locator: string; confidence: number; proposed_level: number; review_status: string };
type GithubProject = { id: string; repository: string; status: string; suggestions: EvidenceSuggestion[] };
type FitContribution = { skill_slug: string; skill_name: string; weight: number; required: boolean; evidence_level: number; normalized_score: number; weighted_score: number };
type RoleFit = { role_family: string; score: number; coverage: number; evidence_depth: number; cap_applied: boolean; contributions: FitContribution[] };
type ProductView = "workspace" | "market" | "decoder" | "evidence";
type EvidenceResult = { citation_id: string; title: string; company: string; location: string; source_url: string; published_at: string | null; excerpt: string; retrieval_score: number };

function AuthScreen({ onAuthenticated, initialMode = "register", onBack }: { onAuthenticated: (token: string, user: SessionUser) => void; initialMode?: "login" | "register"; onBack?: () => void }) {
  const resetToken = new URLSearchParams(window.location.search).get("reset");
  const verifyToken = new URLSearchParams(window.location.search).get("verify");
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">(resetToken || verifyToken ? "login" : initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!verifyToken) return;
    fetch(`${API_URL}/api/v1/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: verifyToken }),
    }).then((response) => {
      window.history.replaceState({}, "", window.location.pathname);
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
        window.history.replaceState({}, "", window.location.pathname);
        setMode("login");
        setMessage("Password updated. Sign in with your new password.");
        setPassword("");
        return;
      }
      const response = await fetch(`${API_URL}/api/v1/auth/${mode}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "register" ? { display_name: name, email, password } : { email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "Authentication failed");
      onAuthenticated(data.access_token, data.user);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  const title = mode === "register" ? "Create your career workspace" : mode === "login" ? "Welcome back" : mode === "forgot" ? "Reset your password" : "Choose a new password";
  const description = mode === "register" ? "Build an evidence-based profile for the New Zealand technology market." : mode === "login" ? "Sign in to continue your market and evidence analysis." : mode === "forgot" ? "Enter your account email and we will send a reset link." : "Your new password must contain at least 12 characters.";
  return <div className="auth-page"><div className="auth-brand"><span>CS</span><strong>CareerSignal</strong>{onBack && <button className="auth-back" onClick={onBack}>Back to product overview</button>}</div><section className="auth-panel"><p className="auth-kicker">CareerSignal Tech NZ</p><h1>{title}</h1><p>{description}</p><form onSubmit={submit}>{mode === "register" && <label className="field"><span>Name</span><input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>}{mode !== "reset" && <label className="field"><span>Email</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>}{mode !== "forgot" && <label className="field"><span>Password</span><input required minLength={mode === "login" ? 1 : 12} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>}{(mode === "register" || mode === "reset") && <small>Use at least 12 characters.</small>}{mode === "login" && <button type="button" className="forgot-link" onClick={() => setMode("forgot")}>Forgot password?</button>}{message && <p className="success-message">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button auth-submit" disabled={submitting}>{submitting ? "Please wait..." : mode === "register" ? "Create account" : mode === "login" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Update password"}<ArrowRight size={15} /></button></form><div className="auth-switch">{mode === "register" ? "Already have an account?" : mode === "login" ? "New to CareerSignal?" : "Return to sign in"}<button onClick={() => { setMode(mode === "register" ? "login" : mode === "login" ? "register" : "login"); setError(""); setMessage(""); }}>{mode === "register" ? "Sign in" : mode === "login" ? "Create account" : "Sign in"}</button></div></section><p className="auth-note"><ShieldCheck size={14} />Your private evidence is never published as market data.</p></div>;
}

function WelcomeScreen({ onChoose }: { onChoose: (mode: "login" | "register") => void }) {
  return <div className="welcome-page"><header className="welcome-nav"><div className="auth-brand"><span>CS</span><strong>CareerSignal</strong></div><nav className="welcome-nav-links"><a href="#how-it-works">How it works</a><a href="#evidence">Evidence standard</a></nav><button className="welcome-login" onClick={() => onChoose("login")}>Sign in</button></header><main className="welcome-main"><section className="welcome-hero"><p className="auth-kicker">CareerSignal Tech NZ</p><h1>Turn your experience into a credible technology career path.</h1><p className="welcome-lede">Understand which roles fit your evidence, what New Zealand employers ask for, and what to build next.</p><div className="welcome-actions"><button className="primary-button" onClick={() => onChoose("register")}>Build my career profile <ArrowRight size={15} /></button><button className="welcome-secondary" onClick={() => onChoose("login")}>I already have an account</button></div></section><section id="how-it-works" className="welcome-grid" aria-label="Product capabilities"><article><span>01</span><h2>Map your evidence</h2><p>Connect a CV and public GitHub projects, then review every skill claim before it affects your profile.</p></article><article><span>02</span><h2>Read the market</h2><p>Explore governed New Zealand job evidence with source links, role decoding and transparent data quality.</p></article><article><span>03</span><h2>Choose your next move</h2><p>See documented fit, capability gaps and adjacent technology roles without an opaque ATS score.</p></article></section><section id="evidence" className="welcome-journey"><div><span className="journey-label">YOUR FIRST SESSION</span><h2>From evidence to a next move</h2></div><ol><li><strong>Create a workspace</strong><span>Keep your profile and private evidence in one account.</span></li><li><strong>Review what is proven</strong><span>Confirm extracted CV and GitHub evidence before it counts.</span></li><li><strong>Compare your options</strong><span>Use role fit, market evidence and gaps to choose what to build next.</span></li></ol></section><p className="welcome-trust"><ShieldCheck size={15} />Your private evidence remains attached to your account and is never published as market data.</p></main></div>;
}

function VerifyEmailScreen({ token, user, onVerified, onSignOut }: { token: string; user: SessionUser; onVerified: () => void; onSignOut: () => void }) {
  const verificationToken = new URLSearchParams(window.location.search).get("verify");
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

  return <div className="auth-page"><div className="auth-brand"><span>CS</span><strong>CareerSignal</strong></div><section className="auth-panel verify-panel"><span className="verify-icon"><ShieldCheck size={22} /></span><p className="auth-kicker">Secure your account</p><h1>{status === "verifying" ? "Verifying your email..." : "Check your email"}</h1><p>We sent a verification link to <strong>{user.email}</strong>. Verify the address before creating a career profile.</p>{status === "sent" && <p className="success-message">A new link has been sent.</p>}{status === "error" && <p className="form-error">The link is invalid or expired. Request a new one.</p>}<button className="primary-button auth-submit" onClick={resend} disabled={status === "verifying"}>Resend verification email</button><button className="text-button verify-signout" onClick={onSignOut}>Sign out</button></section><p className="auth-note"><ShieldCheck size={14} />Verification links expire after 24 hours.</p></div>;
}

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authMode, setAuthMode] = useState<"welcome" | "login" | "register">("welcome");
  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState<RoleKey>("");
  const [location, setLocation] = useState("Auckland");
  const [seniority, setSeniority] = useState("Graduate / Junior");
  const [cv, setCv] = useState<File | null>(null);
  const [cvUploadId, setCvUploadId] = useState<string | null>(null);
  const [cvStatus, setCvStatus] = useState<string>("");
  const [suggestions, setSuggestions] = useState<EvidenceSuggestion[]>([]);
  const [confirmedSuggestions, setConfirmedSuggestions] = useState<Set<string>>(new Set());
  const [github, setGithub] = useState("");
  const [githubProject, setGithubProject] = useState<GithubProject | null>(null);
  const [confirmedGithub, setConfirmedGithub] = useState<Set<string>>(new Set());
  const [portfolio, setPortfolio] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [roleFit, setRoleFit] = useState<RoleFit | null>(null);
  const [view, setView] = useState<ProductView>("workspace");
  const [decoderTitle, setDecoderTitle] = useState("");
  const [decoderDescription, setDecoderDescription] = useState("");
  const [decodedRole, setDecodedRole] = useState<{ role_label: string; confidence: number; seniority: string; matched_skills: { name: string; mention_count: number }[] } | null>(null);
  const [market, setMarket] = useState<{ posting_count: number; roles: { role_family: string; count: number }[]; top_skills: { skill_name: string; count: number }[]; locations: { location: string; count: number }[] } | null>(null);
  const [marketQuality, setMarketQuality] = useState<{ missing_publication_date_percent: number; low_confidence_count: number; stale_posting_count: number; collector_completed_count: number; collector_failed_count: number; sources: { name: string; adapter: string; enabled: boolean; latest_status: string | null; last_run_at: string | null; accepted_count: number; rejected_count: number }[] } | null>(null);
  const [evidenceQuery, setEvidenceQuery] = useState("");
  const [evidenceResults, setEvidenceResults] = useState<EvidenceResult[] | null>(null);
  const [searchingEvidence, setSearchingEvidence] = useState(false);
  const [judgedEvidence, setJudgedEvidence] = useState<Set<string>>(new Set());
  const [retrievalQuality, setRetrievalQuality] = useState<{ labelled_count: number; relevant_count: number; relevance_rate: number | null; relevant_mean_rank: number | null } | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/auth/refresh`, { method: "POST", credentials: "include" })
      .then(async (response) => response.ok ? response.json() : Promise.reject())
      .then((data) => { setToken(data.access_token); setUser(data.user); })
      .catch(() => undefined)
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!token || !cvUploadId || !["queued_for_scan", "scanning", "queued_for_parsing", "parsing"].includes(cvStatus)) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`${API_URL}/api/v1/evidence/uploads`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) return;
      const uploads = await response.json();
      const current = uploads.find((upload: { id: string }) => upload.id === cvUploadId);
      if (current) setCvStatus(current.status);
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

  async function uploadCv(file: File) {
    if (!token) return;
    setError("");
    setCv(file);
    setCvStatus("uploading");
    const contentType = file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    try {
      const initiated = await fetch(`${API_URL}/api/v1/evidence/uploads`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ filename: file.name, content_type: contentType, size: file.size }) });
      const upload = await initiated.json();
      if (!initiated.ok) throw new Error(upload.detail ?? "Could not prepare upload");
      setCvUploadId(upload.id);
      const stored = await fetch(upload.upload_url, { method: "PUT", headers: { "Content-Type": contentType, "x-amz-meta-expected-size": String(file.size) }, body: file });
      if (!stored.ok) throw new Error("Object storage rejected the upload");
      const completed = await fetch(`${API_URL}/api/v1/evidence/uploads/${upload.id}/complete`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const result = await completed.json();
      if (!completed.ok) throw new Error(result.detail ?? "Could not complete upload");
      setCvStatus(result.status);
    } catch (caught) {
      setCvStatus("failed");
      setError(caught instanceof Error ? caught.message : "Upload failed");
    }
  }

  async function removeCv() {
    if (token && cvUploadId) await fetch(`${API_URL}/api/v1/evidence/uploads/${cvUploadId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setCv(null);
    setCvUploadId(null);
    setCvStatus("");
    setSuggestions([]);
    setConfirmedSuggestions(new Set());
  }

  async function saveProfile() {
    if (!token || !role) return;
    setError("");
    if (cvUploadId && cvStatus === "awaiting_review") {
      const review = await fetch(`${API_URL}/api/v1/evidence/uploads/${cvUploadId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ decisions: suggestions.map((item) => ({ suggestion_id: item.id, decision: confirmedSuggestions.has(item.id) ? "confirmed" : "rejected" })) }),
      });
      const reviewed = await review.json();
      if (!review.ok) { setError(reviewed.detail ?? "Could not save the evidence review"); return; }
      setCvStatus(reviewed.status);
    }
    if (githubProject?.status === "awaiting_review") {
      const review = await fetch(`${API_URL}/api/v1/evidence/github/${githubProject.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ decisions: githubProject.suggestions.map((item) => ({ suggestion_id: item.id, decision: confirmedGithub.has(item.id) ? "confirmed" : "rejected" })) }),
      });
      const reviewed = await review.json();
      if (!review.ok) { setError(reviewed.detail ?? "Could not save the GitHub evidence review"); return; }
      setGithubProject(reviewed);
    }
    const evidence_sources = [
      ...(github.trim() ? [{ source_type: "github", source_reference: github.startsWith("http") ? github : `https://${github}` }] : []),
      ...(portfolio.trim() ? [{ source_type: "portfolio", source_reference: portfolio.startsWith("http") ? portfolio : `https://${portfolio}` }] : []),
    ];
    const response = await fetch(`${API_URL}/api/v1/profile`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ role_family: role, location, seniority, evidence_sources }) });
    const data = await response.json();
    if (!response.ok) { setError(data.detail ?? "Could not save profile"); return; }
    setSaved(true);
    const fit = await fetch(`${API_URL}/api/v1/evidence/fit?role_family=${encodeURIComponent(role)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (fit.ok) setRoleFit(await fit.json());
  }

  async function logout() {
    await fetch(`${API_URL}/api/v1/auth/logout`, { method: "POST", credentials: "include" });
    setToken(null);
    setUser(null);
    setStep(1);
  }

  async function decodeJob(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch(`${API_URL}/api/v1/role-decoder`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ title: decoderTitle, description: decoderDescription }) });
    const result = await response.json();
    if (!response.ok) { setError(result.detail ?? "Could not decode this role"); return; }
    setDecodedRole(result);
  }

  async function openMarket() {
    setView("market");
    const headers = { Authorization: `Bearer ${token}` };
    const [summaryResponse, qualityResponse] = await Promise.all([
      fetch(`${API_URL}/api/v1/market/summary`, { headers }),
      fetch(`${API_URL}/api/v1/market/quality`, { headers }),
    ]);
    if (summaryResponse.ok) setMarket(await summaryResponse.json());
    if (qualityResponse.ok) setMarketQuality(await qualityResponse.json());
  }

  async function searchEvidence(event: FormEvent) {
    event.preventDefault();
    setSearchingEvidence(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/v1/rag/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: evidenceQuery, role_family: role || null, location, market_window_days: 180, limit: 8 }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Could not search market evidence");
      setEvidenceResults(result.citations);
      const quality = await fetch(`${API_URL}/api/v1/rag/judgements/quality`, { headers: { Authorization: `Bearer ${token}` } });
      if (quality.ok) setRetrievalQuality(await quality.json());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not search market evidence");
    } finally {
      setSearchingEvidence(false);
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

  if (checkingSession) return <div className="session-loading"><span>CS</span><div><i /><i /><i /></div></div>;
  if (!token || !user) {
    if (authMode === "welcome" && !new URLSearchParams(window.location.search).has("verify") && !new URLSearchParams(window.location.search).has("reset")) return <WelcomeScreen onChoose={setAuthMode} />;
    return <AuthScreen initialMode={authMode === "welcome" ? "login" : authMode} onBack={() => setAuthMode("welcome")} onAuthenticated={(accessToken, sessionUser) => { setToken(accessToken); setUser(sessionUser); }} />;
  }
  if (!user.is_verified) return <VerifyEmailScreen token={token} user={user} onVerified={() => setUser({ ...user, is_verified: true })} onSignOut={logout} />;

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
    if (github.trim() && !githubProject) {
      const url = github.startsWith("http") ? github : `https://${github}`;
      const response = await fetch(`${API_URL}/api/v1/evidence/github`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url }),
      });
      const project = await response.json();
      if (!response.ok) { setError(project.detail ?? "Could not inspect this GitHub repository"); return; }
      setGithubProject(project);
      setConfirmedGithub(new Set(project.suggestions.map((item: EvidenceSuggestion) => item.id)));
    }
    setError("");
    setStep(3);
  }

  return (
    <div className="product-shell">
      <aside className="sidebar">
        <div className="brand"><span>CS</span><strong>CareerSignal</strong></div>
        <nav aria-label="Product navigation">
          <button className={view === "workspace" ? "active" : ""} onClick={() => setView("workspace")}><LayoutDashboard size={17} />Workspace</button>
          <button className={view === "market" ? "active" : ""} onClick={openMarket}><BarChart3 size={17} />Market explorer</button>
          <button className={view === "decoder" ? "active" : ""} onClick={() => setView("decoder")}><BriefcaseBusiness size={17} />Role decoder</button>
          <button className={view === "evidence" ? "active" : ""} onClick={() => setView("evidence")}><Search size={17} />Evidence search</button>
          <a><Target size={17} />Career path map</a>
          <a><FileText size={17} />Evidence graph</a>
          <a><BookOpen size={17} />SkillRoute</a>
        </nav>
        <div className="sidebar-bottom"><a><CircleHelp size={17} />Help</a><a><Settings size={17} />Settings</a><div className="account"><UserRound size={18} /><span>{user.display_name}</span><button onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={15} /></button></div></div>
      </aside>

      <main>
        <header className="topbar">
          <div className="mobile-brand">CS</div>
          <span>Profile setup</span>
          <button className="quiet-button">Save and exit</button>
        </header>

        {view === "decoder" && <div className="tool-page"><header><p>Role decoder</p><h1>Decode the work behind the title</h1><span>Classification uses responsibilities and explicit skills. No AI model is involved.</span></header><section className="tool-panel"><form onSubmit={decodeJob}><label className="field"><span>Advertised title</span><input required minLength={2} value={decoderTitle} onChange={(event) => setDecoderTitle(event.target.value)} /></label><label className="field"><span>Responsibilities and requirements</span><textarea required minLength={40} value={decoderDescription} onChange={(event) => setDecoderDescription(event.target.value)} /></label><button className="primary-button">Analyse role <ArrowRight size={15} /></button></form>{decodedRole && <div className="decoder-result"><small>Best classification</small><h2>{decodedRole.role_label}</h2><p>{Math.round(decodedRole.confidence * 100)}% rule confidence · {decodedRole.seniority}</p><div>{decodedRole.matched_skills.map((skill) => <span key={skill.name}>{skill.name} <b>{skill.mention_count}</b></span>)}</div></div>}{error && <p className="form-error">{error}</p>}</section></div>}
        {view === "evidence" && <div className="tool-page"><header><p>Evidence RAG</p><h1>Search what employers actually ask for</h1><span>Results come from indexed, governed job records and link back to the original source.</span></header><section className="tool-panel evidence-search"><form onSubmit={searchEvidence}><label className="field"><span>Market question or capability</span><input required minLength={3} maxLength={500} value={evidenceQuery} onChange={(event) => setEvidenceQuery(event.target.value)} placeholder="e.g. testing expectations for junior data engineers" /></label><button className="primary-button" disabled={searchingEvidence}><Search size={15} />{searchingEvidence ? "Searching..." : "Search evidence"}</button></form>{retrievalQuality?.labelled_count ? <div className="retrieval-quality"><span>Feedback labels <b>{retrievalQuality.labelled_count}</b></span><span>Relevant <b>{Math.round((retrievalQuality.relevance_rate ?? 0) * 100)}%</b></span><span>Mean relevant rank <b>{retrievalQuality.relevant_mean_rank ?? "-"}</b></span></div> : null}{evidenceResults && <div className="citation-list">{evidenceResults.length ? evidenceResults.map((item, index) => <article key={item.citation_id}><div><b>J{index + 1}</b><span>{item.company} · {item.location}</span></div><h2>{item.title}</h2><p>{item.excerpt}</p><footer><span>{item.published_at ? new Date(item.published_at).toLocaleDateString("en-NZ") : "Publication date unavailable"}</span><span className="judgement-actions">{judgedEvidence.has(item.citation_id) ? "Feedback saved" : <><button type="button" onClick={() => judgeEvidence(item, true, index + 1)}>Relevant</button><button type="button" onClick={() => judgeEvidence(item, false, index + 1)}>Not relevant</button></>}</span><a href={item.source_url} target="_blank" rel="noreferrer">View source <ArrowRight size={13} /></a></footer></article>) : <div className="market-empty"><Search size={24} /><h2>No matching indexed evidence</h2><p>Try a broader query or remove the current role and location filters from your career profile.</p></div>}</div>}{error && <p className="form-error">{error}</p>}</section></div>}
        {view === "market" && <div className="tool-page"><header><p>Tech market explorer</p><h1>Imported New Zealand market evidence</h1><span>Only governed sources with recorded permission basis appear here.</span></header><section className="tool-panel">{market?.posting_count ? <><div className="market-total"><strong>{market.posting_count}</strong><span>classified postings</span></div><div className="market-columns"><div><h3>Role families</h3>{market.roles.map((item) => <p key={item.role_family}><span>{roles[item.role_family as Exclude<RoleKey, "">] ?? item.role_family}</span><b>{item.count}</b></p>)}</div><div><h3>Top skills</h3>{market.top_skills.map((item) => <p key={item.skill_name}><span>{item.skill_name}</span><b>{item.count}</b></p>)}</div><div><h3>Locations</h3>{market.locations.map((item) => <p key={item.location}><span>{item.location}</span><b>{item.count}</b></p>)}</div></div>{marketQuality && <div className="quality-report"><div><h3>Data quality</h3><p><span>Missing publication dates</span><b>{marketQuality.missing_publication_date_percent}%</b></p><p><span>Low-confidence classifications</span><b>{marketQuality.low_confidence_count}</b></p><p><span>Postings older than 90 days</span><b>{marketQuality.stale_posting_count}</b></p></div><div><h3>Collector health</h3><p><span>Completed runs</span><b>{marketQuality.collector_completed_count}</b></p><p><span>Failed runs</span><b>{marketQuality.collector_failed_count}</b></p></div><div><h3>Source freshness</h3>{marketQuality.sources.length ? marketQuality.sources.map((source) => <p key={`${source.adapter}-${source.name}`}><span>{source.name}<small>{source.adapter} · {source.last_run_at ? new Date(source.last_run_at).toLocaleDateString("en-NZ") : "not run"}</small></span><b className={source.latest_status === "failed" ? "quality-bad" : ""}>{source.latest_status ?? "pending"}</b></p>) : <p><span>No automated sources registered</span></p>}</div></div>}</> : <div className="market-empty"><BarChart3 size={24} /><h2>No governed market dataset loaded</h2><p>CareerSignal will not display fabricated counts. Import permitted company-career or licensed records through the ingestion API.</p></div>}</section></div>}
        {view === "workspace" && <div className="setup-page">
          <header className="setup-header">
            <p>Career profile</p>
            <h1>Start your career workspace</h1>
            <span>Choose a market context and add evidence. This profile connects to every CareerSignal module.</span>
          </header>

          <ol className="stepper" aria-label="Profile setup progress">
            {["Career target", "Evidence sources", "Review"].map((label, index) => {
              const number = (index + 1) as Step;
              return <li className={step === number ? "current" : step > number ? "complete" : ""} key={label}><i>{step > number ? <Check size={13} /> : number}</i><span>{label}</span></li>;
            })}
          </ol>

          <section className="setup-panel">
            {step === 1 && <>
              <div className="panel-title"><span className="panel-icon"><Target size={20} /></span><div><h2>Which role family should we analyse first?</h2><p>CareerSignal classifies jobs from their responsibilities, not from the advertised title alone.</p></div></div>
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
                <div className={`source-row ${cv ? "added" : ""}`}><span className="source-icon"><FileText size={19} /></span><div><strong>CV or resume</strong><p>{cv ? `${cv.name} · ${cvStatus.replaceAll("_", " ")}` : "PDF or DOCX, up to 10 MB"}</p></div>{cv ? <button className="icon-action" aria-label="Remove CV" onClick={removeCv}><X size={17} /></button> : <label className="upload-button"><UploadCloud size={15} />Choose file<input type="file" accept=".pdf,.docx" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadCv(file); }} /></label>}</div>
                <label className="source-row"><span className="source-icon"><GitBranch size={19} /></span><div><strong>GitHub project</strong><p>One public repository</p></div><div className="url-control"><Link2 size={15} /><input placeholder="github.com/username/repository" value={github} onChange={(event) => { setGithub(event.target.value); setGithubProject(null); }} /></div></label>
                <label className="source-row"><span className="source-icon"><Link2 size={19} /></span><div><strong>Portfolio or project</strong><p>Optional public URL</p></div><div className="url-control"><Link2 size={15} /><input placeholder="https://" value={portfolio} onChange={(event) => setPortfolio(event.target.value)} /></div></label>
                <button className="manual-source"><Plus size={16} />Add evidence manually</button>
              </div>
              <p className="privacy-note"><ShieldCheck size={15} />Private documents remain attached to your profile and are not published.</p>
            </>}

            {step === 3 && <>
              <div className="panel-title"><span className="panel-icon"><ShieldCheck size={20} /></span><div><h2>Review your analysis scope</h2><p>Confirm what CareerSignal should compare. No score has been generated yet.</p></div></div>
              <dl className="review-list">
                <div><dt>Target market</dt><dd><strong>{role ? roles[role] : "Not selected"}</strong><span>{location} · {seniority}</span></dd><button onClick={() => setStep(1)}>Edit</button></div>
                <div><dt>CV</dt><dd><strong>{cv?.name ?? "Not added"}</strong><span>{cv ? `Security status: ${cvStatus.replaceAll("_", " ")}` : "You can add one later"}</span></dd><button onClick={() => setStep(2)}>Edit</button></div>
                <div><dt>GitHub</dt><dd><strong>{github || "Not added"}</strong><span>{github ? "Public repositories will be reviewed" : "You can connect it later"}</span></dd><button onClick={() => setStep(2)}>Edit</button></div>
                {portfolio && <div><dt>Portfolio</dt><dd><strong>{portfolio}</strong><span>Public page</span></dd><button onClick={() => setStep(2)}>Edit</button></div>}
              </dl>
              <div className="consent"><label><input type="checkbox" defaultChecked /><span>I understand that generated findings must be reviewed before I use them in an application.</span></label></div>
              <div className="not-live"><strong>Evidence processing</strong><p>CVs are stored privately and must pass file-signature and malware checks before extraction. Evidence extraction begins only after a clean result.</p></div>
              {suggestions.length > 0 && <div className="evidence-review"><div className="evidence-review-heading"><strong>Review extracted evidence</strong><span>{confirmedSuggestions.size} of {suggestions.length} selected</span></div>{suggestions.map((item) => <label className="evidence-item" key={item.id}><input type="checkbox" checked={confirmedSuggestions.has(item.id)} onChange={() => setConfirmedSuggestions((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} /><span><b>{item.canonical_skill}</b><small>{item.category} · proposed level {item.proposed_level}/5 · {Math.round(item.confidence * 100)}% match</small><q>{item.excerpt}</q></span></label>)}</div>}
              {githubProject && <div className="evidence-review"><div className="evidence-review-heading"><strong>Review GitHub evidence · {githubProject.repository}</strong><span>{confirmedGithub.size} of {githubProject.suggestions.length} selected</span></div>{githubProject.suggestions.map((item) => <label className="evidence-item" key={item.id}><input type="checkbox" checked={confirmedGithub.has(item.id)} onChange={() => setConfirmedGithub((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} /><span><b>{item.canonical_skill}</b><small>{item.category} · conservative level {item.proposed_level}/5 · public repository</small><q>{item.excerpt}</q></span></label>)}</div>}
            </>}

            {error && <p className="form-error" role="alert">{error}</p>}
            <footer className="panel-actions">
              {step > 1 ? <button className="secondary-button" onClick={() => { setError(""); setStep((step - 1) as Step); }}><ArrowLeft size={15} />Back</button> : <span />}
              {step === 1 && <button className="primary-button" onClick={continueFromTarget}>Continue <ArrowRight size={15} /></button>}
              {step === 2 && <div className="action-group"><button className="text-button" onClick={() => { setError(""); setStep(3); }}>Skip for now</button><button className="primary-button" onClick={continueFromEvidence}>Review evidence <ArrowRight size={15} /></button></div>}
              {step === 3 && <button className="primary-button" onClick={saveProfile}>{saved ? <><Check size={15} />Profile saved</> : <>Create evidence profile <ArrowRight size={15} /></>}</button>}
            </footer>
          </section>
          {saved && roleFit && role && <section className="evidence-graph-panel"><div className="panel-title"><span className="panel-icon"><GitBranch size={20} /></span><div><h2>Candidate evidence graph</h2><p>Confirmed CV evidence mapped to the requirements of {roles[role]}.</p></div></div><div className="fit-summary"><div><span>Documented fit</span><strong>{roleFit.score}</strong><small>/ 100</small></div><div><span>Coverage</span><strong>{roleFit.coverage}%</strong></div><div><span>Evidence depth</span><strong>{roleFit.evidence_depth}%</strong></div></div><div className="skill-network">{roleFit.contributions.map((item) => <div className={`skill-node ${item.evidence_level ? "supported" : "missing"}`} key={item.skill_slug}><div><b>{item.skill_name}</b>{item.required && <em>required</em>}</div><span>{item.evidence_level ? `Level ${item.evidence_level}/5 · ${item.normalized_score}` : "No confirmed evidence"}</span><i><u style={{ width: `${Math.min(item.normalized_score, 100)}%` }} /></i></div>)}</div>{roleFit.cap_applied && <p className="fit-warning">A required capability is missing, so the documented fit is capped at 59. This is an auditable evidence gap, not a judgement of ability.</p>}</section>}
        </div>}
      </main>
    </div>
  );
}
