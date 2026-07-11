import { NextResponse } from "next/server";
import { getLeadDashboardMetrics } from "@/modules/leads/dashboard-service";
import { apiError } from "@/app/api/_lib/handle-error";

export async function GET() {
  try {
    const metrics = await getLeadDashboardMetrics();
    return NextResponse.json({ metrics });
  } catch (error) {
    return apiError(error);
  }
}
