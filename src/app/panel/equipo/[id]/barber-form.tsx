"use client";

import { useActionState, useState } from "react";
import { updateBarber } from "@/app/actions/panel";
import { Button, Field, Notice, inputClass } from "@/components/ui";
import { WEEKDAYS, minutesToHHMM } from "@/lib/time";

type Range = { start: string; end: string };
type Props = {
  isOwner: boolean;
  barber: { phone: string | null; id: string; name: string; active: boolean; hours: { weekday: number; startMin: number; endMin: number }[] };
};

const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function BarberForm({ barber, isOwner }: Props) {
  const [state, action, pending] = useActionState(updateBarber, undefined);
  const [week, setWeek] = useState(() =>
    Object.fromEntries(
      ORDER.map((d) => {
        const ranges = barber.hours
          .filter((h) => h.weekday === d)
          .map((h) => ({ start: minutesToHHMM(h.startMin), end: minutesToHHMM(h.endMin) }));
        return [d, { on: ranges.length > 0, ranges: ranges.length ? ranges : [{ start: "09:00", end: "18:00" }] }];
      }),
    ) as Record<number, { on: boolean; ranges: Range[] }>,
  );

  const update = (d: number, fn: (day: { on: boolean; ranges: Range[] }) => { on: boolean; ranges: Range[] }) =>
    setWeek((w) => ({ ...w, [d]: fn(w[d]) }));

  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="id" value={barber.id} />
      {state?.error && <Notice tone="error">{state.error}</Notice>}

      {isOwner && <><div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Nombre" error={state?.errors?.name}>
          <input name="name" defaultValue={barber.name} required className={inputClass} />
        </Field>
        <label className="flex items-center gap-2 h-11 text-sm">
          <input type="checkbox" name="active" defaultChecked={barber.active} className="size-5 accent-[var(--accent-ink)]" />
          Acepta reservas
        </label>
      </div>
      <Field label="WhatsApp (opcional)" error={state?.errors?.phone}>
        <input name="phone" type="tel" autoComplete="tel" defaultValue={barber.phone ?? ""} className={inputClass} aria-invalid={!!state?.errors?.phone} />
      </Field></>}

      <fieldset className="grid gap-1">
        <legend className="text-sm font-medium mb-2">Horario semanal</legend>
        {ORDER.map((d) => {
          const day = week[d];
          return (
            <div key={d} className="grid grid-cols-[92px_1fr] gap-3 py-2 border-t border-line first-of-type:border-t-0">
              <label className="flex items-center gap-2 h-10 text-sm">
                <input
                  type="checkbox"
                  name={`on-${d}`}
                  checked={day.on}
                  onChange={(e) => update(d, (x) => ({ ...x, on: e.target.checked }))}
                  className="size-5 accent-[var(--accent-ink)]"
                />
                {WEEKDAYS[d].slice(0, 3)}
              </label>
              {day.on ? (
                <div className="grid gap-2">
                  {day.ranges.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="time"
                        name={`start-${d}`}
                        value={r.start}
                        step={300}
                        onChange={(e) =>
                          update(d, (x) => ({ ...x, ranges: x.ranges.map((y, j) => (j === i ? { ...y, start: e.target.value } : y)) }))
                        }
                        className={`${inputClass} h-10 px-2 w-auto min-w-0 flex-1`}
                        aria-label={`${WEEKDAYS[d]} inicio`}
                      />
                      <span className="text-muted">–</span>
                      <input
                        type="time"
                        name={`end-${d}`}
                        value={r.end}
                        step={300}
                        onChange={(e) =>
                          update(d, (x) => ({ ...x, ranges: x.ranges.map((y, j) => (j === i ? { ...y, end: e.target.value } : y)) }))
                        }
                        className={`${inputClass} h-10 px-2 w-auto min-w-0 flex-1`}
                        aria-label={`${WEEKDAYS[d]} fin`}
                      />
                      {day.ranges.length > 1 && (
                        <button
                          type="button"
                          onClick={() => update(d, (x) => ({ ...x, ranges: x.ranges.filter((_, j) => j !== i) }))}
                          className="press size-10 shrink-0 text-muted hover:text-danger"
                          aria-label="Quitar franja"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  {day.ranges.length < 3 && (
                    <button
                      type="button"
                      onClick={() =>
                        update(d, (x) => ({ ...x, ranges: [...x.ranges, { start: x.ranges.at(-1)?.end ?? "14:00", end: "19:00" }] }))
                      }
                      className="press justify-self-start text-sm text-accent-ink"
                    >
                      + Añadir franja (p. ej. tras el almuerzo)
                    </button>
                  )}
                </div>
              ) : (
                <p className="h-10 flex items-center text-sm text-muted">Descansa</p>
              )}
            </div>
          );
        })}
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        {state?.ok && !pending && <span className="text-sm text-ok">Guardado</span>}
      </div>
    </form>
  );
}
