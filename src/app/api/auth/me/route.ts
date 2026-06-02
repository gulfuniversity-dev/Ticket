import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { handle } from "@/lib/guard";

export const runtime = "nodejs";

export const GET = handle(async () => {
  const user = await getSession();
  if (!user) return NextResponse.json({ user: null }, { status: 200 });
  return NextResponse.json({ user });
});
