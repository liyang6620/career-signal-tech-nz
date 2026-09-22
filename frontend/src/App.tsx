import { useState } from "react";
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

export default function App() {
  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState<RoleKey>("");
  const [location, setLocation] = useState("Auckland");
  const [seniority, setSeniority] = useState("Graduate / Junior");
  const [cv, setCv] = useState<File | null>(null);
  const [github, setGithub] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [error, setError] = useState("");

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
        <div className="sidebar-bottom"><a><CircleHelp size={17} />Help</a><a><Settings size={17} />Settings</a><div className="account"><UserRound size={18} /><span>New profile</span></div></div>
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
                <div className={`source-row ${cv ? "added" : ""}`}><span className="source-icon"><FileText size={19} /></span><div><strong>CV or resume</strong><p>{cv ? cv.name : "PDF or DOCX, up to 10 MB"}</p></div>{cv ? <button className="icon-action" aria-label="Remove CV" onClick={() => setCv(null)}><X size={17} /></button> : <label className="upload-button"><UploadCloud size={15} />Choose file<input type="file" accept=".pdf,.doc,.docx" onChange={(event) => setCv(event.target.files?.[0] ?? null)} /></label>}</div>
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
              <div className="not-live"><strong>Current implementation status</strong><p>The scoring API is available, but CV and GitHub extraction are not connected yet. Creating the profile will be enabled when ingestion and evidence-review endpoints are complete.</p></div>
            </>}

            {error && <p className="form-error" role="alert">{error}</p>}
            <footer className="panel-actions">
              {step > 1 ? <button className="secondary-button" onClick={() => { setError(""); setStep((step - 1) as Step); }}><ArrowLeft size={15} />Back</button> : <span />}
              {step === 1 && <button className="primary-button" onClick={continueFromTarget}>Continue <ArrowRight size={15} /></button>}
              {step === 2 && <div className="action-group"><button className="text-button" onClick={() => { setError(""); setStep(3); }}>Skip for now</button><button className="primary-button" onClick={continueFromEvidence}>Review evidence <ArrowRight size={15} /></button></div>}
              {step === 3 && <button className="primary-button" disabled title="Evidence ingestion is not implemented">Create evidence profile <ArrowRight size={15} /></button>}
            </footer>
          </section>
        </div>
      </main>
    </div>
  );
}
