import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { queryOne } from "./db";

export type Role = "admin" | "gate_staff";
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

const COOKIE = "gu_session";
const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "insecure-dev-secret-change-me"
);

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ name: user.name, email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      id: String(payload.sub),
      name: String(payload.name),
      email: String(payload.email),
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

/** Read the current session from the cookie (server components / route handlers). */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE);
}

/** Authenticate by email + password against the users table. */
export async function authenticate(
  email: string,
  password: string
): Promise<SessionUser | null> {
  const u = await queryOne<{
    id: string;
    name: string;
    email: string;
    password: string;
    role: Role;
  }>("select id, name, email, password, role from users where email = $1", [
    email.toLowerCase().trim(),
  ]);
  if (!u) return null;
  const ok = await verifyPassword(password, u.password);
  if (!ok) return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

export const SESSION_COOKIE = COOKIE;
