"use client";

import { useId, useState } from "react";
import { Button, Card } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import "./metrics.css";

export type ChartRow = { label: string; shortLabel?: string; values: number[]; detail?: string };
type Series = { label: string; color: 1 | 2 | 3 };
type Props = { title: string; rows: ChartRow[]; series: Series[]; horizontal?: boolean; empty?: boolean; currency?: string };

// Solo se redondea el extremo de datos; la base permanece recta.
function barPath(x: number, y: number, w: number, h: number, horizontal: boolean) {
  const r = Math.min(4, w / 2, h / 2);
  return horizontal
    ? `M${x},${y} H${x+w-r} Q${x+w},${y} ${x+w},${y+r} V${y+h-r} Q${x+w},${y+h} ${x+w-r},${y+h} H${x}Z`
    : `M${x},${y+h} V${y+r} Q${x},${y} ${x+r},${y} H${x+w-r} Q${x+w},${y} ${x+w},${y+r} V${y+h}Z`;
}
// Escala con pasos redondos (1, 2, 5, 10…) y como mucho 4 tramos: con un
// máximo de 5 citas el eje queda en 0 / 2 / 4 / 6 en lugar de 0 / 3 / 5.
export function niceScale(max: number) {
  const target = Math.max(1, max) / 4;
  const power = 10 ** Math.floor(Math.log10(target));
  // Se cuentan citas: nunca pasos menores que 1.
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * power).find((s) => s >= target) ?? 10 * power);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks: number[] = [];
  for (let t = 0; t <= top; t += step) ticks.push(t);
  return { top, ticks };
}

export function MetricsChart({ title, rows, series, horizontal = false, empty = false, currency }: Props) {
  const id = useId();
  const [table, setTable] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const exact = (n: number) => currency ? formatPrice(n, currency) : String(n);
  const describe = (row: ChartRow) => `${row.label}: ${row.values.map((v, i) => `${series[i].label}: ${exact(v)}`).join("; ")}${row.detail ? `. ${row.detail}` : ""}`;
  const total = Math.max(1, ...rows.map(row => row.values.reduce((a, b) => a + b, 0)));
  const scale = niceScale(total);
  // Las columnas se escalan al tope del eje para coincidir con sus marcas.
  const max = horizontal ? total : scale.top;
  const width = horizontal ? 320 : Math.max(320, rows.length * 48 + 48);
  const height = horizontal ? Math.max(120, rows.length * 84 + 24) : 238;
  const plot = width - 48;
  const summary = empty ? "Sin citas en este periodo." : `${rows.length} ${horizontal ? "elementos" : "intervalos"}. ${series.map((s, i) => `${s.label}: ${exact(rows.reduce((sum, row) => sum + row.values[i], 0))}`).join(". ")}. Consulta la tabla para ver cada valor.`;
  return <Card className="viz-root min-w-0 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
      <h2 id={`${id}-title`} className="font-display text-lg">{title}</h2>
      <Button variant="ghost" className="px-2! text-sm!" aria-expanded={table} aria-controls={`${id}-table`} onClick={() => setTable(!table)}>{table ? "Ocultar tabla" : "Ver como tabla"}</Button>
    </div>
    {series.length >= 2 && <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted mb-3">{series.map(s => <li key={s.label} className="flex items-center gap-2"><span aria-hidden="true" className="size-3 rounded-sm" style={{ background: `var(--series-${s.color})` }} />{s.label}</li>)}</ul>}
    {empty ? <p className="py-10 text-center text-muted">Sin citas en este periodo.</p> : <>
      {!horizontal && width > 320 && <p className="text-sm text-muted mb-2">Desliza para ver todos los intervalos.</p>}
      <div role="region" className="overflow-x-auto" tabIndex={width > 320 ? 0 : undefined} aria-label={width > 320 ? "Gráfico desplazable" : "Gráfico"}>
        <svg role="group" aria-labelledby={`${id}-title ${id}-desc`} viewBox={`0 0 ${width} ${height}`} width="100%" style={{ minWidth: width > 320 ? width : undefined, maxWidth: width, display: "block", margin: "auto" }}>
          <desc id={`${id}-desc`}>{summary}</desc>
          {!horizontal && scale.ticks.map(t => <g key={t}><line x1="36" x2={width - 6} y1={194 - t / max * 160} y2={194 - t / max * 160} stroke="var(--line)" strokeWidth="1" /><text x="30" y={198 - t / max * 160} textAnchor="end" className="viz-label">{t}</text></g>)}
          {rows.map((row, index) => {
            const cell = plot / rows.length;
            const x = horizontal ? 0 : 42 + index * cell + (cell - 24) / 2;
            let accumulated = 0;
            return <g key={`${row.label}-${index}`}>
              {horizontal && <><text x="0" y={index * 84 + 15} className="viz-label">{row.label.length > 27 ? row.label.slice(0, 26) + "…" : row.label}</text><text x="318" y={index * 84 + 15} textAnchor="end" className="viz-label">{exact(row.values[0])}</text><line x1="0" x2="0" y1={index * 84 + 24} y2={index * 84 + 48} stroke="var(--line)" strokeWidth="1" /></>}
              {row.values.map((value, s) => {
                const extent = value / max * (horizontal ? 316 : 160);
                const y = horizontal ? index * 84 + 24 : 194 - accumulated - extent;
                accumulated += extent;
                return value > 0 && <path key={s} d={barPath(x, y, horizontal ? extent : 24, horizontal ? 24 : Math.max(0, extent - (s > 0 ? 2 : 0)), horizontal)} fill={`var(--series-${series[s].color})`} />;
              })}
              {horizontal ? row.detail && <text x="0" y={index * 84 + 67} className="viz-label">{row.detail}</text> : <text x={x + 12} y="217" textAnchor="middle" className="viz-label">{row.shortLabel ?? row.label}</text>}
              <rect x={horizontal ? 0 : 42 + index * cell} y={horizontal ? index * 84 : 24} width={horizontal ? 320 : cell} height={horizontal ? 80 : 206} fill="transparent" tabIndex={0} role="button" aria-label={describe(row)} aria-pressed={selected === index} onPointerEnter={e => { if (e.pointerType !== "touch") setSelected(index); }} onPointerLeave={e => { if (e.pointerType !== "touch") setSelected(null); }} onFocus={() => setSelected(index)} onBlur={() => setSelected(null)} onClick={() => setSelected(selected === index ? null : index)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(selected === index ? null : index); } if (e.key === "Escape") setSelected(null); }} className="viz-target" />
            </g>;
          })}
        </svg>
      </div>
      <p role="status" className="min-h-12 mt-2 text-sm text-ink rounded-lg bg-raised p-2">{selected !== null && rows[selected] ? describe(rows[selected]) : "Toca una barra o enfócala con el teclado para ver su valor exacto."}</p>
    </>}
    <div id={`${id}-table`} hidden={!table} className="overflow-x-auto mt-4">
      <table className="w-full text-sm text-ink text-left"><caption className="text-muted text-left mb-2">{title}</caption><thead><tr className="border-b border-line"><th scope="col" className="p-2">{horizontal ? "Nombre" : "Intervalo"}</th>{series.map(s => <th key={s.label} scope="col" className="p-2">{s.label}</th>)}{rows.some(r => r.detail) && <th scope="col" className="p-2">Ingresos realizados</th>}</tr></thead><tbody>{rows.map((r, i) => <tr key={i} className="border-b border-line"><th scope="row" className="p-2 font-medium">{r.label}</th>{r.values.map((v, j) => <td className="p-2 tabular-nums" key={j}>{exact(v)}</td>)}{r.detail && <td className="p-2">{r.detail}</td>}</tr>)}</tbody></table>
    </div>
  </Card>;
}
