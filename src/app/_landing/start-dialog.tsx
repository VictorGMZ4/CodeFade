"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";

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
      className="bg-paper text-ink p-6 sm:p-7 w-full max-w-[440px]"
    >
      <p className="font-display text-[26px]">Nombra tu barbería</p>
      <p className="text-[15px] text-muted mt-1 mb-5">Así la verán tus clientes al reservar.</p>
      <label className="grid gap-1.5">
        <span className="text-[15px] font-medium">Nombre</span>
        <input
          name="barberia"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          autoComplete="organization"
          className={inputClass}
        />
      </label>
      <p className="text-[15px] text-muted mt-2 truncate">
        Tu enlace: {host}/b/
        {name
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "tu-barberia"}
      </p>
      <button type="submit" className={buttonClass("primary", "w-full mt-5 h-[52px]")}>
        Crear mi barbería
      </button>
    </form>
  );
}
