import { useState, useEffect, useMemo } from "react";
import Papa from "papaparse";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ComposedChart, ScatterChart, Scatter, ZAxis
} from "recharts";

// ── CONFIG ──────────────────────────────────────────────────────────────────
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRfKblo0PEPiyzfOniTQzk0HEf7fBeH1yC0SFBfKO0sMnGhPPEWI0T7fRtPA9rcXx8VPsptR3T835xa/pub?gid=0&single=true&output=csv";

// ── COLORS ──────────────────────────────────────────────────────────────────
const BLUE = {
  900: "#0c2340", 800: "#133366", 700: "#1a4480", 600: "#1e5199",
  500: "#2563b3", 400: "#4a82c7", 300: "#7aa5db", 200: "#a8c5e8",
  100: "#d4e2f4", 50: "#edf3fa"
};
const ORANGE = {
  900: "#7c2d00", 800: "#9a3800", 700: "#b84600", 600: "#d65a00",
  500: "#f07000", 400: "#f59333", 300: "#f9b366", 200: "#fcd299",
  100: "#fde8cc", 50: "#fef6eb"
};
const CHART_COLORS = [
  BLUE[600], ORANGE[500], BLUE[400], ORANGE[300], BLUE[300],
  ORANGE[600], BLUE[700], ORANGE[400], "#6366f1", "#10b981",
  "#f43f5e", "#8b5cf6", "#14b8a6", "#f59e0b", "#ef4444"
];
const GRAY = { 50: "#f8fafc", 100: "#f1f5f9", 200: "#e2e8f0", 300: "#cbd5e1", 400: "#94a3b8", 500: "#64748b", 600: "#475569", 700: "#334155", 800: "#1e293b", 900: "#0f172a" };
const RISK_COLORS = { high: "#ef4444", medium: "#f59e0b", low: "#10b981" };

// ── TABS ────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "resumen", label: "Resumen", icon: "📊" },
  { id: "clientes", label: "Clientes", icon: "🏢" },
  { id: "equipos", label: "Equipos", icon: "🚛" },
  { id: "rutas", label: "Rutas", icon: "🗺️" },
  { id: "operadores", label: "Operadores", icon: "👷" },
  { id: "tendencias", label: "Tendencias", icon: "📈" },
  { id: "cruces", label: "Cruces", icon: "🔀" },
  { id: "riesgo", label: "Riesgo", icon: "⚠️" },
  { id: "proyeccion", label: "Proyección", icon: "🔮" },
];

// ── HELPERS ──────────────────────────────────────────────────────────────────
const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function parseDate(str) {
  if (!str) return null;
  const parts = str.split("/");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month - 1, day);
    }
  }
  return null;
}

function getMonthKey(d) {
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(key) {
  if (!key) return "";
  const [y, m] = key.split("-");
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
}

function getWeekKey(d) {
  if (!d) return null;
  const start = new Date(d);
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  return `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,"0")}-${String(start.getDate()).padStart(2,"0")}`;
}

function countBy(arr, fn) {
  const map = {};
  arr.forEach(item => { const key = fn(item); if (key) map[key] = (map[key] || 0) + 1; });
  return map;
}

function topN(obj, n = 10) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
}

function pctChange(curr, prev) {
  if (!prev || prev === 0) return null;
  return ((curr - prev) / prev * 100);
}

function filterData(records, { year = null, month = null, client = "todos", equipo = "todos" } = {}) {
  return records.filter((r) => {
    if (year !== null && r._year !== year) return false;
    if (month !== null && r._month !== month) return false;
    if (client !== "todos" && r.cliente !== client) return false;
    if (equipo !== "todos" && r.tipoequipo !== equipo) return false;
    return true;
  });
}

function buildMonthlyTrend(records) {
  const months = {};
  records.forEach((r) => {
    const monthKey = r._monthKey;
    if (!monthKey) return;
    if (!months[monthKey]) {
      months[monthKey] = { month: monthKey, label: getMonthLabel(monthKey), viajes: 0, solicitudes: new Set() };
    }
    months[monthKey].viajes += 1;
    months[monthKey].solicitudes.add(r.solicitud);
  });

  return Object.values(months)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((month) => ({ ...month, solicitudes: month.solicitudes.size }));
}

function buildYoyData(records, years) {
  if (years.length < 2) return [];
  const byMonth = {};

  records.forEach((r) => {
    if (!r._year || !r._month) return;
    if (!byMonth[r._month]) byMonth[r._month] = { mes: MONTH_NAMES[r._month - 1] };
    byMonth[r._month][`y${r._year}`] = (byMonth[r._month][`y${r._year}`] || 0) + 1;
  });

  return Object.values(byMonth).sort((a, b) => MONTH_NAMES.indexOf(a.mes) - MONTH_NAMES.indexOf(b.mes));
}

// ── STYLES ──────────────────────────────────────────────────────────────────
const S = {
  app: { fontFamily: "'Outfit', 'Segoe UI', sans-serif", background: `linear-gradient(135deg, ${BLUE[50]} 0%, #ffffff 50%, ${ORANGE[50]} 100%)`, minHeight: "100vh", color: GRAY[800] },
  header: { background: `linear-gradient(135deg, ${BLUE[900]} 0%, ${BLUE[700]} 100%)`, padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" },
  headerLeft: { display: "flex", alignItems: "center", gap: "16px" },
  logo: { width: "42px", height: "42px", background: ORANGE[500], borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: "800", color: "white", boxShadow: `0 2px 8px ${ORANGE[500]}55` },
  headerTitle: { color: "white", fontSize: "22px", fontWeight: "700", letterSpacing: "-0.3px" },
  headerSub: { color: BLUE[200], fontSize: "13px", marginTop: "2px" },
  headerRight: { display: "flex", alignItems: "center", gap: "12px", color: BLUE[200], fontSize: "13px" },
  nav: { background: "white", borderBottom: `1px solid ${GRAY[200]}`, padding: "0 32px", display: "flex", gap: "4px", overflowX: "auto", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
  tab: (a) => ({ padding: "14px 20px", cursor: "pointer", fontSize: "14px", fontWeight: a ? "600" : "400", color: a ? BLUE[700] : GRAY[500], borderBottom: a ? `3px solid ${ORANGE[500]}` : "3px solid transparent", transition: "all 0.2s", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }),
  main: { padding: "24px 32px", maxWidth: "1400px", margin: "0 auto" },
  filters: { display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap", alignItems: "center" },
  sel: { padding: "8px 12px", borderRadius: "8px", border: `1px solid ${GRAY[300]}`, fontSize: "13px", color: GRAY[700], background: "white", cursor: "pointer", outline: "none" },
  fLabel: { fontSize: "12px", fontWeight: "600", color: GRAY[500], textTransform: "uppercase", letterSpacing: "0.5px" },
  kpiRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" },
  kpi: (accent = BLUE[600]) => ({ background: "white", borderRadius: "12px", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid ${accent}` }),
  kpiVal: { fontSize: "28px", fontWeight: "700", color: GRAY[900], lineHeight: "1.1" },
  kpiLbl: { fontSize: "12px", fontWeight: "600", color: GRAY[500], textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" },
  kpiChg: (p) => ({ fontSize: "12px", fontWeight: "600", color: p ? "#10b981" : "#ef4444", marginTop: "4px" }),
  card: { background: "white", borderRadius: "12px", padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: "20px" },
  cardTitle: { fontSize: "16px", fontWeight: "600", color: GRAY[800], marginBottom: "16px" },
  cardSub: { fontSize: "12px", color: GRAY[500], marginBottom: "12px", marginTop: "-10px" },
  g2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "20px", marginBottom: "20px" },
  tbl: { width: "100%", borderCollapse: "separate", borderSpacing: "0", fontSize: "13px" },
  th: { textAlign: "left", padding: "10px 12px", fontWeight: "600", color: GRAY[600], borderBottom: `2px solid ${GRAY[200]}`, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", position: "sticky", top: 0, background: "white" },
  td: { padding: "10px 12px", borderBottom: `1px solid ${GRAY[100]}`, color: GRAY[700] },
  badge: (c = BLUE[600]) => ({ display: "inline-block", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "600", background: `${c}15`, color: c }),
  loading: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "16px" },
  spinner: { width: "48px", height: "48px", border: `4px solid ${GRAY[200]}`, borderTop: `4px solid ${ORANGE[500]}`, borderRadius: "50%", animation: "spin 1s linear infinite" },
  cmpBtn: (a) => ({ padding: "6px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer", border: "none", background: a ? ORANGE[500] : GRAY[100], color: a ? "white" : GRAY[600], transition: "all 0.2s" }),
  alert: (l) => ({ background: "white", borderRadius: "12px", padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid ${RISK_COLORS[l] || GRAY[400]}`, marginBottom: "12px" }),
  heat: (intensity) => ({ width: "100%", height: "32px", borderRadius: "4px", background: intensity === 0 ? GRAY[100] : `rgba(30, 81, 153, ${Math.min(0.15 + intensity * 0.85, 1)})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: intensity > 0.5 ? "600" : "400", color: intensity > 0.5 ? "white" : GRAY[700] }),
};

// ── SHARED UI ───────────────────────────────────────────────────────────────
function KpiCard({ label, value, change, accent, subtitle }) {
  return (
    <div style={S.kpi(accent)}>
      <div style={S.kpiLbl}>{label}</div>
      <div style={S.kpiVal}>{value}</div>
      {change !== null && change !== undefined && <div style={S.kpiChg(change >= 0)}>{change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}% vs periodo anterior</div>}
      {subtitle && <div style={{ fontSize: "11px", color: GRAY[400], marginTop: "4px" }}>{subtitle}</div>}
    </div>
  );
}
function CC({ title, subtitle, children, style = {} }) {
  return (<div style={{ ...S.card, ...style }}><div style={S.cardTitle}>{title}</div>{subtitle && <div style={S.cardSub}>{subtitle}</div>}{children}</div>);
}
function DT({ columns, data, maxRows = 15 }) {
  return (
    <div style={{ overflowX: "auto", maxHeight: "400px", overflowY: "auto" }}>
      <table style={S.tbl}><thead><tr>{columns.map((c, i) => <th key={i} style={{ ...S.th, textAlign: c.align || "left" }}>{c.label}</th>)}</tr></thead>
        <tbody>{data.slice(0, maxRows).map((row, i) => <tr key={i} style={{ background: i % 2 === 0 ? "white" : GRAY[50] }}>{columns.map((c, j) => <td key={j} style={{ ...S.td, textAlign: c.align || "left" }}>{c.render ? c.render(row[c.key], row, i) : row[c.key]}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
function RB({ value, max, color = BLUE[500] }) {
  const p = max > 0 ? (value / max) * 100 : 0;
  return (<div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "120px" }}><div style={{ flex: 1, height: "8px", borderRadius: "4px", background: GRAY[100] }}><div style={{ width: `${p}%`, height: "100%", borderRadius: "4px", background: color, transition: "width 0.5s" }} /></div><span style={{ fontSize: "13px", fontWeight: "600", color: GRAY[700], minWidth: "40px", textAlign: "right" }}>{typeof value === "number" ? value.toLocaleString("es-CL") : value}</span></div>);
}
function CT({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (<div style={{ background: "white", border: `1px solid ${GRAY[200]}`, borderRadius: "8px", padding: "10px 14px", fontSize: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}><div style={{ fontWeight: "600", marginBottom: "4px", color: GRAY[800] }}>{label}</div>{payload.map((p, i) => <div key={i} style={{ color: p.color, display: "flex", justifyContent: "space-between", gap: "16px" }}><span>{p.name}:</span><span style={{ fontWeight: "600" }}>{typeof p.value === "number" ? p.value.toLocaleString("es-CL") : p.value}</span></div>)}</div>);
}
function Sem({ level }) {
  return <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "50%", background: RISK_COLORS[level] || GRAY[400], marginRight: "6px", verticalAlign: "middle" }} />;
}

// ── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("resumen");
  const [selectedYear, setSelectedYear] = useState("todos");
  const [selectedMonth, setSelectedMonth] = useState("todos");
  const [selectedClient, setSelectedClient] = useState("todos");
  const [selectedEquipo, setSelectedEquipo] = useState("todos");
  const [compareMode, setCompareMode] = useState(false);
  const selectedYearNumber = selectedYear === "todos" ? null : parseInt(selectedYear, 10);
  const selectedMonthNumber = selectedMonth === "todos" ? null : parseInt(selectedMonth, 10);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    const st = document.createElement("style");
    st.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(st);
    let isMounted = true;

    Papa.parse(CSV_URL, {
      download: true, header: true, skipEmptyLines: true,
      complete: (results) => {
        const cleaned = results.data.filter(r => r.solicitud && r.fechainicio).map(r => {
          const d = parseDate(r.fechainicio);
          return { ...r, _date: d, _year: d ? d.getFullYear() : null, _month: d ? d.getMonth() + 1 : null, _monthKey: getMonthKey(d), _weekKey: getWeekKey(d), _dayOfWeek: d ? d.getDay() : null, cliente: (r.Cliente || r.cliente || "").trim().toUpperCase(), tipoequipo: (r.tipoequipo || "").trim().toUpperCase(), tipocarga: (r.tipocarga || "").trim().toUpperCase(), tipoviaje: (r.tipoviaje || "").trim().toUpperCase(), origen: (r.origen || "").trim().toUpperCase(), destino: (r.destino || "").trim().toUpperCase(), creadopor: (r.creadopor || "").trim() };
        }).filter(r => r._date);
        if (!isMounted) return;
        setRawData(cleaned);
        setLoading(false);
      },
      error: (err) => {
        if (!isMounted) return;
        setError(err.message);
        setLoading(false);
      },
    });

    return () => {
      isMounted = false;
      if (document.head.contains(link)) document.head.removeChild(link);
      if (document.head.contains(st)) document.head.removeChild(st);
    };
  }, []);

  useEffect(() => {
    if (selectedYearNumber === null && compareMode) setCompareMode(false);
  }, [selectedYearNumber, compareMode]);

  const years = useMemo(() => [...new Set(rawData.map(r => r._year).filter(Boolean))].sort(), [rawData]);
  const clients = useMemo(() => [...new Set(rawData.map(r => r.cliente).filter(Boolean))].sort(), [rawData]);
  const equipos = useMemo(() => [...new Set(rawData.map(r => r.tipoequipo).filter(Boolean))].sort(), [rawData]);
  const historicalData = useMemo(() => filterData(rawData, {
    client: selectedClient,
    equipo: selectedEquipo,
  }), [rawData, selectedClient, selectedEquipo]);
  const filteredData = useMemo(() => filterData(historicalData, {
    year: selectedYearNumber,
    month: selectedMonthNumber,
    client: "todos",
    equipo: "todos",
  }), [historicalData, selectedYearNumber, selectedMonthNumber]);
  const prevPeriodData = useMemo(() => {
    if (!compareMode || selectedYearNumber === null) return [];
    return filterData(historicalData, {
      year: selectedYearNumber - 1,
      month: selectedMonthNumber,
      client: "todos",
      equipo: "todos",
    });
  }, [compareMode, historicalData, selectedYearNumber, selectedMonthNumber]);

  const metrics = useMemo(() => {
    const total = filteredData.length;
    const solicitudes = new Set(filteredData.map(r => r.solicitud)).size;
    const clientCount = new Set(filteredData.map(r => r.cliente)).size;
    const byMonth = countBy(filteredData, r => r._monthKey);
    const monthKeys = Object.keys(byMonth).sort();
    const avgPerMonth = monthKeys.length > 0 ? Math.round(total / monthKeys.length) : 0;
    const prevTotal = prevPeriodData.length;
    const prevSolicitudes = new Set(prevPeriodData.map(r => r.solicitud)).size;
    const prevClients = new Set(prevPeriodData.map(r => r.cliente)).size;
    const byTipoViaje = countBy(filteredData, r => r.tipoviaje);
    return { total, solicitudes, clientCount, avgPerMonth, byMonth, monthKeys, prevTotal, prevSolicitudes, prevClients, byTipoViaje };
  }, [filteredData, prevPeriodData]);

  const historicalYears = useMemo(() => [...new Set(historicalData.map(r => r._year).filter(Boolean))].sort(), [historicalData]);
  const monthlyTrend = useMemo(() => buildMonthlyTrend(historicalData), [historicalData]);
  const yoyData = useMemo(() => buildYoyData(historicalData, historicalYears), [historicalData, historicalYears]);

  if (loading) return <div style={S.loading}><div style={S.spinner} /><div style={{ fontSize: "16px", fontWeight: "500", color: GRAY[500] }}>Cargando datos de viajes...</div></div>;
  if (error) return <div style={S.loading}><div style={{ fontSize: "48px" }}>⚠️</div><div style={{ fontSize: "16px", color: "#ef4444" }}>Error: {error}</div></div>;

  const lastDate = rawData.length > 0 ? rawData.reduce((max, r) => r._date > max ? r._date : max, rawData[0]._date) : null;

  return (
    <div style={S.app}>
      <header style={S.header}>
        <div style={S.headerLeft}><div style={S.logo}>TB</div><div><div style={S.headerTitle}>Dashboard de Viajes</div><div style={S.headerSub}>Transportes Bello e Hijos Ltda.</div></div></div>
        <div style={S.headerRight}><span>{rawData.length.toLocaleString("es-CL")} viajes</span><span style={{ color: GRAY[600] }}>|</span><span>Últ. act: {lastDate ? lastDate.toLocaleDateString("es-CL") : "—"}</span></div>
      </header>
      <nav style={S.nav}>{TABS.map(t => <div key={t.id} style={S.tab(activeTab === t.id)} onClick={() => setActiveTab(t.id)}><span>{t.icon}</span> {t.label}</div>)}</nav>
      <div style={S.main}>
        <div style={S.filters}>
          <div><div style={S.fLabel}>Año</div><select style={S.sel} value={selectedYear} onChange={e => setSelectedYear(e.target.value)}><option value="todos">Todos</option>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
          <div><div style={S.fLabel}>Mes</div><select style={S.sel} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}><option value="todos">Todos</option>{MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
          <div><div style={S.fLabel}>Cliente</div><select style={S.sel} value={selectedClient} onChange={e => setSelectedClient(e.target.value)}><option value="todos">Todos ({clients.length})</option>{clients.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><div style={S.fLabel}>Tipo Equipo</div><select style={S.sel} value={selectedEquipo} onChange={e => setSelectedEquipo(e.target.value)}><option value="todos">Todos ({equipos.length})</option>{equipos.map(e => <option key={e} value={e}>{e}</option>)}</select></div>
          <div style={{ marginLeft: "auto" }}><div style={S.fLabel}>Comparar</div><button style={{ ...S.cmpBtn(compareMode), opacity: selectedYearNumber === null ? 0.55 : 1, cursor: selectedYearNumber === null ? "not-allowed" : "pointer" }} onClick={() => selectedYearNumber !== null && setCompareMode(!compareMode)} disabled={selectedYearNumber === null}>{compareMode ? "✓ Comparando" : "vs Año anterior"}</button></div>
        </div>
        {activeTab === "resumen" && <TabResumen data={filteredData} metrics={metrics} monthlyTrend={monthlyTrend} yoyData={yoyData} years={historicalYears} compareMode={compareMode} />}
        {activeTab === "clientes" && <TabClientes data={filteredData} metrics={metrics} compareMode={compareMode} prevData={prevPeriodData} />}
        {activeTab === "equipos" && <TabEquipos data={filteredData} />}
        {activeTab === "rutas" && <TabRutas data={filteredData} />}
        {activeTab === "operadores" && <TabOperadores data={filteredData} />}
        {activeTab === "tendencias" && <TabTendencias data={historicalData} rawData={historicalData} monthlyTrend={monthlyTrend} yoyData={yoyData} years={historicalYears} />}
        {activeTab === "cruces" && <TabCruces data={filteredData} />}
        {activeTab === "riesgo" && <TabRiesgo data={filteredData} rawData={historicalData} />}
        {activeTab === "proyeccion" && <TabProyeccion rawData={historicalData} monthlyTrend={monthlyTrend} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB RESUMEN
// ═══════════════════════════════════════════════════════════════════════════
function TabResumen({ data, metrics, monthlyTrend, yoyData, years, compareMode }) {
  const { total, solicitudes, clientCount, avgPerMonth, prevTotal, prevSolicitudes, prevClients, byTipoViaje } = metrics;
  const cc = countBy(data, r => r.cliente);
  const t5 = topN(cc, 5);
  const tm = t5.length > 0 ? t5[0][1] : 1;
  const pie = Object.entries(byTipoViaje).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const dr = data.length > 0 ? Math.max(1, Math.ceil((Math.max(...data.map(r => r._date).filter(Boolean)) - Math.min(...data.map(r => r._date).filter(Boolean))) / 86400000)) : 1;
  return (
    <>
      <div style={S.kpiRow}>
        <KpiCard label="Total Viajes" value={total.toLocaleString("es-CL")} accent={BLUE[600]} change={compareMode ? pctChange(total, prevTotal) : null} />
        <KpiCard label="Solicitudes Únicas" value={solicitudes.toLocaleString("es-CL")} accent={ORANGE[500]} change={compareMode ? pctChange(solicitudes, prevSolicitudes) : null} />
        <KpiCard label="Clientes Activos" value={clientCount} accent={BLUE[400]} change={compareMode ? pctChange(clientCount, prevClients) : null} />
        <KpiCard label="Promedio Mensual" value={avgPerMonth.toLocaleString("es-CL")} accent={ORANGE[400]} subtitle={`${(total / dr).toFixed(1)} viajes/día`} />
      </div>
      <div style={S.g2}>
        <CC title="Viajes por Mes"><ResponsiveContainer width="100%" height={280}><ComposedChart data={monthlyTrend}><CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} /><XAxis dataKey="label" fontSize={11} tick={{ fill: GRAY[500] }} angle={-30} textAnchor="end" height={50} /><YAxis fontSize={11} tick={{ fill: GRAY[500] }} /><Tooltip content={<CT />} /><Bar dataKey="viajes" fill={BLUE[500]} radius={[4, 4, 0, 0]} name="Viajes" /><Line dataKey="solicitudes" stroke={ORANGE[500]} strokeWidth={2} dot={{ r: 3 }} name="Solicitudes" /></ComposedChart></ResponsiveContainer></CC>
        <CC title="Distribución por Tipo de Viaje"><ResponsiveContainer width="100%" height={280}><PieChart><Pie data={pie} cx="50%" cy="50%" outerRadius={100} innerRadius={50} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={10}>{pie.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></CC>
      </div>
      <div style={S.g2}>
        <CC title="Top 5 Clientes">{t5.map(([n, c], i) => <div key={n} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 0", borderBottom: i < t5.length - 1 ? `1px solid ${GRAY[100]}` : "none" }}><span style={{ ...S.badge(CHART_COLORS[i]), minWidth: "24px", textAlign: "center" }}>{i + 1}</span><span style={{ flex: 1, fontSize: "13px", fontWeight: "500" }}>{n}</span><RB value={c} max={tm} color={CHART_COLORS[i]} /></div>)}</CC>
        {years.length >= 2 && <CC title="Comparación Interanual"><ResponsiveContainer width="100%" height={280}><BarChart data={yoyData}><CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} /><XAxis dataKey="mes" fontSize={11} tick={{ fill: GRAY[500] }} /><YAxis fontSize={11} tick={{ fill: GRAY[500] }} /><Tooltip content={<CT />} /><Legend />{years.map((y, i) => <Bar key={y} dataKey={`y${y}`} name={String(y)} fill={CHART_COLORS[i]} radius={[3, 3, 0, 0]} />)}</BarChart></ResponsiveContainer></CC>}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB CLIENTES
// ═══════════════════════════════════════════════════════════════════════════
function TabClientes({ data, compareMode, prevData }) {
  const cc = countBy(data, r => r.cliente);
  const pc = compareMode ? countBy(prevData, r => r.cliente) : {};
  const sorted = Object.entries(cc).sort((a, b) => b[1] - a[1]);
  const total = data.length;
  const t5v = sorted.slice(0, 5).reduce((s, [, c]) => s + c, 0);
  const t10v = sorted.slice(0, 10).reduce((s, [, c]) => s + c, 0);
  const topC = sorted.slice(0, 10).map(([n]) => n);
  const cm = useMemo(() => { const r = {}; data.forEach(d => { if (!topC.includes(d.cliente)) return; const mk = d._monthKey; if (!mk) return; if (!r[mk]) r[mk] = { month: mk, label: getMonthLabel(mk) }; r[mk][d.cliente] = (r[mk][d.cliente] || 0) + 1; }); return Object.values(r).sort((a, b) => a.month.localeCompare(b.month)); }, [data, topC]);
  return (
    <>
      <div style={S.kpiRow}>
        <KpiCard label="Clientes Activos" value={sorted.length} accent={BLUE[600]} />
        <KpiCard label="Top 5 Concentración" value={`${total > 0 ? (t5v / total * 100).toFixed(1) : 0}%`} accent={ORANGE[500]} subtitle={`${t5v.toLocaleString("es-CL")} viajes`} />
        <KpiCard label="Top 10 Concentración" value={`${total > 0 ? (t10v / total * 100).toFixed(1) : 0}%`} accent={BLUE[400]} />
        <KpiCard label="Prom. Viajes/Cliente" value={sorted.length > 0 ? (total / sorted.length).toFixed(1) : "0"} accent={ORANGE[400]} />
      </div>
      <div style={S.g2}>
        <CC title="Ranking de Clientes"><DT columns={[{ key: "rank", label: "#", render: v => <span style={S.badge(BLUE[600])}>{v}</span> }, { key: "name", label: "Cliente" }, { key: "count", label: "Viajes", align: "right", render: v => v.toLocaleString("es-CL") }, { key: "pct", label: "%", align: "right", render: v => `${v}%` }, ...(compareMode ? [{ key: "change", label: "vs Ant.", align: "right", render: (v) => v !== null ? <span style={{ color: v >= 0 ? "#10b981" : "#ef4444", fontWeight: 600 }}>{v >= 0 ? "+" : ""}{v.toFixed(1)}%</span> : "—" }] : [])]} data={sorted.map(([n, c], i) => ({ rank: i + 1, name: n, count: c, pct: total > 0 ? (c / total * 100).toFixed(1) : "0", change: compareMode && pc[n] ? pctChange(c, pc[n]) : null }))} maxRows={20} /></CC>
        <CC title="Evolución Top Clientes"><ResponsiveContainer width="100%" height={350}><AreaChart data={cm}><CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} /><XAxis dataKey="label" fontSize={10} tick={{ fill: GRAY[500] }} angle={-30} textAnchor="end" height={50} /><YAxis fontSize={11} tick={{ fill: GRAY[500] }} /><Tooltip content={<CT />} /><Legend fontSize={10} />{topC.slice(0, 6).map((c, i) => <Area key={c} type="monotone" dataKey={c} stackId="1" fill={CHART_COLORS[i]} stroke={CHART_COLORS[i]} fillOpacity={0.6} name={c} />)}</AreaChart></ResponsiveContainer></CC>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB EQUIPOS
// ═══════════════════════════════════════════════════════════════════════════
function TabEquipos({ data }) {
  const ec = countBy(data, r => r.tipoequipo); const sorted = Object.entries(ec).sort((a, b) => b[1] - a[1]); const total = data.length;
  const topE = sorted.slice(0, 6).map(([n]) => n);
  const em = useMemo(() => { const r = {}; data.forEach(d => { const mk = d._monthKey; if (!mk) return; if (!r[mk]) r[mk] = { month: mk, label: getMonthLabel(mk) }; r[mk][d.tipoequipo] = (r[mk][d.tipoequipo] || 0) + 1; }); return Object.values(r).sort((a, b) => a.month.localeCompare(b.month)); }, [data]);
  const combos = useMemo(() => { const c = {}; data.forEach(r => { const k = `${r.tipoequipo} → ${r.tipocarga}`; c[k] = (c[k] || 0) + 1; }); return topN(c, 15); }, [data]);
  const pie = sorted.map(([n, v]) => ({ name: n, value: v }));
  return (
    <>
      <div style={S.kpiRow}>
        <KpiCard label="Tipos de Equipo" value={sorted.length} accent={BLUE[600]} />
        <KpiCard label="Equipo Principal" value={sorted[0]?.[0] || "—"} accent={ORANGE[500]} subtitle={`${sorted[0]?.[1]?.toLocaleString("es-CL") || 0} viajes`} />
        <KpiCard label="Total Viajes" value={total.toLocaleString("es-CL")} accent={BLUE[400]} />
      </div>
      <div style={S.g2}>
        <CC title="Distribución de Equipos"><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={pie} cx="50%" cy="50%" outerRadius={110} innerRadius={45} dataKey="value" nameKey="name" label={({ name, percent }) => percent > 0.03 ? `${name.substring(0, 15)} ${(percent * 100).toFixed(0)}%` : ""} fontSize={9}>{pie.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></CC>
        <CC title="Top Combinaciones Equipo → Carga"><DT columns={[{ key: "rank", label: "#", render: v => <span style={S.badge(ORANGE[500])}>{v}</span> }, { key: "combo", label: "Equipo → Carga" }, { key: "count", label: "Viajes", align: "right", render: v => v.toLocaleString("es-CL") }, { key: "pct", label: "%", align: "right", render: v => `${v}%` }]} data={combos.map(([c, n], i) => ({ rank: i + 1, combo: c, count: n, pct: total > 0 ? (n / total * 100).toFixed(1) : "0" }))} /></CC>
      </div>
      <CC title="Evolución de Equipos por Mes"><ResponsiveContainer width="100%" height={320}><BarChart data={em}><CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} /><XAxis dataKey="label" fontSize={10} tick={{ fill: GRAY[500] }} angle={-30} textAnchor="end" height={50} /><YAxis fontSize={11} tick={{ fill: GRAY[500] }} /><Tooltip content={<CT />} /><Legend fontSize={10} />{topE.map((eq, i) => <Bar key={eq} dataKey={eq} stackId="1" fill={CHART_COLORS[i]} name={eq} />)}</BarChart></ResponsiveContainer></CC>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB RUTAS
// ═══════════════════════════════════════════════════════════════════════════
function TabRutas({ data }) {
  const rc = useMemo(() => { const m = {}; data.forEach(r => { if (!r.origen || !r.destino) return; const k = `${r.origen} → ${r.destino}`; m[k] = (m[k] || 0) + 1; }); return topN(m, 20); }, [data]);
  const oc = countBy(data, r => r.origen); const dc = countBy(data, r => r.destino);
  const to = topN(oc, 10).map(([n, v]) => ({ name: n, value: v }));
  const td = topN(dc, 10).map(([n, v]) => ({ name: n, value: v }));
  const total = data.length;
  return (
    <>
      <div style={S.kpiRow}>
        <KpiCard label="Rutas Únicas" value={new Set(data.map(r => `${r.origen}-${r.destino}`)).size} accent={BLUE[600]} />
        <KpiCard label="Orígenes" value={Object.keys(oc).length} accent={ORANGE[500]} />
        <KpiCard label="Destinos" value={Object.keys(dc).length} accent={BLUE[400]} />
        <KpiCard label="Ruta Principal" value={rc[0]?.[0]?.substring(0, 25) || "—"} accent={ORANGE[400]} subtitle={`${rc[0]?.[1]?.toLocaleString("es-CL") || 0} viajes`} />
      </div>
      <CC title="Top 20 Rutas"><DT columns={[{ key: "rank", label: "#", render: v => <span style={S.badge(BLUE[600])}>{v}</span> }, { key: "ruta", label: "Ruta" }, { key: "count", label: "Viajes", align: "right", render: v => v.toLocaleString("es-CL") }, { key: "pct", label: "%", align: "right", render: v => `${v}%` }, { key: "bar", label: "", render: (_, row) => <RB value={row.count} max={rc[0]?.[1] || 1} color={ORANGE[500]} /> }]} data={rc.map(([r, c], i) => ({ rank: i + 1, ruta: r, count: c, pct: total > 0 ? (c / total * 100).toFixed(1) : "0" }))} maxRows={20} /></CC>
      <div style={S.g2}>
        <CC title="Top Orígenes"><ResponsiveContainer width="100%" height={300}><BarChart data={to} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} /><XAxis type="number" fontSize={11} tick={{ fill: GRAY[500] }} /><YAxis type="category" dataKey="name" fontSize={10} tick={{ fill: GRAY[600] }} width={120} /><Tooltip content={<CT />} /><Bar dataKey="value" fill={BLUE[500]} radius={[0, 4, 4, 0]} name="Viajes" /></BarChart></ResponsiveContainer></CC>
        <CC title="Top Destinos"><ResponsiveContainer width="100%" height={300}><BarChart data={td} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} /><XAxis type="number" fontSize={11} tick={{ fill: GRAY[500] }} /><YAxis type="category" dataKey="name" fontSize={10} tick={{ fill: GRAY[600] }} width={120} /><Tooltip content={<CT />} /><Bar dataKey="value" fill={ORANGE[500]} radius={[0, 4, 4, 0]} name="Viajes" /></BarChart></ResponsiveContainer></CC>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB OPERADORES
// ═══════════════════════════════════════════════════════════════════════════
function TabOperadores({ data }) {
  const oc = countBy(data, r => r.creadopor); const sorted = Object.entries(oc).sort((a, b) => b[1] - a[1]); const total = data.length; const mx = sorted[0]?.[1] || 1;
  const topO = sorted.slice(0, 8).map(([n]) => n); const DAYS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  const om = useMemo(() => { const r = {}; data.forEach(d => { if (!topO.includes(d.creadopor)) return; const mk = d._monthKey; if (!mk) return; if (!r[mk]) r[mk] = { month: mk, label: getMonthLabel(mk) }; r[mk][d.creadopor] = (r[mk][d.creadopor] || 0) + 1; }); return Object.values(r).sort((a, b) => a.month.localeCompare(b.month)); }, [data, topO]);
  const dow = useMemo(() => { const m = {}; data.forEach(r => { if (r._dayOfWeek === null) return; const d = DAYS[r._dayOfWeek]; if (!m[d]) m[d] = { day: d, viajes: 0, order: r._dayOfWeek }; m[d].viajes++; }); return Object.values(m).sort((a, b) => a.order - b.order); }, [data]);
  return (
    <>
      <div style={S.kpiRow}>
        <KpiCard label="Operadores" value={sorted.length} accent={BLUE[600]} />
        <KpiCard label="Top Operador" value={sorted[0]?.[0] || "—"} accent={ORANGE[500]} subtitle={`${sorted[0]?.[1]?.toLocaleString("es-CL") || 0} viajes`} />
        <KpiCard label="Promedio/Operador" value={sorted.length > 0 ? Math.round(total / sorted.length).toLocaleString("es-CL") : "0"} accent={BLUE[400]} />
      </div>
      <div style={S.g2}>
        <CC title="Ranking de Operadores"><DT columns={[{ key: "rank", label: "#", render: v => <span style={S.badge(BLUE[600])}>{v}</span> }, { key: "name", label: "Operador" }, { key: "count", label: "Viajes", align: "right", render: v => v.toLocaleString("es-CL") }, { key: "pct", label: "%", align: "right", render: v => `${v}%` }, { key: "bar", label: "", render: (_, row) => <RB value={row.count} max={mx} color={BLUE[500]} /> }]} data={sorted.map(([n, c], i) => ({ rank: i + 1, name: n, count: c, pct: total > 0 ? (c / total * 100).toFixed(1) : "0" }))} maxRows={20} /></CC>
        <CC title="Viajes por Día de la Semana"><ResponsiveContainer width="100%" height={280}><BarChart data={dow}><CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} /><XAxis dataKey="day" fontSize={12} tick={{ fill: GRAY[600] }} /><YAxis fontSize={11} tick={{ fill: GRAY[500] }} /><Tooltip content={<CT />} /><Bar dataKey="viajes" fill={ORANGE[500]} radius={[4, 4, 0, 0]} name="Viajes" /></BarChart></ResponsiveContainer></CC>
      </div>
      <CC title="Evolución Top Operadores"><ResponsiveContainer width="100%" height={320}><LineChart data={om}><CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} /><XAxis dataKey="label" fontSize={10} tick={{ fill: GRAY[500] }} angle={-30} textAnchor="end" height={50} /><YAxis fontSize={11} tick={{ fill: GRAY[500] }} /><Tooltip content={<CT />} /><Legend fontSize={10} />{topO.slice(0, 6).map((o, i) => <Line key={o} type="monotone" dataKey={o} stroke={CHART_COLORS[i]} strokeWidth={2} dot={{ r: 2 }} name={o} />)}</LineChart></ResponsiveContainer></CC>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB TENDENCIAS
// ═══════════════════════════════════════════════════════════════════════════
function TabTendencias({ data, rawData, monthlyTrend, yoyData, years }) {
  const wd = useMemo(() => { const m = {}; data.forEach(r => { const w = r._weekKey; if (!w) return; if (!m[w]) m[w] = { week: w, viajes: 0 }; m[w].viajes++; }); return Object.values(m).sort((a, b) => a.week.localeCompare(b.week)); }, [data]);
  const mom = useMemo(() => monthlyTrend.map((m, i) => ({ ...m, growth: i > 0 ? pctChange(m.viajes, monthlyTrend[i - 1].viajes) : null })), [monthlyTrend]);
  const season = useMemo(() => { const bm = {}; rawData.forEach(r => { if (!r._month || !r._year) return; const k = `${r._year}-${r._month}`; if (!bm[r._month]) bm[r._month] = {}; bm[r._month][k] = (bm[r._month][k] || 0) + 1; }); return MONTH_NAMES.map((n, i) => { const yc = bm[i + 1] ? Object.values(bm[i + 1]) : []; return { name: n, avg: yc.length > 0 ? Math.round(yc.reduce((a, b) => a + b, 0) / yc.length) : 0, max: yc.length > 0 ? Math.max(...yc) : 0, min: yc.length > 0 ? Math.min(...yc) : 0 }; }); }, [rawData]);
  const ma = useMemo(() => wd.map((w, i) => { const win = wd.slice(Math.max(0, i - 3), i + 1); return { ...w, avg: Math.round(win.reduce((s, x) => s + x.viajes, 0) / win.length) }; }), [wd]);
  const nc = useMemo(() => { const seen = new Set(); const bm = {}; [...rawData].sort((a, b) => (a._date || 0) - (b._date || 0)).forEach(r => { const mk = r._monthKey; if (!mk || !r.cliente) return; if (!bm[mk]) bm[mk] = { month: mk, label: getMonthLabel(mk), nuevos: 0, total: 0 }; bm[mk].total++; if (!seen.has(r.cliente)) { seen.add(r.cliente); bm[mk].nuevos++; } }); return Object.values(bm).sort((a, b) => a.month.localeCompare(b.month)); }, [rawData]);
  return (
    <>
      <div style={S.g2}>
        <CC title="Tendencia Semanal (media móvil 4 sem)"><ResponsiveContainer width="100%" height={300}><ComposedChart data={ma}><CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} /><XAxis dataKey="week" fontSize={9} tick={{ fill: GRAY[400] }} interval={3} angle={-30} textAnchor="end" height={50} /><YAxis fontSize={11} tick={{ fill: GRAY[500] }} /><Tooltip content={<CT />} /><Bar dataKey="viajes" fill={BLUE[200]} name="Viajes semanales" /><Line dataKey="avg" stroke={ORANGE[500]} strokeWidth={2} dot={false} name="Media móvil" /></ComposedChart></ResponsiveContainer></CC>
        <CC title="Crecimiento Mes a Mes (%)"><ResponsiveContainer width="100%" height={300}><BarChart data={mom.filter(m => m.growth !== null)}><CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} /><XAxis dataKey="label" fontSize={10} tick={{ fill: GRAY[500] }} angle={-30} textAnchor="end" height={50} /><YAxis fontSize={11} tick={{ fill: GRAY[500] }} tickFormatter={v => `${v}%`} /><Tooltip formatter={v => `${v.toFixed(1)}%`} /><Bar dataKey="growth" name="Crecimiento %" radius={[3, 3, 0, 0]}>{mom.filter(m => m.growth !== null).map((m, i) => <Cell key={i} fill={m.growth >= 0 ? "#10b981" : "#ef4444"} />)}</Bar></BarChart></ResponsiveContainer></CC>
      </div>
      <div style={S.g2}>
        <CC title="Estacionalidad"><ResponsiveContainer width="100%" height={300}><ComposedChart data={season}><CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} /><XAxis dataKey="name" fontSize={11} tick={{ fill: GRAY[500] }} /><YAxis fontSize={11} tick={{ fill: GRAY[500] }} /><Tooltip content={<CT />} /><Area type="monotone" dataKey="max" fill={BLUE[100]} stroke="none" name="Máximo" /><Area type="monotone" dataKey="min" fill="white" stroke="none" name="" /><Line type="monotone" dataKey="avg" stroke={ORANGE[500]} strokeWidth={3} dot={{ r: 4, fill: ORANGE[500] }} name="Promedio" /></ComposedChart></ResponsiveContainer></CC>
        <CC title="Clientes Nuevos por Mes"><ResponsiveContainer width="100%" height={300}><ComposedChart data={nc}><CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} /><XAxis dataKey="label" fontSize={10} tick={{ fill: GRAY[500] }} angle={-30} textAnchor="end" height={50} /><YAxis yAxisId="left" fontSize={11} tick={{ fill: GRAY[500] }} /><YAxis yAxisId="right" orientation="right" fontSize={11} tick={{ fill: GRAY[500] }} /><Tooltip content={<CT />} /><Legend /><Bar yAxisId="left" dataKey="nuevos" fill={ORANGE[500]} radius={[3, 3, 0, 0]} name="Clientes nuevos" /><Line yAxisId="right" type="monotone" dataKey="total" stroke={BLUE[600]} strokeWidth={2} dot={false} name="Viajes totales" /></ComposedChart></ResponsiveContainer></CC>
      </div>
      {years.length >= 2 && <CC title="Comparación Interanual"><ResponsiveContainer width="100%" height={320}><LineChart data={yoyData}><CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} /><XAxis dataKey="mes" fontSize={12} tick={{ fill: GRAY[600] }} /><YAxis fontSize={11} tick={{ fill: GRAY[500] }} /><Tooltip content={<CT />} /><Legend />{years.map((y, i) => <Line key={y} type="monotone" dataKey={`y${y}`} name={String(y)} stroke={CHART_COLORS[i]} strokeWidth={2.5} dot={{ r: 4 }} />)}</LineChart></ResponsiveContainer></CC>}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB CRUCES (NUEVO)
// ═══════════════════════════════════════════════════════════════════════════
function TabCruces({ data }) {
  const [view, setView] = useState("cliente-equipo");
  const cxe = useMemo(() => {
    const cc = countBy(data, r => r.cliente); const t12 = topN(cc, 12).map(([n]) => n);
    const ec = countBy(data, r => r.tipoequipo); const t8 = topN(ec, 8).map(([n]) => n);
    const m = {}; data.forEach(r => { if (!t12.includes(r.cliente) || !t8.includes(r.tipoequipo)) return; m[`${r.cliente}||${r.tipoequipo}`] = (m[`${r.cliente}||${r.tipoequipo}`] || 0) + 1; });
    const mx = Math.max(...Object.values(m), 1);
    const rows = t12.map(c => { const row = { cliente: c }; t8.forEach(e => { row[e] = m[`${c}||${e}`] || 0; }); return row; });
    return { rows, equipos: t8, mx };
  }, [data]);

  const cxr = useMemo(() => {
    const cc = countBy(data, r => r.cliente); const t10 = topN(cc, 10).map(([n]) => n);
    const res = {}; data.forEach(r => { if (!t10.includes(r.cliente)) return; if (!res[r.cliente]) res[r.cliente] = {}; const rt = `${r.origen} → ${r.destino}`; res[r.cliente][rt] = (res[r.cliente][rt] || 0) + 1; });
    const rows = []; Object.entries(res).forEach(([cl, rutas]) => { Object.entries(rutas).sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([rt, c], i) => { rows.push({ cliente: i === 0 ? cl : "", ruta: rt, count: c }); }); });
    return rows;
  }, [data]);

  const exr = useMemo(() => {
    const ec = countBy(data, r => r.tipoequipo); const t8 = topN(ec, 8).map(([n]) => n);
    const res = {}; data.forEach(r => { if (!t8.includes(r.tipoequipo)) return; if (!res[r.tipoequipo]) res[r.tipoequipo] = {}; const rt = `${r.origen} → ${r.destino}`; res[r.tipoequipo][rt] = (res[r.tipoequipo][rt] || 0) + 1; });
    const rows = []; Object.entries(res).forEach(([eq, rutas]) => { Object.entries(rutas).sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([rt, c], i) => { rows.push({ equipo: i === 0 ? eq : "", ruta: rt, count: c }); }); });
    return rows;
  }, [data]);

  const bubble = useMemo(() => {
    const cc = countBy(data, r => r.cliente); const t15 = topN(cc, 15).map(([n]) => n);
    return t15.map(cl => { const cd = data.filter(r => r.cliente === cl); const ne = new Set(cd.map(r => r.tipoequipo)).size; return { name: cl.substring(0, 20), viajes: cd.length, equipos: ne }; });
  }, [data]);

  const views = [{ id: "cliente-equipo", label: "Cliente × Equipo" }, { id: "cliente-ruta", label: "Cliente × Ruta" }, { id: "equipo-ruta", label: "Equipo × Ruta" }];
  return (
    <>
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        {views.map(v => <button key={v.id} style={{ padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer", background: view === v.id ? BLUE[600] : "white", color: view === v.id ? "white" : GRAY[600], fontWeight: view === v.id ? "600" : "400", fontSize: "13px", boxShadow: view === v.id ? `0 2px 8px ${BLUE[600]}33` : "0 1px 3px rgba(0,0,0,0.08)", transition: "all 0.2s" }} onClick={() => setView(v.id)}>{v.label}</button>)}
      </div>
      {view === "cliente-equipo" && <>
        <CC title="Matriz Cliente × Equipo" subtitle="Intensidad del color indica volumen de viajes">
          <div style={{ overflowX: "auto" }}>
            <table style={{ ...S.tbl, fontSize: "11px" }}><thead><tr><th style={{ ...S.th, minWidth: "160px" }}>Cliente</th>{cxe.equipos.map(e => <th key={e} style={{ ...S.th, textAlign: "center", minWidth: "80px", fontSize: "9px" }}>{e.substring(0, 18)}</th>)}</tr></thead>
              <tbody>{cxe.rows.map((row, i) => <tr key={i}><td style={{ ...S.td, fontWeight: "500", fontSize: "11px" }}>{row.cliente}</td>{cxe.equipos.map(e => <td key={e} style={{ ...S.td, padding: "4px" }}><div style={S.heat(row[e] / cxe.mx)}>{row[e] > 0 ? row[e].toLocaleString("es-CL") : ""}</div></td>)}</tr>)}</tbody>
            </table>
          </div>
        </CC>
        <CC title="Diversificación de Equipos por Cliente" subtitle="Eje X = Viajes totales, Eje Y = Tipos de equipo distintos">
          <ResponsiveContainer width="100%" height={350}>
            <ScatterChart><CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} />
              <XAxis dataKey="viajes" name="Viajes" fontSize={11} tick={{ fill: GRAY[500] }} />
              <YAxis dataKey="equipos" name="Equipos" fontSize={11} tick={{ fill: GRAY[500] }} />
              <Tooltip content={({ active, payload }) => { if (!active || !payload?.length) return null; const d = payload[0].payload; return <div style={{ background: "white", border: `1px solid ${GRAY[200]}`, borderRadius: "8px", padding: "10px", fontSize: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}><div style={{ fontWeight: "600" }}>{d.name}</div><div>Viajes: {d.viajes.toLocaleString("es-CL")}</div><div>Tipos equipo: {d.equipos}</div></div>; }} />
              <Scatter data={bubble} fill={BLUE[500]}>{bubble.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </CC>
      </>}
      {view === "cliente-ruta" && <CC title="Top 3 Rutas por Cliente (Top 10)"><DT columns={[{ key: "cliente", label: "Cliente", render: v => v ? <span style={{ fontWeight: "600" }}>{v}</span> : "" }, { key: "ruta", label: "Ruta" }, { key: "count", label: "Viajes", align: "right", render: v => v.toLocaleString("es-CL") }]} data={cxr} maxRows={50} /></CC>}
      {view === "equipo-ruta" && <CC title="Top 3 Rutas por Equipo (Top 8)"><DT columns={[{ key: "equipo", label: "Tipo Equipo", render: v => v ? <span style={{ fontWeight: "600" }}>{v}</span> : "" }, { key: "ruta", label: "Ruta" }, { key: "count", label: "Viajes", align: "right", render: v => v.toLocaleString("es-CL") }]} data={exr} maxRows={50} /></CC>}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB RIESGO (NUEVO)
// ═══════════════════════════════════════════════════════════════════════════
function TabRiesgo({ data, rawData }) {
  const conc = useMemo(() => {
    const total = data.length; if (total === 0) return { hhi: 0, level: "low", t1: 0, t3: 0, t5: 0, clients: [] };
    const cc = countBy(data, r => r.cliente); const sorted = Object.entries(cc).sort((a, b) => b[1] - a[1]);
    const hhi = sorted.reduce((s, [, c]) => { const sh = c / total; return s + sh * sh; }, 0);
    const t1 = sorted[0]?.[1] / total * 100 || 0;
    const t3 = sorted.slice(0, 3).reduce((s, [, c]) => s + c, 0) / total * 100;
    const t5 = sorted.slice(0, 5).reduce((s, [, c]) => s + c, 0) / total * 100;
    let level = "low"; if (hhi > 0.25 || t1 > 40) level = "high"; else if (hhi > 0.15 || t1 > 25) level = "medium";
    return { hhi, level, t1, t3, t5, clients: sorted };
  }, [data]);

  const declining = useMemo(() => {
    const mks = [...new Set(rawData.map(r => r._monthKey).filter(Boolean))].sort();
    if (mks.length < 2) return [];
    const lm = mks[mks.length - 1]; const pm = mks[mks.length - 2];
    const lc = countBy(rawData.filter(r => r._monthKey === lm), r => r.cliente);
    const pc = countBy(rawData.filter(r => r._monthKey === pm), r => r.cliente);
    const res = [];
    Object.entries(pc).forEach(([cl, pv]) => { const lv = lc[cl] || 0; const ch = pctChange(lv, pv); if ((ch !== null && ch < -15) || (!lc[cl] && pv >= 5)) res.push({ client: cl, prev: pv, last: lv, change: lc[cl] ? ch : -100, pmLabel: getMonthLabel(pm), lmLabel: getMonthLabel(lm) }); });
    return res.sort((a, b) => a.change - b.change);
  }, [rawData]);

  const growing = useMemo(() => {
    const mks = [...new Set(rawData.map(r => r._monthKey).filter(Boolean))].sort();
    if (mks.length < 2) return [];
    const lm = mks[mks.length - 1]; const pm = mks[mks.length - 2];
    const lc = countBy(rawData.filter(r => r._monthKey === lm), r => r.cliente);
    const pc = countBy(rawData.filter(r => r._monthKey === pm), r => r.cliente);
    const res = [];
    Object.entries(lc).forEach(([cl, lv]) => { const pv = pc[cl] || 0; if (pv > 0) { const ch = pctChange(lv, pv); if (ch > 20 && lv >= 5) res.push({ client: cl, prev: pv, last: lv, change: ch, isNew: false }); } else if (lv >= 5) res.push({ client: cl, prev: 0, last: lv, change: null, isNew: true }); });
    return res.sort((a, b) => (b.change || 999) - (a.change || 999));
  }, [rawData]);

  const vps = useMemo(() => {
    const sc = countBy(data, r => r.solicitud); const dist = {};
    Object.values(sc).forEach(c => { dist[c] = (dist[c] || 0) + 1; });
    const total = Object.keys(sc).length; const totalV = data.length;
    const cd = Object.entries(dist).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).slice(0, 10).map(([v, c]) => ({ viajes: `${v} viaje${parseInt(v) > 1 ? "s" : ""}`, count: c }));
    return { avg: total > 0 ? (totalV / total).toFixed(2) : "0", total, cd };
  }, [data]);

  const cpie = useMemo(() => {
    if (conc.clients.length === 0) return [];
    const t5 = conc.clients.slice(0, 5).map(([n, v]) => ({ name: n, value: v }));
    const rest = conc.clients.slice(5).reduce((s, [, c]) => s + c, 0);
    if (rest > 0) t5.push({ name: "Resto", value: rest });
    return t5;
  }, [conc]);

  return (
    <>
      <div style={S.alert(conc.level)}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Sem level={conc.level} />
          <div>
            <div style={{ fontWeight: "600", fontSize: "15px" }}>Nivel de Concentración: {conc.level === "high" ? "ALTO" : conc.level === "medium" ? "MEDIO" : "BAJO"}</div>
            <div style={{ fontSize: "12px", color: GRAY[500], marginTop: "2px" }}>HHI: {(conc.hhi * 10000).toFixed(0)} | Top 1: {conc.t1.toFixed(1)}% | Top 3: {conc.t3.toFixed(1)}% | Top 5: {conc.t5.toFixed(1)}%</div>
          </div>
        </div>
      </div>
      <div style={S.kpiRow}>
        <KpiCard label="Índice HHI" value={(conc.hhi * 10000).toFixed(0)} accent={RISK_COLORS[conc.level]} subtitle={conc.hhi > 0.25 ? "Altamente concentrado" : conc.hhi > 0.15 ? "Moderado" : "Diversificado"} />
        <KpiCard label="Clientes en Declive" value={declining.length} accent={RISK_COLORS.high} subtitle="> -15% vs mes anterior" />
        <KpiCard label="Clientes Creciendo" value={growing.length} accent={RISK_COLORS.low} subtitle="> +20% vs mes anterior" />
        <KpiCard label="Viajes/Solicitud" value={vps.avg} accent={BLUE[600]} subtitle={`${vps.total.toLocaleString("es-CL")} solicitudes`} />
      </div>
      <div style={S.g2}>
        <CC title="Concentración de Clientes"><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={cpie} cx="50%" cy="50%" outerRadius={110} innerRadius={45} dataKey="value" nameKey="name" label={({ name, percent }) => `${name.substring(0, 15)} ${(percent * 100).toFixed(0)}%`} fontSize={10}>{cpie.map((_, i) => <Cell key={i} fill={i < 5 ? CHART_COLORS[i] : GRAY[300]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></CC>
        <CC title="Distribución Viajes/Solicitud"><ResponsiveContainer width="100%" height={300}><BarChart data={vps.cd}><CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} /><XAxis dataKey="viajes" fontSize={11} tick={{ fill: GRAY[600] }} /><YAxis fontSize={11} tick={{ fill: GRAY[500] }} /><Tooltip content={<CT />} /><Bar dataKey="count" fill={BLUE[500]} radius={[4, 4, 0, 0]} name="Solicitudes" /></BarChart></ResponsiveContainer></CC>
      </div>
      <div style={S.g2}>
        <CC title="⚠️ Clientes en Declive" subtitle="Caída > 15% vs mes anterior" style={{ borderTop: `3px solid ${RISK_COLORS.high}` }}>
          {declining.length === 0 ? <div style={{ textAlign: "center", padding: "40px", color: GRAY[400] }}>Sin clientes en declive significativo</div> :
          <DT columns={[{ key: "client", label: "Cliente" }, { key: "prev", label: "Anterior", align: "right" }, { key: "last", label: "Actual", align: "right" }, { key: "change", label: "Cambio", align: "right", render: v => <span style={{ color: RISK_COLORS.high, fontWeight: 600 }}>{v === -100 ? "INACTIVO" : `${v.toFixed(0)}%`}</span> }]} data={declining.slice(0, 15)} />}
        </CC>
        <CC title="🚀 Clientes Creciendo" subtitle="Crecimiento > 20% vs mes anterior" style={{ borderTop: `3px solid ${RISK_COLORS.low}` }}>
          {growing.length === 0 ? <div style={{ textAlign: "center", padding: "40px", color: GRAY[400] }}>Sin crecimiento significativo</div> :
          <DT columns={[{ key: "client", label: "Cliente" }, { key: "prev", label: "Anterior", align: "right" }, { key: "last", label: "Actual", align: "right" }, { key: "change", label: "Cambio", align: "right", render: (v, row) => <span style={{ color: RISK_COLORS.low, fontWeight: 600 }}>{row.isNew ? "NUEVO" : `+${v.toFixed(0)}%`}</span> }]} data={growing.slice(0, 15)} />}
        </CC>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB PROYECCIÓN (NUEVO)
// ═══════════════════════════════════════════════════════════════════════════
function TabProyeccion({ rawData, monthlyTrend }) {
  const proj = useMemo(() => {
    if (monthlyTrend.length < 3) return { projected: [], chartData: [], slope: 0, seasonFactors: new Array(12).fill(1) };
    const sorted = [...monthlyTrend].sort((a, b) => a.month.localeCompare(b.month));
    const vals = sorted.map(m => m.viajes);

    // Seasonality
    const sf = new Array(12).fill(1);
    if (vals.length >= 12) {
      const avgAll = vals.reduce((a, b) => a + b, 0) / vals.length;
      const bm = {};
      sorted.forEach(m => { const mo = parseInt(m.month.split("-")[1]); if (!bm[mo]) bm[mo] = []; bm[mo].push(m.viajes); });
      for (let mo = 1; mo <= 12; mo++) { if (bm[mo]?.length) { sf[mo - 1] = avgAll > 0 ? (bm[mo].reduce((a, b) => a + b, 0) / bm[mo].length) / avgAll : 1; } }
    }

    // Deseasonalize + linear regression
    const ds = vals.map((v, i) => { const mo = parseInt(sorted[i].month.split("-")[1]); return sf[mo - 1] !== 0 ? v / sf[mo - 1] : v; });
    const n = ds.length; const xm = (n - 1) / 2; const ym = ds.reduce((a, b) => a + b, 0) / n;
    let slope = 0, den = 0;
    for (let i = 0; i < n; i++) { slope += (i - xm) * (ds[i] - ym); den += (i - xm) * (i - xm); }
    slope = den !== 0 ? slope / den : 0;
    const intercept = ym - slope * xm;

    // Project 3 months
    const lastMo = sorted[sorted.length - 1].month;
    const [lY, lM] = lastMo.split("-").map(Number);
    const projections = [];
    for (let j = 1; j <= 3; j++) {
      let mo = lM + j, yr = lY;
      while (mo > 12) { mo -= 12; yr++; }
      const trend = intercept + slope * (n - 1 + j);
      const projected = Math.max(0, Math.round(trend * sf[mo - 1]));
      const mk = `${yr}-${String(mo).padStart(2, "0")}`;
      projections.push({ month: mk, label: getMonthLabel(mk), projected, isProjection: true });
    }

    // Confidence
    const recent = vals.slice(-6);
    const rMean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const stdDev = Math.sqrt(recent.reduce((s, v) => s + (v - rMean) ** 2, 0) / recent.length);
    projections.forEach(p => { p.upper = Math.round(p.projected + 1.5 * stdDev); p.lower = Math.max(0, Math.round(p.projected - 1.5 * stdDev)); });

    const chartData = sorted.map(m => ({ month: m.month, label: m.label, viajes: m.viajes, isProjection: false }));
    projections.forEach(p => chartData.push(p));

    return { projected: projections, chartData, slope, seasonFactors: sf };
  }, [monthlyTrend]);

  const clientProj = useMemo(() => {
    const cc = countBy(rawData, r => r.cliente); const t10 = topN(cc, 10).map(([n]) => n);
    const mks = [...new Set(rawData.map(r => r._monthKey).filter(Boolean))].sort();
    if (mks.length < 3) return [];
    const last3 = mks.slice(-3); const prev3 = mks.slice(-6, -3);
    return t10.map(cl => {
      const rec = rawData.filter(r => last3.includes(r._monthKey) && r.cliente === cl).length;
      const prev = rawData.filter(r => prev3.includes(r._monthKey) && r.cliente === cl).length;
      const ra = rec / Math.min(last3.length, 3);
      const pa = prev3.length > 0 ? prev / Math.min(prev3.length, 3) : null;
      const trend = pa ? pctChange(ra, pa) : null;
      return { client: cl, recentAvg: ra.toFixed(1), prevAvg: pa?.toFixed(1) || "—", trend, projected: Math.round(ra), level: trend === null ? "medium" : trend > 5 ? "low" : trend < -10 ? "high" : "medium" };
    });
  }, [rawData]);

  return (
    <>
      <div style={S.alert("medium")}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "24px" }}>🔮</span>
          <div>
            <div style={{ fontWeight: "600", fontSize: "15px" }}>Modelo: Tendencia + Estacionalidad</div>
            <div style={{ fontSize: "12px", color: GRAY[500], marginTop: "2px" }}>Regresión lineal sobre datos desestacionalizados con {monthlyTrend.length} meses de historia. Bandas = ±1.5 desviaciones estándar.</div>
          </div>
        </div>
      </div>
      <div style={S.kpiRow}>
        {proj.projected.map((p, i) => <KpiCard key={i} label={`Proyección ${p.label}`} value={p.projected.toLocaleString("es-CL")} accent={i === 0 ? ORANGE[500] : BLUE[400]} subtitle={`Rango: ${p.lower?.toLocaleString("es-CL")} — ${p.upper?.toLocaleString("es-CL")}`} />)}
        <KpiCard label="Tendencia Mensual" value={`${proj.slope >= 0 ? "+" : ""}${proj.slope?.toFixed(1) || 0}`} accent={proj.slope >= 0 ? RISK_COLORS.low : RISK_COLORS.high} subtitle="Viajes adicionales/mes" />
      </div>
      <CC title="Proyección de Demanda (próximos 3 meses)" subtitle="Barras = real · Línea naranja punteada = proyección · Banda = rango probable">
        <ResponsiveContainer width="100%" height={380}>
          <ComposedChart data={proj.chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} />
            <XAxis dataKey="label" fontSize={10} tick={{ fill: GRAY[500] }} angle={-30} textAnchor="end" height={50} />
            <YAxis fontSize={11} tick={{ fill: GRAY[500] }} />
            <Tooltip content={({ active, payload, label }) => { if (!active || !payload?.length) return null; const d = payload[0]?.payload; return <div style={{ background: "white", border: `1px solid ${GRAY[200]}`, borderRadius: "8px", padding: "10px", fontSize: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}><div style={{ fontWeight: "600", marginBottom: "4px" }}>{label} {d?.isProjection ? "(Proyección)" : ""}</div>{d?.viajes != null && <div>Real: <strong>{d.viajes.toLocaleString("es-CL")}</strong></div>}{d?.projected != null && <div style={{ color: ORANGE[600] }}>Proyectado: <strong>{d.projected.toLocaleString("es-CL")}</strong></div>}{d?.lower != null && <div style={{ color: GRAY[400] }}>Rango: {d.lower.toLocaleString("es-CL")} — {d.upper.toLocaleString("es-CL")}</div>}</div>; }} />
            <Area dataKey="upper" fill={BLUE[100]} stroke="none" name="" />
            <Area dataKey="lower" fill="white" stroke="none" name="" />
            <Bar dataKey="viajes" fill={BLUE[500]} radius={[4, 4, 0, 0]} name="Viajes reales" />
            <Line dataKey="projected" stroke={ORANGE[500]} strokeWidth={3} strokeDasharray="8 4" dot={{ r: 5, fill: ORANGE[500] }} name="Proyección" connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </CC>
      <CC title="Proyección por Cliente (Top 10)" subtitle="Promedio últimos 3 meses vs 3 meses anteriores">
        <DT columns={[
          { key: "client", label: "Cliente" },
          { key: "prevAvg", label: "Prom. anterior/mes", align: "right" },
          { key: "recentAvg", label: "Prom. reciente/mes", align: "right" },
          { key: "trend", label: "Tendencia", align: "right", render: (v, row) => <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px" }}><Sem level={row.level} />{v !== null ? <span style={{ fontWeight: "600", color: v >= 0 ? RISK_COLORS.low : RISK_COLORS.high }}>{v >= 0 ? "+" : ""}{v.toFixed(1)}%</span> : "N/A"}</span> },
          { key: "projected", label: "Est. próx. mes", align: "right", render: v => <span style={{ fontWeight: "600" }}>{v.toLocaleString("es-CL")}</span> },
        ]} data={clientProj} />
      </CC>
      <CC title="Factores de Estacionalidad" subtitle="Factor > 1.0 = sobre promedio · < 1.0 = bajo promedio">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={proj.seasonFactors?.map((f, i) => ({ mes: MONTH_NAMES[i], factor: parseFloat(f.toFixed(3)) })) || []}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} />
            <XAxis dataKey="mes" fontSize={11} tick={{ fill: GRAY[600] }} />
            <YAxis fontSize={11} tick={{ fill: GRAY[500] }} domain={[0, 'auto']} />
            <Tooltip formatter={v => v.toFixed(3)} />
            <Bar dataKey="factor" name="Factor estacional" radius={[4, 4, 0, 0]}>{proj.seasonFactors?.map((f, i) => <Cell key={i} fill={f >= 1 ? BLUE[500] : ORANGE[400]} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </CC>
    </>
  );
}
