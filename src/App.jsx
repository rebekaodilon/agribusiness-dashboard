import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(BarElement, LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const UF_ALL = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
const VAR_ORDER = ["valor_mil_reais", "area_ha", "producao_t"];

export default function App() {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [meta, setMeta] = useState({ anos: [], ufs: [], culturas: [] });
  const [filtros, setFiltros] = useState({ ano: "", uf: "", cultura: "", variavel: VAR_ORDER[0] });
  const [overview, setOverview] = useState(null);
  const [choropleth, setChoropleth] = useState(null);
  const [series, setSeries] = useState(null);
  const autoTries = useRef(0);

  // global reset + scrollbar
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      html,body,#root{height:100%}
      html,body{margin:0;background:#0f172a}
      *,*:before,*:after{box-sizing:border-box}
      ::-webkit-scrollbar{height:10px;width:10px}
      ::-webkit-scrollbar-thumb{background:#223b82;border-radius:10px}
      ::-webkit-scrollbar-track{background:#0c122e}
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // filtros iniciais
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const r = await fetch(`${API_URL}/filters`);
        if (!r.ok) throw new Error("Falha ao carregar filtros");
        const data = await r.json();
        const ufsFromApi = Array.isArray(data.ufs) ? data.ufs.filter(Boolean) : [];
        const ufs = ufsFromApi.length >= 5 ? ufsFromApi : UF_ALL;
        const anos = Array.isArray(data.anos) ? data.anos : [];
        const culturas = Array.isArray(data.culturas) ? data.culturas : [];
        setMeta({ anos, ufs, culturas });

        const lastYear = String(anos?.[0] ?? anos?.[anos.length - 1] ?? "");
        const defaultUF = ufs.includes("SP") ? "SP" : ufs[0] || "";
        const defaultCultura = (culturas || []).find((c) => c !== "Total") || culturas[0] || "";
        setFiltros({ ano: lastYear, uf: defaultUF, cultura: defaultCultura, variavel: VAR_ORDER[0] });
      } catch (e) {
        setErro(e?.message || "Erro ao buscar filtros");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // busca dados
  useEffect(() => {
    if (!filtros.ano || !filtros.cultura) return;
    (async () => {
      try {
        setLoading(true);
        setErro("");

        const o = await fetch(
          `${API_URL}/stats/overview?ano=${encodeURIComponent(filtros.ano)}${filtros.uf ? `&uf=${encodeURIComponent(filtros.uf)}` : ""}${filtros.cultura ? `&cultura=${encodeURIComponent(filtros.cultura)}` : ""}`
        );
        if (!o.ok) throw new Error("Falha ao carregar overview");
        const ov = await o.json();
        setOverview(ov);

        const c = await fetch(
          `${API_URL}/map/choropleth?ano=${encodeURIComponent(filtros.ano)}${filtros.uf ? `&uf=${encodeURIComponent(filtros.uf)}` : ""}&cultura=${encodeURIComponent(filtros.cultura)}&variavel=${encodeURIComponent(filtros.variavel)}`
        );
        if (!c.ok) throw new Error("Falha ao carregar choropleth");
        const ch = await c.json();
        setChoropleth(ch);

        if (filtros.uf) {
          const s = await fetch(
            `${API_URL}/timeseries?uf=${encodeURIComponent(filtros.uf)}&cultura=${encodeURIComponent(filtros.cultura)}&variavel=${encodeURIComponent(filtros.variavel)}`
          );
          if (!s.ok) throw new Error("Falha ao carregar séries");
          const se = await s.json();
          setSeries(se);

          if (autoTries.current < 3) {
            const allZeroTop = (ov?.top_municipios || []).every((x) => (Number(x?.valor) || 0) === 0);
            const allZeroSeries = (se?.data || []).every((p) => (Number(p?.valor) || 0) === 0);
            if (allZeroTop && allZeroSeries) {
              autoTries.current += 1;
              const nextVarIdx = Math.min(VAR_ORDER.length - 1, VAR_ORDER.indexOf(filtros.variavel) + 1);
              const nextVar = VAR_ORDER[nextVarIdx];
              if (nextVar && nextVar !== filtros.variavel) return setFiltros((f) => ({ ...f, variavel: nextVar }));
              const altCultura = (meta.culturas || []).find((c) => c !== filtros.cultura && c !== "Total");
              if (altCultura) return setFiltros((f) => ({ ...f, cultura: altCultura }));
              const anos = meta.anos || [];
              const idxAno = anos.findIndex((a) => String(a) === String(filtros.ano));
              if (idxAno >= 0 && idxAno < anos.length - 1) return setFiltros((f) => ({ ...f, ano: String(anos[idxAno + 1]) }));
            }
          }
        } else setSeries(null);
      } catch (e) {
        setErro(e?.message || "Erro ao buscar dados");
      } finally {
        setLoading(false);
      }
    })();
  }, [filtros.ano, filtros.cultura, filtros.uf, filtros.variavel, meta.anos, meta.culturas]);

  const barData = useMemo(() => {
    if (!overview?.top_municipios?.length) return null;
    return {
      labels: overview.top_municipios.map((x) => x?.nome ?? "—"),
      datasets: [
        {
          label: `Top municípios – ${filtros.variavel}`,
          data: overview.top_municipios.map((x) => Number(x?.valor) || 0),
          backgroundColor: "rgba(59,130,246,0.6)",
          borderColor: "rgba(59,130,246,1)",
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    };
  }, [overview, filtros.variavel]);

  const lineData = useMemo(() => {
    if (!series?.data?.length) return null;
    return {
      labels: series.data.map((p) => p?.ano ?? "—"),
      datasets: [
        {
          label: `Série (${filtros.uf || "UF"}) – ${filtros.variavel}`,
          data: series.data.map((p) => Number(p?.valor) || 0),
          tension: 0.3,
          borderColor: "#facc15",
          backgroundColor: "rgba(250,204,21,0.3)",
          pointRadius: 3,
          borderWidth: 2,
          fill: true,
        },
      ],
    };
  }, [series, filtros.uf, filtros.variavel]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: "#f1f5f9" } } },
    scales: {
      x: { ticks: { color: "#e2e8f0" }, grid: { color: "rgba(255,255,255,0.06)" } },
      y: { beginAtZero: true, ticks: { color: "#e2e8f0" }, grid: { color: "rgba(255,255,255,0.06)" } },
    },
  };

  const fmt = (n) => (n == null ? "–" : new Intl.NumberFormat("pt-BR").format(n));

  const wrap = {
    minHeight: "100%",
    display: "flex",
    justifyContent: "center",
    padding: 16,
  };
  const container = {
    width: "100%",
    maxWidth: 1280,
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    gridTemplateAreas: `"header header" "sidebar main"`,
    gap: 16,
    alignItems: "start",
    color: "#f1f5f9",
  };
  const header = { gridArea: "header" };
  const sidebar = { gridArea: "sidebar", position: "sticky", top: 16, display: "flex", flexDirection: "column", gap: 12 };
  const main = {
    gridArea: "main",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  };
  const card = { background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: 16 };
  const cardHeader = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 };
  const cardTitle = { fontSize: 14, margin: 0, opacity: .95 };
  const select = { padding: 10, borderRadius: 10, background: "#0f1a37", color: "#e6e9f0", border: "1px solid #2a3e7b", width: "100%" };
  const toolbar = { display: "grid", gridTemplateColumns: "1fr", gap: 8 };
  const table = { width: "100%", borderCollapse: "collapse" };
  const th = { borderBottom: "1px solid #334155", padding: "8px 6px", fontSize: 12, textAlign: "left", opacity: .85 };
  const td = { borderBottom: "1px solid #1b2c64", padding: "8px 6px", fontSize: 13 };
  const muted = { opacity: .75, fontSize: 13 };

  return (
    <div style={wrap}>
      <div style={container}>
        <header style={header}>
          <h1 style={{ margin: 0, fontSize: 22 }}>Dashboard do Agronegócio</h1>
          <small>React + Chart.js</small>
        </header>

        <aside style={sidebar}>
          <div style={card}>
            <div style={cardHeader}>
              <h2 style={cardTitle}>Filtros</h2>
            </div>
            <div style={toolbar}>
              <select style={select} value={filtros.cultura} onChange={(e) => setFiltros((f) => ({ ...f, cultura: e.target.value }))}>
                <option value="">Cultura</option>
                {meta.culturas?.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select style={select} value={filtros.ano} onChange={(e) => setFiltros((f) => ({ ...f, ano: e.target.value }))}>
                <option value="">Ano</option>
                {meta.anos?.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <select style={select} value={filtros.uf} onChange={(e) => setFiltros((f) => ({ ...f, uf: e.target.value }))}>
                <option value="">UF (opcional)</option>
                {meta.ufs?.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <select style={select} value={filtros.variavel} onChange={(e) => setFiltros((f) => ({ ...f, variavel: e.target.value }))}>
                <option value="valor_mil_reais">Valor (mil R$)</option>
                <option value="area_ha">Área (ha)</option>
                <option value="producao_t">Produção (t)</option>
              </select>
            </div>
          </div>
        </aside>

        <main style={main}>
          <section style={{ ...card, gridColumn: "1 / -1" }}>
            <div style={cardHeader}>
              <h2 style={cardTitle}>Visão geral</h2>
            </div>
            <p>Área (ha): {fmt(overview?.kpis?.area_ha)}</p>
            <p>Produção (t): {fmt(overview?.kpis?.producao_t)}</p>
            <p>Valor (mil R$): {fmt(overview?.kpis?.valor_mil_reais)}</p>
          </section>

          <section style={card}>
            <div style={cardHeader}>
              <h2 style={cardTitle}>Top municípios</h2>
              <span style={muted}>
                {filtros.cultura || "—"} • {filtros.uf || "UF"} • {filtros.variavel}
              </span>
            </div>
            <div style={{ height: 320 }}>
              {barData ? <Bar data={barData} options={chartOptions} /> : <p>Sem detalhamento…</p>}
            </div>
          </section>

          <section style={card}>
            <div style={cardHeader}>
              <h2 style={cardTitle}>Série temporal</h2>
              <span style={muted}>{filtros.uf || "UF"} • {filtros.variavel}</span>
            </div>
            <div style={{ height: 320 }}>
              {lineData ? <Line data={lineData} options={chartOptions} /> : <p>Nenhum ponto…</p>}
            </div>
          </section>

          <section style={{ ...card, gridColumn: "1 / -1" }}>
            <div style={cardHeader}>
              <h2 style={cardTitle}>Dados por município</h2>
              <span style={muted}>Mostrando até 50 linhas</span>
            </div>
            {!choropleth?.data?.length ? (
              <p>Sem dados…</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={th}>Município</th>
                      <th style={th}>UF</th>
                      <th style={th}>Área (ha)</th>
                      <th style={th}>Produção (t)</th>
                      <th style={th}>Valor (mil R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {choropleth.data.slice(0, 50).map((r, i) => (
                      <tr key={i}>
                        <td style={td}>{r.municipio}</td>
                        <td style={td}>{r.uf}</td>
                        <td style={td}>{fmt(r.area_ha)}</td>
                        <td style={td}>{fmt(r.producao_t)}</td>
                        <td style={td}>{fmt(r.valor_mil_reais)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
