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
  BarChart3,
  BriefcaseBusiness,
  ChevronDown,
  Database,
  ExternalLink,
  GitBranch,
  MapPin,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import "./App.css";

type RoleKey = "software" | "data-analyst" | "data-engineer" | "ai";
const roles: Record<
  RoleKey,
  { label: string; count: number; scores: number[] }
> = {
  software: {
    label: "Software Engineer",
    count: 214,
    scores: [72, 54, 78, 66, 61, 74],
  },
  "data-analyst": {
    label: "Data & BI Analyst",
    count: 128,
    scores: [68, 88, 61, 52, 86, 79],
  },
  "data-engineer": {
    label: "Data Engineer",
    count: 94,
    scores: [74, 81, 71, 76, 69, 65],
  },
  ai: {
    label: "AI Application Engineer",
    count: 67,
    scores: [76, 65, 74, 68, 78, 72],
  },
};
const dimensions = [
  "Programming",
  "Data & DBs",
  "Systems",
  "Cloud & Delivery",
  "Analysis",
  "Product",
];
type SkillNodeData = {
  label: string;
  status: "strong" | "partial" | "gap" | "role";
  detail: string;
};
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
const skillNodes: Node<SkillNodeData>[] = [
  {
    id: "role",
    type: "skill",
    position: { x: 20, y: 165 },
    data: {
      label: "Data Engineer",
      status: "role",
      detail: "Selected target role",
    },
  },
  {
    id: "sql",
    type: "skill",
    position: { x: 235, y: 35 },
    data: {
      label: "SQL",
      status: "strong",
      detail: "Verified by Athena reporting and analytics projects",
    },
  },
  {
    id: "python",
    type: "skill",
    position: { x: 235, y: 125 },
    data: {
      label: "Python",
      status: "strong",
      detail: "Verified by deployed applications and data pipelines",
    },
  },
  {
    id: "model",
    type: "skill",
    position: { x: 235, y: 215 },
    data: {
      label: "Data modelling",
      status: "partial",
      detail: "Mentioned, but implementation evidence is limited",
    },
  },
  {
    id: "orch",
    type: "skill",
    position: { x: 235, y: 305 },
    data: {
      label: "Orchestration",
      status: "gap",
      detail: "No current project evidence",
    },
  },
  {
    id: "aws",
    type: "skill",
    position: { x: 465, y: 75 },
    data: {
      label: "AWS pipeline",
      status: "strong",
      detail: "S3, Glue, Athena and EventBridge project evidence",
    },
  },
  {
    id: "dbt",
    type: "skill",
    position: { x: 465, y: 205 },
    data: {
      label: "dbt",
      status: "gap",
      detail: "Appears in 29% of current sample roles",
    },
  },
  {
    id: "testing",
    type: "skill",
    position: { x: 465, y: 295 },
    data: {
      label: "Data testing",
      status: "partial",
      detail: "Validation exists; automated test evidence is incomplete",
    },
  },
];
const skillEdges: Edge[] = [
  ["role", "sql"],
  ["role", "python"],
  ["role", "model"],
  ["role", "orch"],
  ["sql", "aws"],
  ["python", "aws"],
  ["model", "dbt"],
  ["orch", "testing"],
].map(([source, target], index) => ({
  id: `e-${index}`,
  source,
  target,
  markerEnd: { type: MarkerType.ArrowClosed, color: "#889197" },
  style: { stroke: "#889197", strokeWidth: 1.4 },
}));
const evidenceRows = [
  {
    skill: "SQL",
    demand: "82%",
    level: "Verified",
    score: 84,
    source: "NZ Migration Pipeline",
  },
  {
    skill: "Python",
    demand: "68%",
    level: "Verified",
    score: 81,
    source: "AI Data Workspace",
  },
  {
    skill: "Cloud platform",
    demand: "49%",
    level: "Verified",
    score: 79,
    source: "AWS Pipeline",
  },
  {
    skill: "Data modelling",
    demand: "44%",
    level: "Claimed",
    score: 38,
    source: "CV only",
  },
  {
    skill: "Orchestration",
    demand: "36%",
    level: "Missing",
    score: 0,
    source: "No evidence",
  },
];

export default function App() {
  const [role, setRole] = useState<RoleKey>("data-engineer");
  const selected = roles[role];
  const radarOption = useMemo(
    () => ({
      animationDuration: 700,
      tooltip: { trigger: "item" },
      radar: {
        radius: "66%",
        center: ["56%", "50%"],
        splitNumber: 5,
        indicator: dimensions.map((name) => ({ name, max: 100 })),
        axisName: { color: "#30363a", fontSize: 12 },
        splitArea: { areaStyle: { color: ["#fbfcfc", "#f5f7f6"] } },
        splitLine: { lineStyle: { color: "#dce2df" } },
        axisLine: { lineStyle: { color: "#cdd5d1" } },
      },
      series: [
        {
          type: "radar",
          data: [
            {
              value: selected.scores,
              name: "Current evidence coverage",
              symbolSize: 6,
              lineStyle: { color: "#087f5b", width: 2 },
              itemStyle: { color: "#087f5b" },
              areaStyle: { color: "rgba(8, 127, 91, 0.22)" },
            },
            {
              value: [82, 84, 78, 74, 72, 70],
              name: "Market benchmark",
              symbol: "none",
              lineStyle: { color: "#d97706", width: 1.5, type: "dashed" },
              areaStyle: { opacity: 0 },
            },
          ],
        },
      ],
    }),
    [selected],
  );
  const overall = Math.round(
    selected.scores.reduce((sum, value) => sum + value, 0) /
      selected.scores.length,
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">CS</span>
          <span>CareerSignal</span>
        </div>
        <nav>
          <a className="active">
            <BarChart3 size={18} /> Overview
          </a>
          <a>
            <BriefcaseBusiness size={18} /> Role explorer
          </a>
          <a>
            <GitBranch size={18} /> Skill network
          </a>
          <a>
            <Target size={18} /> Roadmap
          </a>
          <a>
            <Database size={18} /> Market evidence
          </a>
        </nav>
        <div className="sidebar-meta">
          <span>Demonstration dataset</span>
          <strong>503 sample roles</strong>
          <small>Not live market data</small>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">Evidence profile</p>
            <h1>Technology career coverage</h1>
          </div>
          <div className="top-actions">
            <button className="search-button">
              <Search size={17} /> Ask the market
            </button>
            <button className="primary">
              <Sparkles size={17} /> Build roadmap
            </button>
          </div>
        </header>
        <section className="context-bar">
          <label>
            Target role
            <span className="select-wrap">
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as RoleKey)}
              >
                {Object.entries(roles).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} />
            </span>
          </label>
          <label>
            Location{" "}
            <button className="filter">
              <MapPin size={15} /> Auckland
            </button>
          </label>
          <label>
            Seniority <button className="filter">Graduate / Junior</button>
          </label>
          <div className="sample">
            <strong>{selected.count}</strong>
            <span>matched demo roles</span>
          </div>
        </section>
        <section className="summary-grid">
          <article className="score-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Current profile</p>
                <h2>Evidence coverage</h2>
              </div>
              <div className="score">
                <strong>{overall}</strong>
                <span>/100</span>
              </div>
            </div>
            <ReactECharts option={radarOption} style={{ height: 355 }} />
            <div className="legend">
              <span>
                <i className="current" /> Current evidence
              </span>
              <span>
                <i className="benchmark" /> Market benchmark
              </span>
            </div>
          </article>
          <article className="insight-panel">
            <p className="eyebrow">Market interpretation</p>
            <h2>Your fastest route forward</h2>
            <p className="lead">
              Your cloud pipeline gives you strong evidence in Python, AWS and
              ETL. The largest coverage gain comes from making the
              transformation layer testable and explicit.
            </p>
            {[
              [
                "01",
                "Add dbt modelling to the migration pipeline",
                "Expected role coverage gain: +11 percentage points",
              ],
              [
                "02",
                "Add automated data quality tests",
                "Referenced by 34% of matched roles",
              ],
              [
                "03",
                "Document orchestration and recovery",
                "Closes the highest-weight missing capability",
              ],
            ].map(([rank, title, detail]) => (
              <div className="recommendation" key={rank}>
                <span className="rank">{rank}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{detail}</p>
                </div>
              </div>
            ))}
            <button className="text-link">
              View the 8-week route <ExternalLink size={15} />
            </button>
          </article>
        </section>
        <section className="network-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Explainable scoring</p>
              <h2>Skill evidence network</h2>
            </div>
            <div className="status-key">
              <span className="strong-dot" />
              Verified <span className="partial-dot" />
              Partial <span className="gap-dot" />
              Gap
            </div>
          </div>
          <div className="network-canvas">
            <ReactFlow
              nodes={skillNodes}
              edges={skillEdges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.18 }}
              minZoom={0.35}
              maxZoom={1.4}
            >
              <Background color="#d9dfdc" gap={22} size={1} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
        </section>
        <section className="evidence-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Score detail</p>
              <h2>Evidence contribution</h2>
            </div>
            <button className="filter">
              All dimensions <ChevronDown size={14} />
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Skill</th>
                  <th>Market demand</th>
                  <th>Evidence state</th>
                  <th>Score</th>
                  <th>Strongest source</th>
                </tr>
              </thead>
              <tbody>
                {evidenceRows.map((row) => (
                  <tr key={row.skill}>
                    <td>
                      <strong>{row.skill}</strong>
                    </td>
                    <td>{row.demand}</td>
                    <td>
                      <span className={`pill ${row.level.toLowerCase()}`}>
                        {row.level}
                      </span>
                    </td>
                    <td>
                      <div className="score-bar">
                        <span style={{ width: `${row.score}%` }} />
                        <b>{row.score}</b>
                      </div>
                    </td>
                    <td>{row.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="method-note">
            Scores measure documented evidence against the selected role market.
            They do not claim to measure absolute ability.
          </p>
        </section>
      </main>
    </div>
  );
}
