import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorization";

export async function GET() {
  const { response: denied } = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ isAdmin: true });
}
