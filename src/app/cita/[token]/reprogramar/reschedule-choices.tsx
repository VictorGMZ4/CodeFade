"use client";

import { Img } from "@/components/photo";
import { cx } from "@/components/ui";

export type Barber = { id: string; name: string; photoUrl: string | null };
export const dayLabel = (day: string) => new Intl.DateTimeFormat("es-CO", {
  weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
}).format(new Date(`${day}T12:00:00Z`));
export const timeLabel = (iso: string, timezone: string) => new Intl.DateTimeFormat("es-CO", {
  hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone,
}).format(new Date(iso));

export function ProfessionalChoices({ barbers, currentBarberId, value, onChange }: {
  barbers: Barber[]; currentBarberId: string; value: string; onChange: (id: string) => void;
}) {
  const choices = [...barbers, { id: "", name: "El primero libre", photoUrl: null }];
  return <section>
    <h2 id="professional-title" className="font-display text-xl mb-4">Profesional</h2>
    <div role="radiogroup" aria-labelledby="professional-title" className="grid gap-2">
      {choices.map(b => <label key={b.id} className={cx(
        "press flex items-center gap-3 rounded-xl border px-4 py-3.5 cursor-pointer min-w-0 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-line",
        value === b.id ? "bg-brand border-brand text-brand-ink" : "bg-surface border-line hover:border-accent-line",
      )}>
        <input type="radio" name="barber" checked={value === b.id} onChange={() => onChange(b.id)} className="sr-only" />
        {b.photoUrl && <Img src={b.photoUrl} alt="" className="size-10 rounded-full object-cover" />}
        <span>{b.name}{b.id === currentBarberId ? " (actual)" : ""}</span>
      </label>)}
    </div>
  </section>;
}

export function TimeChoices({ slots, start, timezone, onSelect }: {
  slots: string[]; start: string | null; timezone: string; onSelect: (iso: string) => void;
}) {
  const hour = (iso: string) => Number(timeLabel(iso, timezone).slice(0, 2));
  const groups = [
    { label: "Mañana", items: slots.filter(s => hour(s) < 12) },
    { label: "Tarde", items: slots.filter(s => hour(s) >= 12 && hour(s) < 18) },
    { label: "Noche", items: slots.filter(s => hour(s) >= 18) },
  ].filter(g => g.items.length);
  return <div className="grid gap-4">
    {groups.map(group => <div key={group.label}>
      <p className="text-sm font-semibold text-muted mb-2">{group.label}</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {group.items.map(iso => <button key={iso} type="button" aria-pressed={start === iso} onClick={() => onSelect(iso)}
          className={cx("press h-12 rounded-lg border text-base font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-accent-line",
            start === iso ? "bg-brand border-brand text-brand-ink" : "border-line text-ink hover:border-accent-line hover:bg-accent-soft")}>
          {timeLabel(iso, timezone)}
        </button>)}
      </div>
    </div>)}
    {!slots.length && <p className="text-muted">No quedan horarios para este día. Elige otro.</p>}
  </div>;
}
