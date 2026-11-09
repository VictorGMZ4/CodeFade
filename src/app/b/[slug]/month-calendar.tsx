"use client";

import { cx } from "@/components/ui";

const WEEK_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

type CalendarProps = {
  month: string;
  openDays: string[];
  selected: string | null;
  onMonth: (m: string) => void;
  onSelect: (d: string) => void;
  label: (d: string) => string;
};

export function MonthCalendar({ month, openDays, selected, onMonth, onSelect, label }: CalendarProps) {
  const open = new Set(openDays);
  const months = [...new Set(openDays.map((d) => d.slice(0, 7)))].sort();
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7; // lunes primero
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div>
      <MonthNavigation first={first} months={months} month={month} onMonth={onMonth} />
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEK_LABELS.map((d) => (
          <span key={d} className="text-[13px] font-semibold text-muted py-1">
            {d}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const d = `${month}-${pad(i + 1)}`;
          return <CalendarDay key={d} day={d} number={i + 1} available={open.has(d)} selected={d === selected} onSelect={onSelect} label={label} />;
        })}
      </div>
    </div>
  );
}

function MonthNavigation({ first, months, month, onMonth }: {
  first: Date; months: string[]; month: string; onMonth: (month: string) => void;
}) {
  const index = months.indexOf(month);
  const title = new Intl.DateTimeFormat("es", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const style = "press size-10 rounded-full grid place-items-center text-accent-ink hover:bg-accent-soft disabled:opacity-30 disabled:pointer-events-none";
  return <div className="flex items-center justify-between mb-3">
    <p className="font-semibold first-letter:uppercase">{title}</p>
    <div className="flex gap-1">
      <button type="button" onClick={() => onMonth(months[index - 1])} disabled={index <= 0} aria-label="Mes anterior" className={style}>‹</button>
      <button type="button" onClick={() => onMonth(months[index + 1])} disabled={index >= months.length - 1} aria-label="Mes siguiente" className={style}>›</button>
    </div>
  </div>;
}

function CalendarDay({ day, number, available, selected, onSelect, label }: {
  day: string; number: number; available: boolean; selected: boolean; onSelect: (day: string) => void; label: (day: string) => string;
}) {
  if (!available) return <span className="aspect-square max-h-12 grid place-items-center text-[15px] text-muted/60 tabular-nums">{number}</span>;
  return <button type="button" onClick={() => onSelect(day)} aria-pressed={selected} aria-label={label(day)}
    className={cx("press aspect-square max-h-12 w-full mx-auto rounded-full grid place-items-center text-[16px] font-bold tabular-nums",
      selected ? "bg-brand text-brand-ink" : "bg-accent-soft text-accent-ink hover:bg-accent")}>
    {number}
  </button>;
}

export function SkeletonGrid({ count, cols = "grid-cols-7" }: { count: number; cols?: string }) {
  return (
    <div className={cx("grid gap-2", cols)} role="status" aria-label="Cargando">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-11 rounded-lg bg-raised animate-pulse" />
      ))}
    </div>
  );
}
