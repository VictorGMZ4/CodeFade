import { cx } from "@/components/ui";

// Placeholders que se muestran mientras llega el contenido dinámico (Suspense).

export function Bar({ className }: { className?: string }) {
  return <div className={cx("rounded-lg bg-raised animate-pulse", className)} />;
}

export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando">
      <Bar className="h-8 w-48 mb-2" />
      <Bar className="h-4 w-64 mb-6" />
      <div className="grid gap-2">
        {Array.from({ length: rows }, (_, i) => (
          <Bar key={i} className="h-[72px] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
