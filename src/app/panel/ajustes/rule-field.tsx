"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/ui";

type Unit = { label: string; factor: number };

/**
 * Selector de una regla de reserva: valores rápidos y, con "Personalizado",
 * un número libre con su unidad. Envía siempre el valor en la unidad base
 * (minutos, días u horas) en un campo oculto con el nombre de la regla.
 */
export function RuleField({
  label,
  name,
  value,
  onChange,
  presets,
  units,
  limits,
  error,
}: {
  label: string;
  name: string;
  /** Valor actual en la unidad base, como texto */
  value: string;
  onChange: (value: string) => void;
  presets: { value: number; label: string }[];
  /** Unidades para el valor personalizado; la primera es la base (factor 1) */
  units: Unit[];
  limits: string;
  error?: string | string[];
}) {
  const isPreset = presets.some((p) => String(p.value) === value);
  const [custom, setCustom] = useState(!isPreset);
  // Mostramos el valor personalizado en la unidad más grande que lo divide exacto.
  const [unit, setUnit] = useState(() => {
    const n = Number(value);
    return [...units].reverse().find((u) => n > 0 && n % u.factor === 0) ?? units[0];
  });
  const [amount, setAmount] = useState(() => String(Number(value) / unit.factor));

  const updateCustom = (nextAmount: string, nextUnit: Unit) => {
    setAmount(nextAmount);
    setUnit(nextUnit);
    const n = Number(nextAmount);
    onChange(nextAmount.trim() === "" || Number.isNaN(n) ? "" : String(Math.round(n * nextUnit.factor)));
  };

  return (
    <Field label={label} hint={custom ? limits : undefined} error={error}>
      <input type="hidden" name={name} value={value} />
      <select
        value={custom ? "custom" : value}
        onChange={(ev) => {
          if (ev.target.value === "custom") {
            setCustom(true);
            updateCustom(amount, unit);
          } else {
            setCustom(false);
            onChange(ev.target.value);
          }
        }}
        className={inputClass}
        aria-label={label}
      >
        {presets.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
        <option value="custom">Personalizado…</option>
      </select>
      {custom && (
        <span className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={amount}
            onChange={(ev) => updateCustom(ev.target.value, unit)}
            className={`${inputClass} flex-1 min-w-0`}
            aria-label={`${label}: cantidad`}
          />
          {units.length > 1 ? (
            <select
              value={unit.label}
              onChange={(ev) => updateCustom(amount, units.find((u) => u.label === ev.target.value) ?? units[0])}
              className={`${inputClass} w-auto`}
              aria-label={`${label}: unidad`}
            >
              {units.map((u) => (
                <option key={u.label} value={u.label}>
                  {u.label}
                </option>
              ))}
            </select>
          ) : (
            <span className="self-center text-muted">{units[0].label}</span>
          )}
        </span>
      )}
    </Field>
  );
}
