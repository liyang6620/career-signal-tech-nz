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

function AuthScreen({ onAuthenticated }: { onAuthenticated: (token: string, user: SessionUser) => void }) {
  const resetToken = new URLSearchParams(window.location.search).get("reset");
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">(resetToken ? "reset" : "register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

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
  return <div className="auth-page"><div className="auth-brand"><span>CS</span><strong>CareerSignal</strong></div><section className="auth-panel"><p className="auth-kicker">CareerSignal Tech NZ</p><h1>{title}</h1><p>{description}</p><form onSubmit={submit}>{mode === "register" && <label className="field"><span>Name</span><input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>}{mode !== "reset" && <label className="field"><span>Email</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>}{mode !== "forgot" && <label className="field"><span>Password</span><input required minLength={mode === "login" ? 1 : 12} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>}{(mode === "register" || mode === "reset") && <small>Use at least 12 characters.</small>}{mode === "login" && <button type="button" className="forgot-link" onClick={() => setMode("forgot")}>Forgot password?</button>}{message && <p className="success-message">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button auth-submit" disabled={submitting}>{submitting ? "Please wait..." : mode === "register" ? "Create account" : mode === "login" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Update password"}<ArrowRight size={15} /></button></form><div className="auth-switch">{mode === "register" ? "Already have an account?" : mode === "login" ? "New to CareerSignal?" : "Return to sign in"}<button onClick={() => { setMode(mode === "register" ? "login" : mode === "login" ? "register" : "login"); setError(""); setMessage(""); }}>{mode === "register" ? "Sign in" : mode === "login" ? "Create account" : "Sign in"}</button></div></section><p className="auth-note"><ShieldCheck size={14} />Your private evidence is never published as market data.</p></div>;
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
  const [portfolio, setPortfolio] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

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
    const evidence_sources = [
      ...(github.trim() ? [{ source_type: "github", source_reference: github.startsWith("http") ? github : `https://${github}` }] : []),
      ...(portfolio.trim() ? [{ source_type: "portfolio", source_reference: portfolio.startsWith("http") ? portfolio : `https://${portfolio}` }] : []),
    ];
    const response = await fetch(`${API_URL}/api/v1/profile`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ role_family: role, location, seniority, evidence_sources }) });
    const data = await response.json();
    if (!response.ok) { setError(data.detail ?? "Could not save profile"); return; }
    setSaved(true);
  }

  async function logout() {
    await fetch(`${API_URL}/api/v1/auth/logout`, { method: "POST", credentials: "include" });
    setToken(null);
    setUser(null);
    setStep(1);
  }

  if (checkingSession) return <div className="session-loading"><span>CS</span><div><i /><i /><i /></div></div>;
  if (!token || !user) return <AuthScreen onAuthenticated={(accessToken, sessionUser) => { setToken(accessToken); setUser(sessionUser); }} />;
  if (!user.is_verified) return <VerifyEmailScreen token={token} user={user} onVerified={() => setUser({ ...user, is_verified: true })} onSignOut={logout} />;

  function continueFromTarget() {
    if (!role) {
      setError("Choose a target role to continue.");
      return;
    }
    setError("");
    setStep(2);
  }

  function continueFromEvidence() {
    if (cvUploadId && ["uploading", "queued_for_scan", "scanning", "queued_for_parsing", "parsing", "failed", "rejected", "scan_failed", "parse_failed"].includes(cvStatus)) {
      setError("Wait for CV processing to finish, resolve the problem, or remove the file.");
      return;
    }
    if (!cvUploadId && !github.trim() && !portfolio.trim()) {
      setError("Add at least one evidence source, or skip this step and add evidence manually later.");
      return;
    }
    setError("");
    setStep(3);
  }

  return (
    <div className="product-shell">
      <aside className="sidebar">
        <div className="brand"><span>CS</span><strong>CareerSignal</strong></div>
        <nav aria-label="Product navigation">
          <a className="active"><LayoutDashboard size={17} />Workspace</a>
          <a><BarChart3 size={17} />Market explorer</a>
          <a><BriefcaseBusiness size={17} />Role decoder</a>
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

        <div className="setup-page">
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
                <label className="source-row"><span className="source-icon"><GitBranch size={19} /></span><div><strong>GitHub profile</strong><p>Public repositories only</p></div><div className="url-control"><Link2 size={15} /><input placeholder="github.com/username" value={github} onChange={(event) => setGithub(event.target.value)} /></div></label>
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
            </>}

            {error && <p className="form-error" role="alert">{error}</p>}
            <footer className="panel-actions">
              {step > 1 ? <button className="secondary-button" onClick={() => { setError(""); setStep((step - 1) as Step); }}><ArrowLeft size={15} />Back</button> : <span />}
              {step === 1 && <button className="primary-button" onClick={continueFromTarget}>Continue <ArrowRight size={15} /></button>}
              {step === 2 && <div className="action-group"><button className="text-button" onClick={() => { setError(""); setStep(3); }}>Skip for now</button><button className="primary-button" onClick={continueFromEvidence}>Review evidence <ArrowRight size={15} /></button></div>}
              {step === 3 && <button className="primary-button" onClick={saveProfile}>{saved ? <><Check size={15} />Profile saved</> : <>Create evidence profile <ArrowRight size={15} /></>}</button>}
            </footer>
          </section>
        </div>
      </main>
    </div>
  );
}
