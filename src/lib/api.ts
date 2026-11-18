import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Uniform wrapper for API handlers: readable JSON errors, never an exposed stack trace. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ZodError) return NextResponse.json({ error: "Invalid request", details: e.flatten() }, { status: 400 });
      const status = (e as { status?: number }).status ?? 500;
      console.error("[api]", e);
      return NextResponse.json({ error: (e as Error).message || "Internal error" }, { status: status >= 400 && status < 600 ? status : 500 });
    }
  };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
