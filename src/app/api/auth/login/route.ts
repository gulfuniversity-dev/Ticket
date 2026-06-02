import { NextRequest, NextResponse } from "next/server";
import { authenticate, signSession, setSessionCookie } from "@/lib/auth";
import { handle } from "@/lib/guard";

export const runtime = "nodejs";

export const POST = handle(async (req: NextRequest) => {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  const user = await authenticate(String(email), String(password));
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  const token = await signSession(user);
  await setSessionCookie(token);
  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});
