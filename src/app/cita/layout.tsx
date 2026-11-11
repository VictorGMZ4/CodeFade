import type { ReactNode } from "react";
import { BrandShell } from "../_brand/brand-shell";

export default function Layout({ children }: { children: ReactNode }) {
  return <BrandShell>{children}</BrandShell>;
}
