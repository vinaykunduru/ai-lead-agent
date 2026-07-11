import { NextResponse } from "next/server";
import { WIDGET_SDK_SOURCE } from "@/modules/widget/sdk-source";

/**
 * Public, static, cacheable — the same script for every widget on every
 * organization; per-widget behavior comes entirely from the public config
 * this script fetches at runtime (?key=...), never from anything baked
 * into this response.
 */
export async function GET() {
  return new NextResponse(WIDGET_SDK_SOURCE, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
