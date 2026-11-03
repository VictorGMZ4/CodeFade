import type { ComponentProps, ReactNode } from "react";

// Piezas de interfaz compartidas. En Tailwind v4 `hover:` ya solo aplica en
// dispositivos con puntero que puede hacer hover, así que no se queda pegado al tocar.
// Esquinas rectas en toda la app, como un rótulo pintado.

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const buttonStyles = {
  primary: "bg-accent text-accent-ink hover:opacity-90",
  secondary: "bg-raised text-ink hover:bg-line",
  ghost: "text-ink hover:bg-surface",
  danger: "bg-danger-soft text-danger hover:opacity-90",
};

export function buttonClass(variant: keyof typeof buttonStyles = "primary", extra?: string) {
  return cx(
    "press inline-flex items-center justify-center gap-2 px-5 h-12 text-[17px] font-medium",
    "disabled:opacity-50 disabled:pointer-events-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
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
  "w-full h-12 border border-line bg-paper px-3.5 text-ink placeholder:text-muted/70",
  "focus:outline-none focus:border-ink focus:ring-2 focus:ring-ink/15",
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
      <span className="text-[15px] font-medium">{label}</span>
      {children}
      {message ? (
        <span className="text-[15px] text-danger">{message}</span>
      ) : hint ? (
        <span className="text-[15px] text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("bg-surface", className)} {...props} />;
}

export function PageTitle({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="font-display text-[34px]">{title}</h1>
        {description && <p className="text-muted mt-2">{description}</p>}
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
    <p role={tone === "error" ? "alert" : "status"} className={cx("px-3.5 py-2.5 text-[15px]", styles[tone])}>
      {children}
    </p>
  );
}
