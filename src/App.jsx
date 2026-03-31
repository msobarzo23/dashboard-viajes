import { useState, useEffect, useMemo } from "react";
import Papa from "papaparse";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ComposedChart
} from "recharts";

// ── CONFIG ──────────────────────────────────────────────────────────────────
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRfKblo0PEPiyzfOniTQzk0HEf7fBeH1yC0SFBfKO0sMnGhPPEWI0T7fRtPA9rcXx8VPsptR3T835xa/pub?gid=0&single=true&output=csv"; // Reemplazar con la URL del CSV publicado

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

// ── TABS ────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "resumen", label: "Resumen", icon: "📊" },
  { id: "clientes", label: "Clientes", icon: "🏢" },
  { id: "equipos", label: "Equipos", icon: "🚛" },
  { id: "rutas", label: "Rutas", icon: "🗺️" },
  { id: "operadores", label: "Operadores", icon: "👷" },
  { id: "tendencias", label: "Tendencias", icon: "📈" },
];

// ── HELPERS ──────────────────────────────────────────────────────────────────
const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function parseDate(str) {
  if (!str) return null;
  // handle dd/mm/yyyy or d/m/yyyy or d/mm/yyyy
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
  start.setDate(start.getDate() - start.getDay() + 1); // lunes
  return `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,"0")}-${String(start.getDate()).padStart(2,"0")}`;
}

function countBy(arr, fn) {
  const map = {};
  arr.forEach(item => {
    const key = fn(item);
    if (key) map[key] = (map[key] || 0) + 1;
  });
  return map;
}

function topN(obj, n = 10) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function pctChange(curr, prev) {
  if (!prev || prev === 0) return null;
  return ((curr - prev) / prev * 100);
}

// ── STYLES ──────────────────────────────────────────────────────────────────
const styles = {
  app: {
    fontFamily: "'Outfit', 'Segoe UI', sans-serif",
    background: `linear-gradient(135deg, ${BLUE[50]} 0%, #ffffff 50%, ${ORANGE[50]} 100%)`,
    minHeight: "100vh",
    color: GRAY[800],
  },
  header: {
    background: `linear-gradient(135deg, ${BLUE[900]} 0%, ${BLUE[700]} 100%)`,
    padding: "20px 32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  logo: {
    width: "42px",
    height: "42px",
    background: ORANGE[500],
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "22px",
    fontWeight: "800",
    color: "white",
    boxShadow: `0 2px 8px ${ORANGE[500]}55`,
  },
  headerTitle: {
    color: "white",
    fontSize: "22px",
    fontWeight: "700",
    letterSpacing: "-0.3px",
  },
  headerSubtitle: {
    color: BLUE[200],
    fontSize: "13px",
    fontWeight: "400",
    marginTop: "2px",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    color: BLUE[200],
    fontSize: "13px",
  },
  nav: {
    background: "white",
    borderBottom: `1px solid ${GRAY[200]}`,
    padding: "0 32px",
    display: "flex",
    gap: "4px",
    overflowX: "auto",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  tab: (active) => ({
    padding: "14px 20px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: active ? "600" : "400",
    color: active ? BLUE[700] : GRAY[500],
    borderBottom: active ? `3px solid ${ORANGE[500]}` : "3px solid transparent",
    transition: "all 0.2s",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    whiteSpace: "nowrap",
  }),
  main: {
    padding: "24px 32px",
    maxWidth: "1400px",
    margin: "0 auto",
  },
  filtersBar: {
    display: "flex",
    gap: "12px",
    marginBottom: "24px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  select: {
    padding: "8px 12px",
    borderRadius: "8px",
    border: `1px solid ${GRAY[300]}`,
    fontSize: "13px",
    color: GRAY[700],
    background: "white",
    cursor: "pointer",
    outline: "none",
  },
  filterLabel: {
    fontSize: "12px",
    fontWeight: "600",
    color: GRAY[500],
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  kpiRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  },
  kpiCard: (accent = BLUE[600]) => ({
    background: "white",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    borderLeft: `4px solid ${accent}`,
    position: "relative",
    overflow: "hidden",
  }),
  kpiValue: {
    fontSize: "28px",
    fontWeight: "700",
    color: GRAY[900],
    lineHeight: "1.1",
  },
  kpiLabel: {
    fontSize: "12px",
    fontWeight: "600",
    color: GRAY[500],
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "6px",
  },
  kpiChange: (positive) => ({
    fontSize: "12px",
    fontWeight: "600",
    color: positive ? "#10b981" : "#ef4444",
    marginTop: "4px",
    display: "flex",
    alignItems: "center",
    gap: "2px",
  }),
  chartCard: {
    background: "white",
    borderRadius: "12px",
    padding: "24px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    marginBottom: "20px",
  },
  chartTitle: {
    fontSize: "16px",
    fontWeight: "600",
    color: GRAY[800],
    marginBottom: "16px",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
    gap: "20px",
    marginBottom: "20px",
  },
  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: "0",
    fontSize: "13px",
  },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    fontWeight: "600",
    color: GRAY[600],
    borderBottom: `2px solid ${GRAY[200]}`,
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    position: "sticky",
    top: 0,
    background: "white",
  },
  td: {
    padding: "10px 12px",
    borderBottom: `1px solid ${GRAY[100]}`,
    color: GRAY[700],
  },
  badge: (color = BLUE[600]) => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "10px",
    fontSize: "11px",
    fontWeight: "600",
    background: `${color}15`,
    color: color,
  }),
  loading: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "60vh",
    gap: "16px",
  },
  spinner: {
    width: "48px",
    height: "48px",
    border: `4px solid ${GRAY[200]}`,
    borderTop: `4px solid ${ORANGE[500]}`,
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  compareToggle: (active) => ({
    padding: "6px 14px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    border: "none",
    background: active ? ORANGE[500] : GRAY[100],
    color: active ? "white" : GRAY[600],
    transition: "all 0.2s",
  }),
};

// ── COMPONENTS ──────────────────────────────────────────────────────────────
function KpiCard({ label, value, change, accent, subtitle }) {
  return (
    <div style={styles.kpiCard(accent)}>
      <div style={styles.kpiLabel}>{label}</div>
      <div style={styles.kpiValue}>{value}</div>
      {change !== null && change !== undefined && (
        <div style={styles.kpiChange(change >= 0)}>
          {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}% vs periodo anterior
        </div>
      )}
      {subtitle && <div style={{ fontSize: "11px", color: GRAY[400], marginTop: "4px" }}>{subtitle}</div>}
    </div>
  );
}

function ChartCard({ title, children, style = {} }) {
  return (
    <div style={{ ...styles.chartCard, ...style }}>
      <div style={styles.chartTitle}>{title}</div>
      {children}
    </div>
  );
}

function DataTable({ columns, data, maxRows = 15 }) {
  return (
    <div style={{ overflowX: "auto", maxHeight: "400px", overflowY: "auto" }}>
      <table style={styles.table}>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i} style={{ ...styles.th, textAlign: col.align || "left" }}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, maxRows).map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "white" : GRAY[50] }}>
              {columns.map((col, j) => (
                <td key={j} style={{ ...styles.td, textAlign: col.align || "left" }}>
                  {col.render ? col.render(row[col.key], row, i) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Bar for ranking
function RankBar({ value, max, color = BLUE[500] }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "120px" }}>
      <div style={{ flex: 1, height: "8px", borderRadius: "4px", background: GRAY[100] }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: "4px", background: color, transition: "width 0.5s" }} />
      </div>
      <span style={{ fontSize: "13px", fontWeight: "600", color: GRAY[700], minWidth: "40px", textAlign: "right" }}>{value}</span>
    </div>
  );
}

const customTooltipStyle = {
  background: "white",
  border: `1px solid ${GRAY[200]}`,
  borderRadius: "8px",
  padding: "10px 14px",
  fontSize: "12px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={customTooltipStyle}>
      <div style={{ fontWeight: "600", marginBottom: "4px", color: GRAY[800] }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, display: "flex", justifyContent: "space-between", gap: "16px" }}>
          <span>{p.name}:</span>
          <span style={{ fontWeight: "600" }}>{p.value?.toLocaleString("es-CL")}</span>
        </div>
      ))}
    </div>
  );
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

  // ── LOAD DATA ──
  useEffect(() => {
    // Add Google Font
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    // Add spinner animation
    const styleEl = document.createElement("style");
    styleEl.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(styleEl);

    Papa.parse(CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const cleaned = results.data
          .filter(r => r.solicitud && r.fechainicio)
          .map(r => {
            const d = parseDate(r.fechainicio);
            return {
              ...r,
              _date: d,
              _year: d ? d.getFullYear() : null,
              _month: d ? d.getMonth() + 1 : null,
              _monthKey: getMonthKey(d),
              _weekKey: getWeekKey(d),
              _dayOfWeek: d ? d.getDay() : null,
              cliente: (r.Cliente || r.cliente || "").trim().toUpperCase(),
              tipoequipo: (r.tipoequipo || "").trim().toUpperCase(),
              tipocarga: (r.tipocarga || "").trim().toUpperCase(),
              tipoviaje: (r.tipoviaje || "").trim().toUpperCase(),
              origen: (r.origen || "").trim().toUpperCase(),
              destino: (r.destino || "").trim().toUpperCase(),
              creadopor: (r.creadopor || "").trim(),
            };
          })
          .filter(r => r._date);
        setRawData(cleaned);
        setLoading(false);
      },
      error: (err) => {
        setError(err.message);
        setLoading(false);
      },
    });
  }, []);

  // ── DERIVED ──
  const years = useMemo(() => [...new Set(rawData.map(r => r._year).filter(Boolean))].sort(), [rawData]);
  const clients = useMemo(() => [...new Set(rawData.map(r => r.cliente).filter(Boolean))].sort(), [rawData]);
  const equipos = useMemo(() => [...new Set(rawData.map(r => r.tipoequipo).filter(Boolean))].sort(), [rawData]);

  const filteredData = useMemo(() => {
    return rawData.filter(r => {
      if (selectedYear !== "todos" && r._year !== parseInt(selectedYear)) return false;
      if (selectedMonth !== "todos" && r._month !== parseInt(selectedMonth)) return false;
      if (selectedClient !== "todos" && r.cliente !== selectedClient) return false;
      if (selectedEquipo !== "todos" && r.tipoequipo !== selectedEquipo) return false;
      return true;
    });
  }, [rawData, selectedYear, selectedMonth, selectedClient, selectedEquipo]);

  // Previous period data for comparison
  const prevPeriodData = useMemo(() => {
    if (!compareMode) return [];
    if (selectedMonth !== "todos" && selectedYear !== "todos") {
      // Compare same month previous year
      const prevYear = parseInt(selectedYear) - 1;
      const month = parseInt(selectedMonth);
      return rawData.filter(r => r._year === prevYear && r._month === month);
    }
    if (selectedYear !== "todos") {
      const prevYear = parseInt(selectedYear) - 1;
      return rawData.filter(r => r._year === prevYear);
    }
    return [];
  }, [rawData, compareMode, selectedYear, selectedMonth]);

  // ── COMPUTED METRICS ──
  const metrics = useMemo(() => {
    const total = filteredData.length;
    const solicitudes = new Set(filteredData.map(r => r.solicitud)).size;
    const clientCount = new Set(filteredData.map(r => r.cliente)).size;
    const byMonth = countBy(filteredData, r => r._monthKey);
    const monthKeys = Object.keys(byMonth).sort();
    const avgPerMonth = monthKeys.length > 0 ? Math.round(total / monthKeys.length) : 0;

    // Previous period
    const prevTotal = prevPeriodData.length;
    const prevSolicitudes = new Set(prevPeriodData.map(r => r.solicitud)).size;
    const prevClients = new Set(prevPeriodData.map(r => r.cliente)).size;

    // By tipoviaje
    const byTipoViaje = countBy(filteredData, r => r.tipoviaje);

    return {
      total, solicitudes, clientCount, avgPerMonth,
      byMonth, monthKeys,
      prevTotal, prevSolicitudes, prevClients,
      byTipoViaje,
    };
  }, [filteredData, prevPeriodData]);

  // Monthly trend data
  const monthlyTrend = useMemo(() => {
    const allMonths = {};
    rawData.forEach(r => {
      const mk = r._monthKey;
      if (mk) {
        if (!allMonths[mk]) allMonths[mk] = { month: mk, label: getMonthLabel(mk), viajes: 0, solicitudes: new Set() };
        allMonths[mk].viajes++;
        allMonths[mk].solicitudes.add(r.solicitud);
      }
    });
    return Object.values(allMonths)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({ ...m, solicitudes: m.solicitudes.size }));
  }, [rawData]);

  // Year-over-year comparison data
  const yoyData = useMemo(() => {
    if (years.length < 2) return [];
    const byYearMonth = {};
    rawData.forEach(r => {
      if (!r._year || !r._month) return;
      const key = r._month;
      if (!byYearMonth[key]) byYearMonth[key] = { mes: MONTH_NAMES[r._month - 1] };
      const yearKey = `y${r._year}`;
      byYearMonth[key][yearKey] = (byYearMonth[key][yearKey] || 0) + 1;
    });
    return Object.values(byYearMonth).sort((a, b) => MONTH_NAMES.indexOf(a.mes) - MONTH_NAMES.indexOf(b.mes));
  }, [rawData, years]);

  // ── RENDER ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner} />
        <div style={{ fontSize: "16px", fontWeight: "500", color: GRAY[500] }}>Cargando datos de viajes...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.loading}>
        <div style={{ fontSize: "48px" }}>⚠️</div>
        <div style={{ fontSize: "16px", color: "#ef4444" }}>Error: {error}</div>
        <div style={{ fontSize: "13px", color: GRAY[500] }}>Verifica que la URL del CSV sea correcta</div>
      </div>
    );
  }

  const lastDate = rawData.length > 0
    ? rawData.reduce((max, r) => r._date > max ? r._date : max, rawData[0]._date)
    : null;

  return (
    <div style={styles.app}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>TB</div>
          <div>
            <div style={styles.headerTitle}>Dashboard de Viajes</div>
            <div style={styles.headerSubtitle}>Transportes Bello e Hijos Ltda.</div>
          </div>
        </div>
        <div style={styles.headerRight}>
          <span>{rawData.length.toLocaleString("es-CL")} viajes totales</span>
          <span style={{ color: GRAY[600] }}>|</span>
          <span>Última actualización: {lastDate ? lastDate.toLocaleDateString("es-CL") : "—"}</span>
        </div>
      </header>

      {/* NAV */}
      <nav style={styles.nav}>
        {TABS.map(t => (
          <div key={t.id} style={styles.tab(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
            <span>{t.icon}</span> {t.label}
          </div>
        ))}
      </nav>

      {/* FILTERS */}
      <div style={styles.main}>
        <div style={styles.filtersBar}>
          <div>
            <div style={styles.filterLabel}>Año</div>
            <select style={styles.select} value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
              <option value="todos">Todos</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <div style={styles.filterLabel}>Mes</div>
            <select style={styles.select} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
              <option value="todos">Todos</option>
              {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <div style={styles.filterLabel}>Cliente</div>
            <select style={styles.select} value={selectedClient} onChange={e => setSelectedClient(e.target.value)}>
              <option value="todos">Todos ({clients.length})</option>
              {clients.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div style={styles.filterLabel}>Tipo Equipo</div>
            <select style={styles.select} value={selectedEquipo} onChange={e => setSelectedEquipo(e.target.value)}>
              <option value="todos">Todos ({equipos.length})</option>
              {equipos.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <div style={styles.filterLabel}>Comparar</div>
            <button style={styles.compareToggle(compareMode)} onClick={() => setCompareMode(!compareMode)}>
              {compareMode ? "✓ Comparando" : "vs Año anterior"}
            </button>
          </div>
        </div>

        {/* TAB CONTENT */}
        {activeTab === "resumen" && <TabResumen data={filteredData} metrics={metrics} monthlyTrend={monthlyTrend} yoyData={yoyData} years={years} compareMode={compareMode} />}
        {activeTab === "clientes" && <TabClientes data={filteredData} metrics={metrics} compareMode={compareMode} prevData={prevPeriodData} />}
        {activeTab === "equipos" && <TabEquipos data={filteredData} />}
        {activeTab === "rutas" && <TabRutas data={filteredData} />}
        {activeTab === "operadores" && <TabOperadores data={filteredData} />}
        {activeTab === "tendencias" && <TabTendencias data={filteredData} rawData={rawData} monthlyTrend={monthlyTrend} yoyData={yoyData} years={years} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: RESUMEN
// ═══════════════════════════════════════════════════════════════════════════
function TabResumen({ data, metrics, monthlyTrend, yoyData, years, compareMode }) {
  const { total, solicitudes, clientCount, avgPerMonth, prevTotal, prevSolicitudes, prevClients, byTipoViaje } = metrics;

  // Top 5 clients
  const clientCounts = countBy(data, r => r.cliente);
  const top5 = topN(clientCounts, 5);
  const topMax = top5.length > 0 ? top5[0][1] : 1;

  // Tipo viaje pie
  const pieData = Object.entries(byTipoViaje).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // Daily avg
  const dayRange = data.length > 0
    ? (() => {
        const dates = data.map(r => r._date).filter(Boolean);
        const min = new Date(Math.min(...dates));
        const max = new Date(Math.max(...dates));
        return Math.max(1, Math.ceil((max - min) / 86400000));
      })()
    : 1;
  const dailyAvg = (total / dayRange).toFixed(1);

  return (
    <>
      <div style={styles.kpiRow}>
        <KpiCard label="Total Viajes" value={total.toLocaleString("es-CL")} accent={BLUE[600]}
          change={compareMode ? pctChange(total, prevTotal) : null} />
        <KpiCard label="Solicitudes Únicas" value={solicitudes.toLocaleString("es-CL")} accent={ORANGE[500]}
          change={compareMode ? pctChange(solicitudes, prevSolicitudes) : null} />
        <KpiCard label="Clientes Activos" value={clientCount} accent={BLUE[400]}
          change={compareMode ? pctChange(clientCount, prevClients) : null} />
        <KpiCard label="Promedio Mensual" value={avgPerMonth.toLocaleString("es-CL")} accent={ORANGE[400]} subtitle={`${dailyAvg} viajes/día`} />
      </div>

      <div style={styles.grid2}>
        {/* Monthly trend */}
        <ChartCard title="Viajes por Mes">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} />
              <XAxis dataKey="label" fontSize={11} tick={{ fill: GRAY[500] }} angle={-30} textAnchor="end" height={50} />
              <YAxis fontSize={11} tick={{ fill: GRAY[500] }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="viajes" fill={BLUE[500]} radius={[4, 4, 0, 0]} name="Viajes" />
              <Line dataKey="solicitudes" stroke={ORANGE[500]} strokeWidth={2} dot={{ r: 3 }} name="Solicitudes" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Tipo viaje pie */}
        <ChartCard title="Distribución por Tipo de Viaje">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} innerRadius={50}
                dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                fontSize={10}>
                {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div style={styles.grid2}>
        {/* Top 5 Clients */}
        <ChartCard title="Top 5 Clientes">
          {top5.map(([name, count], i) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 0", borderBottom: i < top5.length - 1 ? `1px solid ${GRAY[100]}` : "none" }}>
              <span style={{ ...styles.badge(CHART_COLORS[i]), minWidth: "24px", textAlign: "center" }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: "13px", fontWeight: "500" }}>{name}</span>
              <RankBar value={count} max={topMax} color={CHART_COLORS[i]} />
            </div>
          ))}
        </ChartCard>

        {/* YOY Comparison */}
        {years.length >= 2 && (
          <ChartCard title="Comparación Interanual">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={yoyData}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} />
                <XAxis dataKey="mes" fontSize={11} tick={{ fill: GRAY[500] }} />
                <YAxis fontSize={11} tick={{ fill: GRAY[500] }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                {years.map((y, i) => (
                  <Bar key={y} dataKey={`y${y}`} name={String(y)} fill={CHART_COLORS[i]} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: CLIENTES
// ═══════════════════════════════════════════════════════════════════════════
function TabClientes({ data, compareMode, prevData }) {
  const clientCounts = countBy(data, r => r.cliente);
  const prevClientCounts = compareMode ? countBy(prevData, r => r.cliente) : {};
  const sorted = Object.entries(clientCounts).sort((a, b) => b[1] - a[1]);
  const maxVal = sorted.length > 0 ? sorted[0][1] : 1;

  // Client monthly breakdown for selected top clients
  const topClients = sorted.slice(0, 10).map(([name]) => name);
  const clientMonthly = useMemo(() => {
    const result = {};
    data.forEach(r => {
      if (!topClients.includes(r.cliente)) return;
      const mk = r._monthKey;
      if (!mk) return;
      if (!result[mk]) result[mk] = { month: mk, label: getMonthLabel(mk) };
      result[mk][r.cliente] = (result[mk][r.cliente] || 0) + 1;
    });
    return Object.values(result).sort((a, b) => a.month.localeCompare(b.month));
  }, [data, topClients]);

  // Client equipment distribution
  const clientEquipos = useMemo(() => {
    const result = {};
    data.forEach(r => {
      if (!topClients.includes(r.cliente)) return;
      if (!result[r.cliente]) result[r.cliente] = {};
      result[r.cliente][r.tipoequipo] = (result[r.cliente][r.tipoequipo] || 0) + 1;
    });
    return result;
  }, [data, topClients]);

  // Clients concentration
  const totalViajes = data.length;
  const top5Viajes = sorted.slice(0, 5).reduce((sum, [, c]) => sum + c, 0);
  const top10Viajes = sorted.slice(0, 10).reduce((sum, [, c]) => sum + c, 0);

  return (
    <>
      <div style={styles.kpiRow}>
        <KpiCard label="Clientes Activos" value={sorted.length} accent={BLUE[600]} />
        <KpiCard label="Top 5 Concentración" value={`${(top5Viajes / totalViajes * 100).toFixed(1)}%`} accent={ORANGE[500]}
          subtitle={`${top5Viajes.toLocaleString("es-CL")} de ${totalViajes.toLocaleString("es-CL")} viajes`} />
        <KpiCard label="Top 10 Concentración" value={`${(top10Viajes / totalViajes * 100).toFixed(1)}%`} accent={BLUE[400]}
          subtitle={`${top10Viajes.toLocaleString("es-CL")} de ${totalViajes.toLocaleString("es-CL")} viajes`} />
        <KpiCard label="Prom. Viajes/Cliente" value={(totalViajes / sorted.length).toFixed(1)} accent={ORANGE[400]} />
      </div>

      <div style={styles.grid2}>
        <ChartCard title="Ranking de Clientes">
          <DataTable
            columns={[
              { key: "rank", label: "#", render: (v) => <span style={styles.badge(BLUE[600])}>{v}</span> },
              { key: "name", label: "Cliente" },
              { key: "count", label: "Viajes", align: "right", render: (v) => v.toLocaleString("es-CL") },
              { key: "pct", label: "%", align: "right", render: (v) => `${v}%` },
              ...(compareMode ? [{
                key: "change", label: "vs Anterior", align: "right",
                render: (v) => v !== null ? <span style={{ color: v >= 0 ? "#10b981" : "#ef4444", fontWeight: 600 }}>{v >= 0 ? "+" : ""}{v.toFixed(1)}%</span> : "—"
              }] : []),
            ]}
            data={sorted.map(([name, count], i) => ({
              rank: i + 1, name, count,
              pct: (count / totalViajes * 100).toFixed(1),
              change: compareMode && prevClientCounts[name] ? pctChange(count, prevClientCounts[name]) : null,
            }))}
            maxRows={20}
          />
        </ChartCard>

        <ChartCard title="Evolución Top Clientes (mensual)">
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={clientMonthly}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} />
              <XAxis dataKey="label" fontSize={10} tick={{ fill: GRAY[500] }} angle={-30} textAnchor="end" height={50} />
              <YAxis fontSize={11} tick={{ fill: GRAY[500] }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend fontSize={10} />
              {topClients.slice(0, 6).map((c, i) => (
                <Area key={c} type="monotone" dataKey={c} stackId="1" fill={CHART_COLORS[i]} stroke={CHART_COLORS[i]} fillOpacity={0.6} name={c} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: EQUIPOS
// ═══════════════════════════════════════════════════════════════════════════
function TabEquipos({ data }) {
  const equipoCounts = countBy(data, r => r.tipoequipo);
  const sorted = Object.entries(equipoCounts).sort((a, b) => b[1] - a[1]);
  const total = data.length;

  // Equipment by month
  const topEquipos = sorted.slice(0, 6).map(([name]) => name);
  const equipoMonthly = useMemo(() => {
    const result = {};
    data.forEach(r => {
      const mk = r._monthKey;
      if (!mk) return;
      if (!result[mk]) result[mk] = { month: mk, label: getMonthLabel(mk) };
      result[mk][r.tipoequipo] = (result[mk][r.tipoequipo] || 0) + 1;
    });
    return Object.values(result).sort((a, b) => a.month.localeCompare(b.month));
  }, [data]);

  // Equipment + cargo combination
  const equipoCarga = useMemo(() => {
    const combos = {};
    data.forEach(r => {
      const key = `${r.tipoequipo} → ${r.tipocarga}`;
      combos[key] = (combos[key] || 0) + 1;
    });
    return topN(combos, 15);
  }, [data]);

  // Pie data
  const pieData = sorted.map(([name, value]) => ({ name, value }));

  return (
    <>
      <div style={styles.kpiRow}>
        <KpiCard label="Tipos de Equipo" value={sorted.length} accent={BLUE[600]} />
        <KpiCard label="Equipo Principal" value={sorted[0]?.[0] || "—"} accent={ORANGE[500]}
          subtitle={`${sorted[0]?.[1]?.toLocaleString("es-CL") || 0} viajes (${(sorted[0]?.[1] / total * 100).toFixed(1)}%)`} />
        <KpiCard label="Total Viajes" value={total.toLocaleString("es-CL")} accent={BLUE[400]} />
      </div>

      <div style={styles.grid2}>
        <ChartCard title="Distribución de Equipos">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={110} innerRadius={45}
                dataKey="value" nameKey="name"
                label={({ name, percent }) => percent > 0.03 ? `${name.substring(0, 15)}${name.length > 15 ? "…" : ""} ${(percent * 100).toFixed(0)}%` : ""}
                fontSize={9}>
                {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Combinaciones Equipo → Carga">
          <DataTable
            columns={[
              { key: "rank", label: "#", render: (v) => <span style={styles.badge(ORANGE[500])}>{v}</span> },
              { key: "combo", label: "Equipo → Carga" },
              { key: "count", label: "Viajes", align: "right", render: (v) => v.toLocaleString("es-CL") },
              { key: "pct", label: "%", align: "right", render: (v) => `${v}%` },
            ]}
            data={equipoCarga.map(([combo, count], i) => ({
              rank: i + 1, combo, count, pct: (count / total * 100).toFixed(1),
            }))}
          />
        </ChartCard>
      </div>

      <ChartCard title="Evolución de Equipos por Mes">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={equipoMonthly}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} />
            <XAxis dataKey="label" fontSize={10} tick={{ fill: GRAY[500] }} angle={-30} textAnchor="end" height={50} />
            <YAxis fontSize={11} tick={{ fill: GRAY[500] }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend fontSize={10} />
            {topEquipos.map((eq, i) => (
              <Bar key={eq} dataKey={eq} stackId="1" fill={CHART_COLORS[i]} name={eq} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: RUTAS
// ═══════════════════════════════════════════════════════════════════════════
function TabRutas({ data }) {
  const rutaCounts = useMemo(() => {
    const map = {};
    data.forEach(r => {
      if (!r.origen || !r.destino) return;
      const key = `${r.origen} → ${r.destino}`;
      map[key] = (map[key] || 0) + 1;
    });
    return topN(map, 20);
  }, [data]);

  const origenCounts = countBy(data, r => r.origen);
  const destinoCounts = countBy(data, r => r.destino);
  const topOrigenes = topN(origenCounts, 10);
  const topDestinos = topN(destinoCounts, 10);
  const total = data.length;

  // Origen chart data
  const origenData = topOrigenes.map(([name, value]) => ({ name, value }));
  const destinoData = topDestinos.map(([name, value]) => ({ name, value }));

  return (
    <>
      <div style={styles.kpiRow}>
        <KpiCard label="Rutas Únicas" value={new Set(data.map(r => `${r.origen}-${r.destino}`)).size} accent={BLUE[600]} />
        <KpiCard label="Orígenes Únicos" value={Object.keys(origenCounts).length} accent={ORANGE[500]} />
        <KpiCard label="Destinos Únicos" value={Object.keys(destinoCounts).length} accent={BLUE[400]} />
        <KpiCard label="Ruta Principal" value={rutaCounts[0]?.[0]?.substring(0, 25) || "—"} accent={ORANGE[400]}
          subtitle={`${rutaCounts[0]?.[1]?.toLocaleString("es-CL") || 0} viajes`} />
      </div>

      <ChartCard title="Top 20 Rutas (Origen → Destino)">
        <DataTable
          columns={[
            { key: "rank", label: "#", render: (v) => <span style={styles.badge(BLUE[600])}>{v}</span> },
            { key: "ruta", label: "Ruta" },
            { key: "count", label: "Viajes", align: "right", render: (v) => v.toLocaleString("es-CL") },
            { key: "pct", label: "%", align: "right", render: (v) => `${v}%` },
            { key: "bar", label: "", render: (_, row) => <RankBar value={row.count} max={rutaCounts[0]?.[1] || 1} color={ORANGE[500]} /> },
          ]}
          data={rutaCounts.map(([ruta, count], i) => ({
            rank: i + 1, ruta, count, pct: (count / total * 100).toFixed(1),
          }))}
          maxRows={20}
        />
      </ChartCard>

      <div style={styles.grid2}>
        <ChartCard title="Top Orígenes">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={origenData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} />
              <XAxis type="number" fontSize={11} tick={{ fill: GRAY[500] }} />
              <YAxis type="category" dataKey="name" fontSize={10} tick={{ fill: GRAY[600] }} width={120} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill={BLUE[500]} radius={[0, 4, 4, 0]} name="Viajes" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Destinos">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={destinoData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} />
              <XAxis type="number" fontSize={11} tick={{ fill: GRAY[500] }} />
              <YAxis type="category" dataKey="name" fontSize={10} tick={{ fill: GRAY[600] }} width={120} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill={ORANGE[500]} radius={[0, 4, 4, 0]} name="Viajes" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: OPERADORES
// ═══════════════════════════════════════════════════════════════════════════
function TabOperadores({ data }) {
  const opCounts = countBy(data, r => r.creadopor);
  const sorted = Object.entries(opCounts).sort((a, b) => b[1] - a[1]);
  const total = data.length;
  const maxVal = sorted.length > 0 ? sorted[0][1] : 1;

  // Operator monthly
  const topOps = sorted.slice(0, 8).map(([name]) => name);
  const opMonthly = useMemo(() => {
    const result = {};
    data.forEach(r => {
      if (!topOps.includes(r.creadopor)) return;
      const mk = r._monthKey;
      if (!mk) return;
      if (!result[mk]) result[mk] = { month: mk, label: getMonthLabel(mk) };
      result[mk][r.creadopor] = (result[mk][r.creadopor] || 0) + 1;
    });
    return Object.values(result).sort((a, b) => a.month.localeCompare(b.month));
  }, [data, topOps]);

  // Operator by day of week
  const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const dayOfWeekData = useMemo(() => {
    const map = {};
    data.forEach(r => {
      if (r._dayOfWeek === null) return;
      const day = DAYS[r._dayOfWeek];
      if (!map[day]) map[day] = { day, viajes: 0, order: r._dayOfWeek };
      map[day].viajes++;
    });
    return Object.values(map).sort((a, b) => a.order - b.order);
  }, [data]);

  return (
    <>
      <div style={styles.kpiRow}>
        <KpiCard label="Operadores" value={sorted.length} accent={BLUE[600]} />
        <KpiCard label="Top Operador" value={sorted[0]?.[0] || "—"} accent={ORANGE[500]}
          subtitle={`${sorted[0]?.[1]?.toLocaleString("es-CL") || 0} viajes`} />
        <KpiCard label="Promedio/Operador" value={Math.round(total / sorted.length).toLocaleString("es-CL")} accent={BLUE[400]} />
      </div>

      <div style={styles.grid2}>
        <ChartCard title="Ranking de Operadores">
          <DataTable
            columns={[
              { key: "rank", label: "#", render: (v) => <span style={styles.badge(BLUE[600])}>{v}</span> },
              { key: "name", label: "Operador" },
              { key: "count", label: "Viajes", align: "right", render: (v) => v.toLocaleString("es-CL") },
              { key: "pct", label: "%", align: "right", render: (v) => `${v}%` },
              { key: "bar", label: "", render: (_, row) => <RankBar value={row.count} max={maxVal} color={BLUE[500]} /> },
            ]}
            data={sorted.map(([name, count], i) => ({
              rank: i + 1, name, count, pct: (count / total * 100).toFixed(1),
            }))}
            maxRows={20}
          />
        </ChartCard>

        <ChartCard title="Viajes por Día de la Semana">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dayOfWeekData}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} />
              <XAxis dataKey="day" fontSize={12} tick={{ fill: GRAY[600] }} />
              <YAxis fontSize={11} tick={{ fill: GRAY[500] }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="viajes" fill={ORANGE[500]} radius={[4, 4, 0, 0]} name="Viajes" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Evolución Top Operadores (mensual)">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={opMonthly}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} />
            <XAxis dataKey="label" fontSize={10} tick={{ fill: GRAY[500] }} angle={-30} textAnchor="end" height={50} />
            <YAxis fontSize={11} tick={{ fill: GRAY[500] }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend fontSize={10} />
            {topOps.slice(0, 6).map((op, i) => (
              <Line key={op} type="monotone" dataKey={op} stroke={CHART_COLORS[i]} strokeWidth={2} dot={{ r: 2 }} name={op} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: TENDENCIAS
// ═══════════════════════════════════════════════════════════════════════════
function TabTendencias({ data, rawData, monthlyTrend, yoyData, years }) {
  // Weekly trend
  const weeklyData = useMemo(() => {
    const map = {};
    data.forEach(r => {
      const wk = r._weekKey;
      if (!wk) return;
      if (!map[wk]) map[wk] = { week: wk, viajes: 0 };
      map[wk].viajes++;
    });
    return Object.values(map).sort((a, b) => a.week.localeCompare(b.week));
  }, [data]);

  // Month-over-month growth
  const momGrowth = useMemo(() => {
    return monthlyTrend.map((m, i) => {
      const prev = i > 0 ? monthlyTrend[i - 1].viajes : null;
      const growth = prev ? pctChange(m.viajes, prev) : null;
      return { ...m, growth, prev };
    });
  }, [monthlyTrend]);

  // Seasonality (avg viajes per month across years)
  const seasonality = useMemo(() => {
    const byMonth = {};
    rawData.forEach(r => {
      if (!r._month) return;
      if (!byMonth[r._month]) byMonth[r._month] = { counts: [], month: r._month };
      // Group by year within this month
    });
    MONTH_NAMES.forEach((_, i) => {
      const m = i + 1;
      if (!byMonth[m]) byMonth[m] = { counts: [], month: m };
    });
    rawData.forEach(r => {
      if (!r._month || !r._year) return;
      const key = `${r._year}-${r._month}`;
      if (!byMonth[r._month]._years) byMonth[r._month]._years = {};
      byMonth[r._month]._years[key] = (byMonth[r._month]._years[key] || 0) + 1;
    });
    return MONTH_NAMES.map((name, i) => {
      const m = i + 1;
      const yearCounts = byMonth[m]?._years ? Object.values(byMonth[m]._years) : [];
      const avg = yearCounts.length > 0 ? yearCounts.reduce((a, b) => a + b, 0) / yearCounts.length : 0;
      const max = yearCounts.length > 0 ? Math.max(...yearCounts) : 0;
      const min = yearCounts.length > 0 ? Math.min(...yearCounts) : 0;
      return { name, avg: Math.round(avg), max, min };
    });
  }, [rawData]);

  // Moving average (4 weeks)
  const movingAvg = useMemo(() => {
    return weeklyData.map((w, i) => {
      const window = weeklyData.slice(Math.max(0, i - 3), i + 1);
      const avg = window.reduce((sum, x) => sum + x.viajes, 0) / window.length;
      return { ...w, avg: Math.round(avg) };
    });
  }, [weeklyData]);

  // New clients per month
  const newClients = useMemo(() => {
    const seen = new Set();
    const byMonth = {};
    rawData
      .sort((a, b) => (a._date || 0) - (b._date || 0))
      .forEach(r => {
        const mk = r._monthKey;
        if (!mk || !r.cliente) return;
        if (!byMonth[mk]) byMonth[mk] = { month: mk, label: getMonthLabel(mk), nuevos: 0, total: 0 };
        byMonth[mk].total++;
        if (!seen.has(r.cliente)) {
          seen.add(r.cliente);
          byMonth[mk].nuevos++;
        }
      });
    return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
  }, [rawData]);

  return (
    <>
      <div style={styles.grid2}>
        <ChartCard title="Tendencia Semanal (con media móvil 4 sem)">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={movingAvg}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} />
              <XAxis dataKey="week" fontSize={9} tick={{ fill: GRAY[400] }} interval={3} angle={-30} textAnchor="end" height={50} />
              <YAxis fontSize={11} tick={{ fill: GRAY[500] }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="viajes" fill={BLUE[200]} name="Viajes semanales" />
              <Line dataKey="avg" stroke={ORANGE[500]} strokeWidth={2} dot={false} name="Media móvil (4 sem)" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Crecimiento Mes a Mes (%)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={momGrowth.filter(m => m.growth !== null)}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} />
              <XAxis dataKey="label" fontSize={10} tick={{ fill: GRAY[500] }} angle={-30} textAnchor="end" height={50} />
              <YAxis fontSize={11} tick={{ fill: GRAY[500] }} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(v) => `${v.toFixed(1)}%`} />
              <Bar dataKey="growth" name="Crecimiento %" radius={[3, 3, 0, 0]}>
                {momGrowth.filter(m => m.growth !== null).map((m, i) => (
                  <Cell key={i} fill={m.growth >= 0 ? "#10b981" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div style={styles.grid2}>
        <ChartCard title="Estacionalidad (promedio por mes)">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={seasonality}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} />
              <XAxis dataKey="name" fontSize={11} tick={{ fill: GRAY[500] }} />
              <YAxis fontSize={11} tick={{ fill: GRAY[500] }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="max" fill={BLUE[100]} stroke="none" name="Máximo" />
              <Area type="monotone" dataKey="min" fill="white" stroke="none" name="" />
              <Line type="monotone" dataKey="avg" stroke={ORANGE[500]} strokeWidth={3} dot={{ r: 4, fill: ORANGE[500] }} name="Promedio" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Clientes Nuevos por Mes">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={newClients}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} />
              <XAxis dataKey="label" fontSize={10} tick={{ fill: GRAY[500] }} angle={-30} textAnchor="end" height={50} />
              <YAxis yAxisId="left" fontSize={11} tick={{ fill: GRAY[500] }} />
              <YAxis yAxisId="right" orientation="right" fontSize={11} tick={{ fill: GRAY[500] }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar yAxisId="left" dataKey="nuevos" fill={ORANGE[500]} radius={[3, 3, 0, 0]} name="Clientes nuevos" />
              <Line yAxisId="right" type="monotone" dataKey="total" stroke={BLUE[600]} strokeWidth={2} dot={false} name="Viajes totales" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* YOY */}
      {years.length >= 2 && (
        <ChartCard title="Comparación Interanual Detallada">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={yoyData}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRAY[100]} />
              <XAxis dataKey="mes" fontSize={12} tick={{ fill: GRAY[600] }} />
              <YAxis fontSize={11} tick={{ fill: GRAY[500] }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {years.map((y, i) => (
                <Line key={y} type="monotone" dataKey={`y${y}`} name={String(y)} stroke={CHART_COLORS[i]} strokeWidth={2.5} dot={{ r: 4 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </>
  );
}
