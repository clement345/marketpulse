import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtNum(v: number | null | undefined, decimals = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtSigned(v: number | null | undefined, decimals = 2, suffix = ""): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const s = fmtNum(Math.abs(v), decimals);
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${s}${suffix}`;
}
