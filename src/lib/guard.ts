import "server-only";
import { NextResponse } from "next/server";
import { getSession, type Role, type SessionUser } from "./auth";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Throws HttpError if the caller is not authenticated / not authorized. */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new HttpError(401, "Unauthorized");
  if (roles && !roles.includes(user.role)) throw new HttpError(403, "Forbidden");
  return user;
}

export const requireAdmin = () => requireUser(["admin"]);
export const requireStaff = () => requireUser(["admin", "gate_staff"]);

/** Wrap a route handler with consistent error handling. */
export function handle<T extends any[]>(
  fn: (...args: T) => Promise<Response>
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      console.error("API error:", e);
      const msg = e instanceof Error ? e.message : "Internal error";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  };
}
