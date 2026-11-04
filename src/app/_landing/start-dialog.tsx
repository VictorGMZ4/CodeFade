"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { slugify } from "@/lib/format";

/** El primer paso del alta, ya abierto: el nombre escrito pasa al registro. */
export function StartDialog({ host }: { host: string }) {
  const router = useRouter();
  const [name, setName] = useState("Barbería La Esquina");

  return (
    <form
      data-ui
      action="/registro"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/registro?barberia=${encodeURIComponent(name.trim())}`);
      }}
      className="bg-surface text-ink rounded-2xl shadow-card p-6 sm:p-7 w-full max-w-[440px]"
    >
      <p className="font-bold text-[22px]">Nombra tu barbería</p>
      <p className="text-[15px] text-muted mt-1 mb-5">Así la verán tus clientes al reservar.</p>
      <label className="grid gap-1.5">
        <span className="text-[15px] font-semibold">Nombre</span>
        <input
          name="barberia"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          autoComplete="organization"
          className={inputClass}
        />
      </label>
      <p className="text-[14px] text-muted mt-2 truncate">
        Tu enlace: {host}/b/{slugify(name) || "tu-barberia"}
      </p>
      <button type="submit" className={buttonClass("primary", "w-full mt-5 h-[52px]")}>
        Crear mi barbería
      </button>
    </form>
  );
}
