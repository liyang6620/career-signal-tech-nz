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
type RoleKey = "" | "software" | "data-analyst" | "data-engineer" | "ai" | "cloud";

const roles: Record<Exclude<RoleKey, "">, string> = {
  software: "Software Engineer",
  "data-analyst": "Data & BI Analyst",
  "data-engineer": "Data Engineer / Analytics Engineer",
  ai: "AI Application Engineer",
  cloud: "Cloud / DevOps Engineer",
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
type SessionUser = { id: string; email: string; display_name: string };

function AuthScreen({ onAuthenticated }: { onAuthenticated: (token: string, user: SessionUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
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

  return <div className="auth-page"><div className="auth-brand"><span>CS</span><strong>CareerSignal</strong></div><section className="auth-panel"><p className="auth-kicker">CareerSignal Tech NZ</p><h1>{mode === "register" ? "Create your career workspace" : "Welcome back"}</h1><p>{mode === "register" ? "Build an evidence-based profile for the New Zealand technology market." : "Sign in to continue your market and evidence analysis."}</p><form onSubmit={submit}>{mode === "register" && <label className="field"><span>Name</span><input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>}<label className="field"><span>Email</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label><label className="field"><span>Password</span><input required minLength={12} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} /></label>{mode === "register" && <small>Use at least 12 characters.</small>}{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button auth-submit" disabled={submitting}>{submitting ? "Please wait..." : mode === "register" ? "Create account" : "Sign in"}<ArrowRight size={15} /></button></form><div className="auth-switch">{mode === "register" ? "Already have an account?" : "New to CareerSignal?"}<button onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(""); }}>{mode === "register" ? "Sign in" : "Create account"}</button></div></section><p className="auth-note"><ShieldCheck size={14} />Your private evidence is never published as market data.</p></div>;
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

  async function saveProfile() {
    if (!token || !role) return;
    setError("");
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

  function continueFromTarget() {
    if (!role) {
      setError("Choose a target role to continue.");
      return;
    }
    setError("");
    setStep(2);
  }

  function continueFromEvidence() {
    if (!cv && !github.trim() && !portfolio.trim()) {
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
                <div className={`source-row ${cv ? "added" : ""}`}><span className="source-icon"><FileText size={19} /></span><div><strong>CV or resume</strong><p>{cv ? cv.name : "Object storage connection pending"}</p></div>{cv ? <button className="icon-action" aria-label="Remove CV" onClick={() => setCv(null)}><X size={17} /></button> : <span className="pending-upload"><UploadCloud size={15} />Coming next</span>}</div>
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
                <div><dt>CV</dt><dd><strong>{cv?.name ?? "Not added"}</strong><span>{cv ? "Ready for evidence extraction" : "You can add one later"}</span></dd><button onClick={() => setStep(2)}>Edit</button></div>
                <div><dt>GitHub</dt><dd><strong>{github || "Not added"}</strong><span>{github ? "Public repositories will be reviewed" : "You can connect it later"}</span></dd><button onClick={() => setStep(2)}>Edit</button></div>
                {portfolio && <div><dt>Portfolio</dt><dd><strong>{portfolio}</strong><span>Public page</span></dd><button onClick={() => setStep(2)}>Edit</button></div>}
              </dl>
              <div className="consent"><label><input type="checkbox" defaultChecked /><span>I understand that generated findings must be reviewed before I use them in an application.</span></label></div>
              <div className="not-live"><strong>Current implementation status</strong><p>Your account, target and public evidence-source references will be persisted. CV object storage and evidence extraction are the next production milestone.</p></div>
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
