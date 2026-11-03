import { cx } from "@/components/ui";

/**
 * La franja del poste de barbero: barras alternas de tinta y papel, hechas con
 * bloques sólidos. Se recorta al ancho de su contenedor.
 */
export function Stripe({ className, bars = 48 }: { className?: string; bars?: number }) {
  return (
    <div aria-hidden className={cx("flex w-full min-w-0 overflow-hidden h-12", className)}>
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className={cx("w-7 shrink-0", i % 2 === 0 ? "bg-current" : "bg-transparent")} />
      ))}
    </div>
  );
}
