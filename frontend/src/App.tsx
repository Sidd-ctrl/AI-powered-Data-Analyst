import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Database,
  FileSpreadsheet,
  LayoutDashboard,
  LoaderCircle,
  MessageSquare,
  Plus,
  Send,
  Settings,
  ShieldAlert,
  Sparkles,
  Terminal,
  Upload,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

type Row = Record<string, unknown>;

type Dataset = {
  id: string;
  name: string;
  rows: number;
  columns: number;
  size: number;
  schema: Record<string, string>;
};

type Analysis = {
  id: string;
  dataset_id: string;
  question: string;
  answer: string;
  rows: Row[];
  sql: string;
  pandas: string;
  chart: string;
  mode: string;
  warning?: string;
};

type Profile = {
  columns: Row[];
  missing: number;
  duplicates: number;
  warnings: string[];
};

type Health = {
  ai_configured: boolean;
  model: string;
  max_upload_mb: number;
};

type Insight = {
  facts: string[];
  recommendations: string[];
};

type Anomaly = {
  analyzed: number;
  count: number;
  percentage: number;
  rows: Row[];
  notice: string;
  truncated: boolean;
};

const pages = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "AI Analyst", icon: MessageSquare },
  { name: "Data Sources", icon: Database },
  { name: "Dashboards", icon: BarChart3 },
  { name: "Insights", icon: Sparkles },
  { name: "Anomaly Detection", icon: ShieldAlert },
  { name: "SQL Playground", icon: Terminal },
  { name: "Settings", icon: Settings },
];

const questions = [
  "Compare revenue by region",
  "Show monthly sales trends",
  "Who are the top five customers?",
  "What is the average revenue?",
];

async function request<T>(
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined
        ? undefined
        : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      typeof error?.detail === "string"
        ? error.detail
        : error?.detail
          ? JSON.stringify(error.detail)
          : `Request failed: HTTP ${response.status}`,
    );
  }

  return response.json();
}

function Table({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState("");

  if (!rows.length) {
    return <p className="muted">No records to display.</p>;
  }

  const columns = Object.keys(rows[0]);
  const filtered = rows.filter((row) =>
    Object.values(row).some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(search.toLowerCase()),
    ),
  );

  return (
    <div>
      <div className="table-tools">
        <input
          aria-label="Filter returned records"
          placeholder="Filter returned records…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <small>{filtered.length} returned records</small>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>
                  {column.replaceAll("_", " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column}>
                    {row[column] == null
                      ? "null"
                      : typeof row[column] === "number"
                        ? row[column].toLocaleString(undefined, {
                            maximumFractionDigits: 3,
                          })
                        : String(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length > 100 && (
        <small>Showing the first 100 matching returned records.</small>
      )}
    </div>
  );
}

function Results({
  rows,
  chart = "bar",
}: {
  rows: Row[];
  chart?: string;
}) {
  const [view, setView] = useState(
    chart === "line" ? "line" : "bar",
  );

  const chartable = rows.some(
    (row) => typeof row.value === "number",
  );

  const data = rows.map((row) => ({
    label: String(row.label ?? "Result"),
    value: typeof row.value === "number" ? row.value : null,
  }));

  const axes = (
    <>
      <CartesianGrid
        stroke="#323039"
        vertical={false}
        strokeDasharray="3 5"
      />
      <XAxis
        dataKey="label"
        tick={{ fill: "#a89fb5", fontSize: 11 }}
        axisLine={false}
        tickLine={false}
        tickFormatter={(value) => String(value).slice(0, 14)}
      />
      <YAxis
        tick={{ fill: "#a89fb5", fontSize: 11 }}
        axisLine={false}
        tickLine={false}
        tickFormatter={(value: number) =>
          Math.abs(value) >= 1000
            ? `${(value / 1000).toFixed(0)}k`
            : String(value)
        }
      />
      <Tooltip
        contentStyle={{
          background: "#25212d",
          border: "1px solid #51405f",
          borderRadius: 9,
          color: "#ffffff",
        }}
      />
    </>
  );

  return (
    <div>
      {chartable && (
        <div className="result-tools">
          <span className="muted">Computed results</span>
          <select
            aria-label="Result view"
            value={view}
            onChange={(event) => setView(event.target.value)}
          >
            <option value="bar">Bar chart</option>
            <option value="line">Line chart</option>
            <option value="table">Table</option>
          </select>
        </div>
      )}

      {!chartable || view === "table" ? (
        <Table rows={rows} />
      ) : (
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            {view === "line" ? (
              <LineChart data={data}>
                {axes}
                <Line
                  dataKey="value"
                  stroke="#b391fa"
                  strokeWidth={3}
                  dot={false}
                  type="monotone"
                />
              </LineChart>
            ) : (
              <BarChart data={data}>
                {axes}
                <Bar
                  dataKey="value"
                  fill="#ab87f5"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("Overview");
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selected, setSelected] = useState("");
  const [health, setHealth] = useState<Health | null>(null);
  const [history, setHistory] = useState<Analysis[]>([]);
  const [saved, setSaved] = useState<Analysis[]>([]);
  const [preview, setPreview] = useState<Row[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [question, setQuestion] = useState("");
  const [insight, setInsight] = useState<Insight | null>(null);
  const [anomaly, setAnomaly] = useState<Anomaly | null>(null);
  const [method, setMethod] = useState("iqr");
  const [numericSelection, setNumericSelection] = useState<string[]>([]);
  const [sql, setSql] = useState("SELECT * FROM data LIMIT 20;");
  const [sqlRows, setSqlRows] = useState<Row[] | null>(null);
  const [rightId, setRightId] = useState("");
  const [leftKey, setLeftKey] = useState("");
  const [rightKey, setRightKey] = useState("");
  const [joinType, setJoinType] = useState("inner");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const locked = useRef(false);

  const active = datasets.find((item) => item.id === selected);
  const right = datasets.find((item) => item.id === rightId);
  const activeHistory = history.filter(
    (item) => item.dataset_id === selected,
  );
  const numericColumns = Object.entries(active?.schema ?? {})
    .filter(([, dtype]) => /int|float/i.test(dtype))
    .map(([name]) => name);

  async function run(
    label: string,
    operation: () => Promise<void>,
  ) {
    if (locked.current) return;
    locked.current = true;
    setBusy(label);
    setError("");
    setMessage("");

    try {
      await operation();
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "The operation failed.",
      );
    } finally {
      locked.current = false;
      setBusy("");
    }
  }

  async function refresh(preferred?: string) {
    const [items, analyses, dashboards] = await Promise.all([
      request<Dataset[]>("/datasets"),
      request<Analysis[]>("/sessions/current/history"),
      request<Analysis[]>("/dashboards"),
    ]);

    setDatasets(items);
    setHistory(analyses);
    setSaved(dashboards);
    setSelected((current) => {
      const id = preferred ?? current;
      return items.some((item) => item.id === id)
        ? id
        : (items[0]?.id ?? "");
    });
  }

  useEffect(() => {
    void run("Connecting to backend", async () => {
      setHealth(await request<Health>("/health"));
      // Establish a session before parallel requests.
      await request<Dataset[]>("/datasets");
      await refresh();
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    setPreview([]);
    setProfile(null);
    setInsight(null);
    setAnomaly(null);
    setSqlRows(null);
    setNumericSelection([]);
    setRightId("");
    setLeftKey("");
    setRightKey("");

    if (selected) {
      Promise.all([
        request<Row[]>(`/datasets/${selected}/preview`),
        request<Profile>(`/datasets/${selected}/profile`),
      ])
        .then(([rows, details]) => {
          if (!cancelled) {
            setPreview(rows);
            setProfile(details);
          }
        })
        .catch((problem: Error) => {
          if (!cancelled) setError(problem.message);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [selected]);

  function upload(files: File[]) {
    if (!files.length) return;

    void run("Uploading CSV files", async () => {
      setProgress(0);

      const uploaded = await new Promise<Dataset[]>(
        (resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const form = new FormData();
          files.forEach((file) => form.append("files", file));

          xhr.open("POST", "/api/datasets/upload");
          xhr.timeout = 120000;

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              setProgress(
                Math.round((event.loaded / event.total) * 100),
              );
            }
          };

          xhr.onload = () => {
            try {
              const result = JSON.parse(xhr.responseText);
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve(result);
              } else {
                reject(new Error(result.detail || "Upload failed."));
              }
            } catch {
              reject(new Error("Invalid upload response."));
            }
          };

          xhr.onerror = () => reject(new Error("Upload failed."));
          xhr.ontimeout = () => reject(new Error("Upload timed out."));
          xhr.send(form);
        },
      );

      await refresh(uploaded[0]?.id);
      setPage("Data Sources");
      setMessage(`${uploaded.length} dataset(s) uploaded.`);
    });
  }

  function loadSample() {
    void run("Loading synthetic data", async () => {
      const items = await request<Dataset[]>("/datasets/sample", {});
      await refresh(items.find((item) => item.name.includes("sales"))?.id);
      setMessage("Synthetic sample data loaded.");
    });
  }

  function ask(text: string) {
    if (!selected || !text.trim()) return;
    setPage("AI Analyst");

    void run("Analyzing your dataset", async () => {
      const result = await request<Analysis>("/analysis/query", {
        dataset_id: selected,
        question: text.trim(),
      });
      setHistory((previous) => [...previous, result]);
      setQuestion("");
    });
  }

  function exportAnalysis(id: string, format: string) {
    void run("Exporting results", async () => {
      const response = await fetch("/api/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis_id: id, format }),
      });

      if (!response.ok) throw new Error("Export failed.");

      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `analysis.${
        format === "csv" ? "csv" : format === "markdown" ? "md" : "txt"
      }`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  function analysisCard(item: Analysis) {
    return (
      <section className="panel" key={item.id}>
        <div className="section-heading">
          <h3>{item.question}</h3>
          <span className="badge">{item.mode}</span>
        </div>
        <p className="answer">{item.answer}</p>
        {item.warning && <div className="notice">{item.warning}</div>}
        <Results rows={item.rows} chart={item.chart} />
        <details>
          <summary>View SQL and equivalent Pandas code</summary>
          <h4>SQL</h4>
          <pre>{item.sql}</pre>
          <h4>Pandas</h4>
          <pre>{item.pandas}</pre>
        </details>
        <div className="actions">
          <button
            disabled={Boolean(busy)}
            onClick={() =>
              void run("Saving analysis", async () => {
                setSaved(
                  await request<Analysis[]>(`/dashboards/${item.id}`, {}),
                );
                setMessage("Saved to Dashboards for this session.");
              })
            }
          >
            Save to dashboard
          </button>
          {["csv", "markdown", "sql", "pandas"].map((format) => (
            <button
              key={format}
              disabled={Boolean(busy)}
              onClick={() => exportAnalysis(item.id, format)}
            >
              Export {format === "markdown" ? "report" : format.toUpperCase()}
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="app-shell">
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        multiple
        hidden
        onChange={(event) => {
          upload(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />

      <aside className="sidebar">
        <button className="brand" onClick={() => setPage("Overview")}>
          <span className="logo"><Activity size={24} /></span>
          DataPilot <span className="ai-label">AI</span>
        </button>

        <div className="workspace-label">PERSONAL WORKSPACE</div>

        <nav aria-label="Main navigation">
          {pages.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-item ${page === name ? "selected" : ""}`}
              aria-current={page === name ? "page" : undefined}
              onClick={() => setPage(name)}
            >
              <Icon size={18} />
              {name}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="privacy">
            <strong>Your workspace, your data</strong>
            <p>Temporary session storage. Export results you want to keep.</p>
          </div>
          <button className="user" onClick={() => setPage("Settings")}>
            <span className="avatar">DP</span>
            <span>Local workspace<small>Personal account</small></span>
            <Settings size={16} />
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span><span>/</span><strong>{page}</strong>
          </div>
          <div className="connection">
            <span className={`dot ${health ? "" : "offline"}`} />
            {health
              ? health.ai_configured
                ? "AI key configured"
                : "Local analysis"
              : "Not connected"}
          </div>
        </header>

        <main className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">YOUR DATA. A CLEARER DIRECTION.</span>
              <h1>
                {page === "Overview"
                  ? "Your workspace, at a glance"
                  : page}
              </h1>
              <p>Turn raw data into answers you can inspect and verify.</p>
            </div>
            <button
              className="primary"
              disabled={Boolean(busy)}
              onClick={() => inputRef.current?.click()}
            >
              <Plus size={18} /> Upload dataset
            </button>
          </div>

          {error && (
            <div className="alert" role="alert">
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}

          {message && <div className="success" role="status">{message}</div>}

          {busy && (
            <div className="loading" role="status">
              <LoaderCircle className="spin" size={18} />
              {busy}{busy === "Uploading CSV files" ? ` · ${progress}%` : "…"}
            </div>
          )}

          {active && page !== "Settings" && (
            <div className="dataset-selector">
              <Database size={16} />
              <span>Active dataset</span>
              <select
                aria-label="Active dataset"
                disabled={Boolean(busy)}
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
              >
                {datasets.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              {active.name.startsWith("synthetic") && (
                <span className="badge">Synthetic sample</span>
              )}
            </div>
          )}

          {page === "Settings" ? (
            <section className="panel">
              <h3>Workspace configuration</h3>
              <p>API keys belong on the backend, never in frontend code.</p>
              <dl className="settings-list">
                <dt>Provider</dt><dd>OpenRouter</dd>
                <dt>Model</dt><dd>{health?.model ?? "Unavailable"}</dd>
                <dt>AI key</dt><dd>{health?.ai_configured ? "Configured" : "Not configured"}</dd>
                <dt>Upload limit</dt><dd>{health?.max_upload_mb ?? "—"} MB per CSV</dd>
                <dt>Storage</dt><dd>Temporary in-memory sessions</dd>
              </dl>
              <pre>{"OPENROUTER_API_KEY=your-key\nOPENROUTER_MODEL=openai/gpt-4o-mini\nOPENROUTER_BASE_URL=https://openrouter.ai/api/v1"}</pre>
              <div className="notice">
                Restart the backend after changing its environment.
                Session data and saved dashboards are lost when it restarts.
              </div>
              <button
                disabled={Boolean(busy)}
                onClick={() => void run("Reconnecting", async () => {
                  setHealth(await request<Health>("/health"));
                  await request<Dataset[]>("/datasets");
                  await refresh();
                })}
              >
                Refresh connection
              </button>
            </section>
          ) : !active ? (
            <section
              className="panel empty"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                upload(Array.from(event.dataTransfer.files));
              }}
            >
              <div className="empty-icon"><Database size={30} /></div>
              <h2>Your next insight starts here.</h2>
              <p>Drop CSV files here, upload a dataset, or explore synthetic sales data.</p>
              <div className="actions centered">
                <button className="primary" disabled={Boolean(busy)} onClick={() => inputRef.current?.click()}>
                  <Upload size={16} /> Upload CSV
                </button>
                <button disabled={Boolean(busy)} onClick={loadSample}>
                  Explore sample data <ArrowUpRight size={16} />
                </button>
              </div>
              <small>UTF-8 CSV · Up to {health?.max_upload_mb ?? 20} MB per file</small>
            </section>
          ) : (
            <>
              {page === "Overview" && (
                <>
                  <div className="stats">
                    {[
                      ["Total records", datasets.reduce((sum, item) => sum + item.rows, 0)],
                      ["Datasets loaded", datasets.length],
                      ["Columns loaded", datasets.reduce((sum, item) => sum + item.columns, 0)],
                      ["Saved analyses", saved.length],
                    ].map(([label, value]) => (
                      <section className="panel stat" key={String(label)}>
                        <span>{label}</span>
                        <strong>{Number(value).toLocaleString()}</strong>
                        <small>Current session</small>
                      </section>
                    ))}
                  </div>

                  <div className="overview-grid">
                    <section className="panel">
                      <h3>Recent datasets</h3>
                      {datasets.slice(-4).map((item) => (
                        <button
                          className="dataset-row"
                          disabled={Boolean(busy)}
                          key={item.id}
                          onClick={() => {
                            setSelected(item.id);
                            setPage("Data Sources");
                          }}
                        >
                          <FileSpreadsheet size={23} />
                          <span>
                            <strong>{item.name}</strong>
                            <small>{item.rows.toLocaleString()} rows · {item.columns} columns</small>
                          </span>
                          <ArrowUpRight size={16} />
                        </button>
                      ))}
                    </section>

                    <section className="panel quickstart">
                      <Sparkles size={24} />
                      <h3>A question is all it takes.</h3>
                      <p>Try these questions with the sample sales dataset.</p>
                      {questions.slice(0, 3).map((text) => (
                        <button disabled={Boolean(busy)} key={text} onClick={() => ask(text)}>
                          {text}<ArrowUpRight size={16} />
                        </button>
                      ))}
                    </section>
                  </div>

                  <section className="panel">
                    <h3>Recent analysis</h3>
                    {activeHistory.length ? (
                      <Results
                        key={activeHistory.at(-1)!.id}
                        rows={activeHistory.at(-1)!.rows}
                        chart={activeHistory.at(-1)!.chart}
                      />
                    ) : (
                      <div className="empty-small">
                        <BarChart3 size={30} />
                        <p>Your computed results will appear after your first analysis.</p>
                      </div>
                    )}
                  </section>
                </>
              )}

              {page === "AI Analyst" && (
                <>
                  {!activeHistory.length && (
                    <section className="panel empty">
                      <div className="empty-icon"><Sparkles size={28} /></div>
                      <h2>What would you like to know?</h2>
                      <p>Without OpenRouter, a limited local planner handles supported questions.</p>
                      <div className="starters">
                        {questions.map((text) => (
                          <button disabled={Boolean(busy)} key={text} onClick={() => ask(text)}>
                            {text}<ArrowUpRight size={16} />
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {activeHistory.map(analysisCard)}

                  <form className="chat" onSubmit={(event) => {
                    event.preventDefault();
                    ask(question);
                  }}>
                    <Sparkles size={20} />
                    <input
                      aria-label="Ask a question"
                      placeholder="Ask a question about your dataset…"
                      value={question}
                      maxLength={2000}
                      onChange={(event) => setQuestion(event.target.value)}
                    />
                    <button className="primary" disabled={Boolean(busy) || !question.trim()}>
                      <Send size={16} /> Ask
                    </button>
                  </form>
                </>
              )}

              {page === "Data Sources" && (
                <>
                  <div
                    className="drop-zone"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      upload(Array.from(event.dataTransfer.files));
                    }}
                  >
                    <Upload size={23} />
                    Drop CSV files here
                    <button disabled={Boolean(busy)} onClick={() => inputRef.current?.click()}>
                      Browse files
                    </button>
                  </div>

                  <section className="panel">
                    <div className="section-heading">
                      <h3>{active.name}</h3>
                      <span className="badge">
                        {active.rows.toLocaleString()} rows · {active.columns} columns · {(active.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <Table rows={preview} />
                  </section>

                  <section className="panel">
                    <h3>Schema & data quality</h3>
                    {profile ? (
                      <>
                        <p>{profile.missing} missing cells · {profile.duplicates} duplicate records</p>
                        {profile.warnings.map((warning, index) => (
                          <div className="notice" key={index}>{warning}</div>
                        ))}
                        <Table rows={profile.columns} />
                      </>
                    ) : <p>Loading profile…</p>}
                  </section>

                  <section className="panel">
                    <h3>Combine datasets</h3>
                    <p>Select compatible keys. Datasets are never joined automatically.</p>
                    <div className="form-grid">
                      <label>Left key
                        <select value={leftKey} onChange={(event) => setLeftKey(event.target.value)}>
                          <option value="">Select column</option>
                          {Object.keys(active.schema).map((key) => <option key={key}>{key}</option>)}
                        </select>
                      </label>
                      <label>Right dataset
                        <select value={rightId} onChange={(event) => {
                          setRightId(event.target.value);
                          setRightKey("");
                        }}>
                          <option value="">Select dataset</option>
                          {datasets.filter((item) => item.id !== selected).map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                      </label>
                      <label>Right key
                        <select value={rightKey} onChange={(event) => setRightKey(event.target.value)}>
                          <option value="">Select column</option>
                          {Object.keys(right?.schema ?? {}).map((key) => <option key={key}>{key}</option>)}
                        </select>
                      </label>
                      <label>Join type
                        <select value={joinType} onChange={(event) => setJoinType(event.target.value)}>
                          {["inner", "left", "right", "outer"].map((type) => <option key={type}>{type}</option>)}
                        </select>
                      </label>
                    </div>
                    {leftKey && rightKey && (
                      <p>Key types: {active.schema[leftKey]} ↔ {right?.schema[rightKey]}</p>
                    )}
                    <button
                      className="primary"
                      disabled={Boolean(busy) || !leftKey || !rightKey || !rightId}
                      onClick={() => void run("Joining datasets", async () => {
                        const result = await request<Dataset>("/datasets/merge", {
                          left: selected,
                          right: rightId,
                          left_key: leftKey,
                          right_key: rightKey,
                          how: joinType,
                        });
                        await refresh(result.id);
                      })}
                    >
                      Create joined dataset
                    </button>
                  </section>
                </>
              )}

              {page === "Dashboards" && (
                <>
                  <p>Saved analyses across your current session.</p>
                  {saved.length ? saved.map(analysisCard) : (
                    <section className="panel empty">
                      <BarChart3 size={32} />
                      <h2>Create your first dashboard</h2>
                      <p>Run an analysis and choose “Save to dashboard”.</p>
                      <button className="primary" onClick={() => setPage("AI Analyst")}>Open AI Analyst</button>
                    </section>
                  )}
                </>
              )}

              {page === "Insights" && (
                <section className="panel">
                  <div className="section-heading">
                    <h3>Dataset insights</h3>
                    <button
                      className="primary"
                      disabled={Boolean(busy)}
                      onClick={() => void run("Calculating insights", async () => {
                        setInsight(await request<Insight>("/analysis/insights", {
                          dataset_id: selected,
                        }));
                      })}
                    >
                      <Sparkles size={16} /> Generate insights
                    </button>
                  </div>
                  {insight ? (
                    <>
                      <h4>Measured facts</h4>
                      {insight.facts.map((fact, index) => <div className="fact" key={index}>{fact}</div>)}
                      <h4>General review recommendations</h4>
                      {insight.recommendations.map((text, index) => <div className="notice" key={index}>{text}</div>)}
                    </>
                  ) : <p>Generate a statistical summary of the active dataset.</p>}
                </section>
              )}

              {page === "Anomaly Detection" && (
                <>
                  <section className="panel">
                    <h3>Find unusual records</h3>
                    <p>Anomalies are statistical signals, not proof of fraud or errors.</p>
                    <div className="form-grid">
                      <label>Detection method
                        <select value={method} onChange={(event) => setMethod(event.target.value)}>
                          <option value="iqr">Interquartile range — 1.5 × IQR</option>
                          <option value="zscore">Z-score — 3 standard deviations</option>
                          <option value="isolation_forest">Isolation Forest</option>
                        </select>
                      </label>
                    </div>
                    <p>Leave all unchecked to analyze every numeric column.</p>
                    <div className="checkboxes">
                      {numericColumns.map((column) => (
                        <label key={column}>
                          <input
                            type="checkbox"
                            checked={numericSelection.includes(column)}
                            onChange={(event) => setNumericSelection((previous) =>
                              event.target.checked
                                ? [...previous, column]
                                : previous.filter((item) => item !== column),
                            )}
                          />
                          {column}
                        </label>
                      ))}
                    </div>
                    <button
                      className="primary"
                      disabled={Boolean(busy) || !numericColumns.length}
                      onClick={() => void run("Detecting anomalies", async () => {
                        setAnomaly(await request<Anomaly>("/analysis/anomalies", {
                          dataset_id: selected,
                          method,
                          columns: numericSelection.length ? numericSelection : null,
                        }));
                      })}
                    >
                      Run detection
                    </button>
                  </section>
                  {anomaly && (
                    <section className="panel">
                      <h3>{anomaly.count} flagged records · {anomaly.percentage}%</h3>
                      <p>{anomaly.analyzed} records analyzed. {anomaly.notice}</p>
                      <Table rows={anomaly.rows} />
                      {anomaly.truncated && <p>Only the first 500 flagged records were returned.</p>}
                    </section>
                  )}
                </>
              )}

              {page === "SQL Playground" && (
                <section className="panel">
                  <h3>Query your dataset</h3>
                  <p>Read-only SQLite. Your dataset is available as <code>data</code>. Results are capped at 500 rows.</p>
                  <details>
                    <summary>Available columns</summary>
                    <pre>{JSON.stringify(active.schema, null, 2)}</pre>
                  </details>
                  <textarea
                    className="sql-editor"
                    aria-label="SQL query"
                    value={sql}
                    maxLength={12000}
                    spellCheck={false}
                    onChange={(event) => setSql(event.target.value)}
                  />
                  <button
                    className="primary"
                    disabled={Boolean(busy) || !sql.trim()}
                    onClick={() => void run("Executing read-only SQL", async () => {
                      const result = await request<{ rows: Row[]; truncated: boolean }>("/analysis/sql", {
                        dataset_id: selected,
                        sql,
                      });
                      setSqlRows(result.rows);
                      if (result.truncated) setMessage("Only the first 500 result rows were returned.");
                    })}
                  >
                    <Terminal size={16} /> Run query
                  </button>
                  {sqlRows !== null && (
                    <div className="sql-results"><Table rows={sqlRows} /></div>
                  )}
                </section>
              )}
            </>
          )}

          <footer>DataPilot AI · Evidence first. Decisions second.</footer>
        </main>
      </div>
    </div>
  );
}