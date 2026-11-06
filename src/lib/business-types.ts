import type { BusinessType } from "@/generated/prisma/client";

export const BUSINESS_TYPES = [
  { value: "BARBERIA", label: "Barbería" },
  { value: "PELUQUERIA", label: "Peluquería" },
  { value: "UNAS", label: "Uñas" },
  { value: "ESTETICA", label: "Estética" },
  { value: "SPA", label: "Spa" },
  { value: "OTRO", label: "Otro" },
] as const satisfies readonly { value: BusinessType; label: string }[];

export function businessTypeLabel(value: BusinessType): string {
  return BUSINESS_TYPES.find((type) => type.value === value)!.label;
}
