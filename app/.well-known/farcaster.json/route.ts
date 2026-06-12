import { NextResponse } from "next/server";
import { baseUrl, buildManifest, accountAssociationFromEnv } from "@/lib/miniapp";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(buildManifest(baseUrl(), accountAssociationFromEnv()));
}
