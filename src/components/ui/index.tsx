"use client";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export function Panel({ title, actions, children, className, bodyClassName, subtitle }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn("flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-line bg-panel", className)}>
      {(title || actions) && (
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-1.5">
          <div className="flex min-w-0 items-baseline gap-2">
            <h2 className="truncate text-[11px] font-semibold uppercase tracking-wider text-accent">{title}</h2>
            {subtitle && <span className="truncate text-[11px] text-dim">{subtitle}</span>}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
        </header>
      )}
      <div className={cn("min-h-0 flex-1 overflow-auto", bodyClassName)}>{children}</div>
    </section>
  );
}

type Variant = "default" | "ghost" | "accent" | "danger";
export function Button({ variant = "default", size = "sm", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "xs" | "sm" }) {
  return (
    <button
      {...p}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "xs" ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-xs",
        variant === "default" && "border-line-2 bg-panel-2 text-fg hover:border-dim",
        variant === "ghost" && "border-transparent text-muted hover:bg-panel-2 hover:text-fg",
        variant === "accent" && "border-accent/60 bg-accent/15 text-accent hover:bg-accent/25",
        variant === "danger" && "border-down/50 bg-down/10 text-down hover:bg-down/20",
        className,
      )}
    />
  );
}

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cn("h-7 rounded border border-line-2 bg-bg px-2 text-xs text-fg outline-none placeholder:text-dim focus:border-accent/70", className)} />;
}

export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cn("h-7 rounded border border-line-2 bg-bg px-1.5 text-xs text-fg outline-none focus:border-accent/70", className)}>{children}</select>;
}

export function Badge({ className, tone = "default", ...p }: HTMLAttributes<HTMLSpanElement> & { tone?: "default" | "up" | "down" | "accent" | "info" | "muted" }) {
  return (
    <span
      {...p}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-px text-[10px] font-medium uppercase tracking-wide",
        tone === "default" && "bg-panel-2 text-muted ring-1 ring-line-2",
        tone === "up" && "bg-up/10 text-up ring-1 ring-up/30",
        tone === "down" && "bg-down/10 text-down ring-1 ring-down/30",
        tone === "accent" && "bg-accent/10 text-accent ring-1 ring-accent/30",
        tone === "info" && "bg-info/10 text-info ring-1 ring-info/30",
        tone === "muted" && "text-dim",
        className,
      )}
    />
  );
}

export function Chip({ active, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...p}
      className={cn("h-6 rounded-full border px-2.5 text-[11px] transition-colors", active ? "border-accent/70 bg-accent/15 text-accent" : "border-line-2 text-muted hover:text-fg", className)}
    />
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-20 items-center justify-center px-4 py-6 text-center text-xs text-dim">{children}</div>;
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn("inline-block h-3 w-3 animate-spin rounded-full border-2 border-dim border-t-accent", className)} />;
}
