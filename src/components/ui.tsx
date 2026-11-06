import type { ComponentProps, ReactNode } from "react";

// Piezas de interfaz compartidas. En Tailwind v4 `hover:` ya solo aplica en
// dispositivos con puntero que puede hacer hover, así que no se queda pegado al tocar.
// Radios: 8px en botones e inputs, 16px en tarjetas, 24px en paneles grandes.

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const buttonStyles = {
  // Acción principal: azul sólido con texto blanco
  primary: "bg-brand text-brand-ink hover:shadow-soft hover:brightness-110",
  secondary: "bg-surface text-ink border border-line hover:border-accent-line",
  ghost: "text-ink hover:bg-raised",
  danger: "bg-danger-soft text-danger hover:brightness-[0.98]",
};

export function buttonClass(variant: keyof typeof buttonStyles = "primary", extra?: string) {
  return cx(
    "press inline-flex items-center justify-center gap-2 rounded-lg px-5 h-12 text-[16px] font-semibold",
    "disabled:opacity-50 disabled:pointer-events-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-line",
    buttonStyles[variant],
    extra,
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof buttonStyles }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export const inputClass = cx(
  "w-full h-12 rounded-lg border border-line bg-surface px-3.5 text-ink placeholder:text-muted/70",
  "focus:outline-none focus:border-accent-line focus:ring-4 focus:ring-accent/60",
  "aria-[invalid=true]:border-danger",
);

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | string[];
  children: ReactNode;
}) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <label className="grid gap-1.5">
      <span className="text-[15px] font-semibold">{label}</span>
      {children}
      {message ? (
        <span className="text-[14px] text-danger">{message}</span>
      ) : hint ? (
        <span className="text-[14px] text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("bg-surface rounded-2xl border border-line shadow-soft", className)} {...props} />;
}

export function PageTitle({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="font-display text-[30px] sm:text-[34px]">{title}</h1>
        {description && <p className="text-muted mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "ok" | "error"; children: ReactNode }) {
  const styles = {
    info: "bg-accent-soft text-ink",
    ok: "bg-ok-soft text-ok",
    error: "bg-danger-soft text-danger",
  };
  return (
    <p role={tone === "error" ? "alert" : "status"} className={cx("rounded-lg px-3.5 py-2.5 text-[15px]", styles[tone])}>
      {children}
    </p>
  );
}

/** Etiqueta en forma de píldora (estado, aviso corto). */
export function Badge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cx("inline-flex items-center rounded-full bg-accent-soft text-accent-ink px-2.5 py-0.5 text-[13px] font-semibold", className)}
      {...props}
    />
  );
}
