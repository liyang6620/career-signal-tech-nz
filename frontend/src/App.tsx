import { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Check,
  CircleUserRound,
  FileText,
  GitBranch,
  LayoutDashboard,
  MapPin,
  MoreHorizontal,
  Search,
  Settings,
  Sparkles,
  Target,
} from "lucide-react";
import "./App.css";

type RoleKey = "software" | "data-analyst" | "data-engineer" | "ai";

const roles: Record<RoleKey, { label: string; count: number; scores: number[] }> = {
  software: { label: "Software Engineer", count: 214, scores: [72, 54, 78, 66, 61, 74] },
  "data-analyst": { label: "Data & BI Analyst", count: 128, scores: [68, 88, 61, 52, 86, 79] },
  "data-engineer": { label: "Data Engineer", count: 94, scores: [74, 81, 71, 76, 69, 65] },
  ai: { label: "AI Application Engineer", count: 67, scores: [76, 65, 74, 68, 78, 72] },
};

const dimensions = ["Programming", "Data", "Systems", "Delivery", "Analysis", "Product"];
const skillRows = [
  { skill: "SQL", demand: 82, level: "Strong evidence", score: 84, source: "NZ Migration Pipeline", tone: "strong" },
  { skill: "Python", demand: 68, level: "Strong evidence", score: 81, source: "AI Data Workspace", tone: "strong" },
  { skill: "Cloud platforms", demand: 49, level: "Strong evidence", score: 79, source: "AWS Pipeline", tone: "strong" },
  { skill: "Data modelling", demand: 44, level: "Needs proof", score: 38, source: "CV mention only", tone: "partial" },
  { skill: "Orchestration", demand: 36, level: "No evidence", score: 0, source: "Not found", tone: "missing" },
];

type SkillNodeData = { label: string; status: "strong" | "partial" | "gap" | "role"; detail: string };
function SkillNode({ data }: NodeProps<Node<SkillNodeData>>) {
  return (
    <div className={`skill-node ${data.status}`} title={data.detail}>
      <Handle type="target" position={Position.Left} />
      <span>{data.label}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { skill: SkillNode };
const nodes: Node<SkillNodeData>[] = [
  { id: "role", type: "skill", position: { x: 20, y: 165 }, data: { label: "Data Engineer", status: "role", detail: "Selected target role" } },
  { id: "sql", type: "skill", position: { x: 235, y: 35 }, data: { label: "SQL", status: "strong", detail: "Verified in projects" } },
  { id: "python", type: "skill", position: { x: 235, y: 125 }, data: { label: "Python", status: "strong", detail: "Verified in projects" } },
  { id: "model", type: "skill", position: { x: 235, y: 215 }, data: { label: "Data modelling", status: "partial", detail: "Limited implementation proof" } },
  { id: "orch", type: "skill", position: { x: 235, y: 305 }, data: { label: "Orchestration", status: "gap", detail: "No current evidence" } },
  { id: "aws", type: "skill", position: { x: 465, y: 75 }, data: { label: "AWS pipeline", status: "strong", detail: "S3, Glue, Athena and EventBridge" } },
  { id: "dbt", type: "skill", position: { x: 465, y: 205 }, data: { label: "dbt", status: "gap", detail: "Appears in 29% of sample roles" } },
  { id: "testing", type: "skill", position: { x: 465, y: 295 }, data: { label: "Data testing", status: "partial", detail: "Automation evidence incomplete" } },
];
const edges: Edge[] = [["role", "sql"], ["role", "python"], ["role", "model"], ["role", "orch"], ["sql", "aws"], ["python", "aws"], ["model", "dbt"], ["orch", "testing"]].map(([source, target], index) => ({
  id: `e-${index}`,
  source,
  target,
  markerEnd: { type: MarkerType.ArrowClosed, color: "#9aa2a9" },
  style: { stroke: "#9aa2a9", strokeWidth: 1.2 },
}));

export default function App() {
  const [role, setRole] = useState<RoleKey>("data-engineer");
  const [view, setView] = useState<"list" | "network">("list");
  const selected = roles[role];
  const overall = Math.round(selected.scores.reduce((sum, value) => sum + value, 0) / selected.scores.length);
  const radarOption = useMemo(() => ({
    animationDuration: 400,
    tooltip: { trigger: "item" },
    radar: {
      radius: "58%",
      center: ["50%", "51%"],
      splitNumber: 4,
      indicator: dimensions.map((name) => ({ name, max: 100 })),
      axisName: { color: "#59616a", fontSize: 11 },
      splitArea: { show: false },
      splitLine: { lineStyle: { color: "#e2e5e9" } },
      axisLine: { lineStyle: { color: "#e2e5e9" } },
    },
    series: [{ type: "radar", data: [
      { value: selected.scores, name: "Your evidence", symbolSize: 4, lineStyle: { color: "#166534", width: 2 }, itemStyle: { color: "#166534" }, areaStyle: { color: "rgba(22,101,52,.12)" } },
      { value: [82, 84, 78, 74, 72, 70], name: "Role benchmark", symbol: "none", lineStyle: { color: "#7b8490", width: 1.3, type: "dashed" }, areaStyle: { opacity: 0 } },
    ] }],
  }), [selected]);

  return (
    <div className="workspace">
      <aside className="sidebar">
        <div className="logo"><span>CS</span><strong>CareerSignal</strong></div>
        <nav aria-label="Main navigation">
          <p>Workspace</p>
          <a className="active"><LayoutDashboard size={17} />Overview</a>
          <a><Target size={17} />Target roles</a>
          <a><FileText size={17} />Evidence profile</a>
          <a><BriefcaseBusiness size={17} />Job tracker</a>
          <p>Career tools</p>
          <a><GitBranch size={17} />Skill map</a>
          <a><BookOpen size={17} />Development plan</a>
          <a><BarChart3 size={17} />Market insights</a>
        </nav>
        <div className="sidebar-footer"><a><Settings size={17} />Settings</a><div className="profile"><CircleUserRound size={28} /><span><strong>Yang Li</strong><small>Technology candidate</small></span><MoreHorizontal size={17} /></div></div>
      </aside>

      <main>
        <header className="app-header">
          <div className="mobile-logo">CS</div>
          <label className="global-search"><Search size={17} /><input aria-label="Search" placeholder="Search roles, skills and evidence" /></label>
          <button className="plain-button">Import evidence</button>
          <button className="primary-button"><Sparkles size={16} />Update profile</button>
        </header>

        <div className="page">
          <div className="page-title"><div><p className="kicker">Career workspace</p><h1>Good afternoon, Yang</h1><p>Track how your real work supports the roles you want.</p></div><span className="data-note">Demo market data</span></div>

          <section className="target-strip">
            <div className="target-copy"><span className="target-icon"><BriefcaseBusiness size={19} /></span><div><small>Primary target</small><select value={role} onChange={(event) => setRole(event.target.value as RoleKey)}>{Object.entries(roles).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></div></div>
            <div className="context-item"><small>Location</small><strong><MapPin size={14} />Auckland</strong></div>
            <div className="context-item"><small>Level</small><strong>Graduate / Junior</strong></div>
            <div className="context-item"><small>Market sample</small><strong>{selected.count} roles</strong></div>
            <button className="icon-button" aria-label="More target options"><MoreHorizontal size={18} /></button>
          </section>

          <div className="content-grid">
            <div className="main-column">
              <section className="section profile-section">
                <div className="section-header"><div><h2>Role readiness</h2><p>Based on evidence found in your CV and projects</p></div><button className="text-button">How scoring works</button></div>
                <div className="readiness-grid">
                  <div className="readiness-summary"><div className="score-ring"><strong>{overall}</strong><span>/100</span></div><h3>You have a credible foundation</h3><p>Your strongest evidence is in practical data pipelines. Two missing proof areas are holding back your match.</p><div className="legend"><span><i className="you" />Your evidence</span><span><i className="benchmark" />Role benchmark</span></div></div>
                  <ReactECharts option={radarOption} className="radar" />
                </div>
              </section>

              <section className="section skills-section">
                <div className="section-header"><div><h2>Skills and evidence</h2><p>What employers ask for, and where you can prove it</p></div><div className="view-switch"><button className={view === "list" ? "selected" : ""} onClick={() => setView("list")}>List</button><button className={view === "network" ? "selected" : ""} onClick={() => setView("network")}>Map</button></div></div>
                {view === "list" ? <div className="skill-list">
                  <div className="skill-list-head"><span>Skill</span><span>Demand</span><span>Evidence</span><span>Best source</span></div>
                  {skillRows.map((item) => <div className="skill-row" key={item.skill}><strong>{item.skill}</strong><span className="demand"><i style={{ width: `${item.demand}%` }} />{item.demand}%</span><span className={`evidence-state ${item.tone}`}>{item.tone === "strong" && <Check size={13} />}{item.level}</span><span>{item.source}</span></div>)}
                </div> : <div className="network-canvas"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.18 }} minZoom={0.35} maxZoom={1.4}><Background color="#e1e4e8" gap={24} size={1} /><Controls showInteractive={false} /></ReactFlow></div>}
              </section>
            </div>

            <aside className="right-column">
              <section className="next-step">
                <p className="kicker">Recommended next step</p><h2>Make your pipeline production-ready</h2><p>Add a dbt transformation layer and automated data-quality checks to your migration project.</p>
                <div className="impact"><span>Potential coverage</span><strong>73 <ArrowRight size={15} /> 84</strong></div>
                <button className="primary-button wide">View 8-week plan <ArrowRight size={16} /></button>
              </section>
              <section className="priorities">
                <div className="section-header"><div><h2>Priority gaps</h2><p>Ranked by market value</p></div></div>
                <ol>
                  <li><span>1</span><div><strong>dbt modelling</strong><p>Referenced in 29% of sampled roles</p></div></li>
                  <li><span>2</span><div><strong>Automated data tests</strong><p>Strengthens existing pipeline evidence</p></div></li>
                  <li><span>3</span><div><strong>Workflow orchestration</strong><p>No current implementation evidence</p></div></li>
                </ol>
              </section>
              <section className="activity">
                <div className="section-header"><div><h2>Evidence activity</h2></div><button className="text-button">View all</button></div>
                <div><span className="activity-mark"><GitBranch size={15} /></span><p><strong>AWS Pipeline</strong> supports 4 target skills<small>Reviewed today</small></p></div>
                <div><span className="activity-mark"><FileText size={15} /></span><p><strong>CV profile</strong> has 2 claims without proof<small>Reviewed 2 days ago</small></p></div>
              </section>
            </aside>
          </div>
          <p className="method-note">CareerSignal measures documented evidence against a selected market. It does not claim to measure your absolute ability.</p>
        </div>
      </main>
    </div>
  );
}
