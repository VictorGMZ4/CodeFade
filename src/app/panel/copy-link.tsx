"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  // APP_URL puede no estar definido: completamos con el origen actual.
  const full = url.startsWith("/") && typeof window !== "undefined" ? window.location.origin + url : url;

  const copy = async () => {
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ url: full }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch gap-2 max-w-md mx-auto">
      <code className="flex-1 min-w-0 truncate bg-paper border border-line px-3 py-2.5 text-sm text-left select-all">
        {full}
      </code>
      <Button type="button" variant="secondary" onClick={copy}>
        {copied ? "¡Copiado!" : "Compartir enlace"}
      </Button>
    </div>
  );
}
