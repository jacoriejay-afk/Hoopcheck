import { NextRequest } from "next/server";
import { ambassadorDb, requireAmbassadorSession } from "../../../../lib/ambassador/server";

const columns = [
  "ambassador_id", "attribution_id", "subscription_plan", "paid_invoice_at", "currency", "gross_minor",
  "discount_minor", "tax_minor", "fee_minor", "net_minor", "adjustment_minor", "commission_rate_bps",
  "commission_minor", "status",
] as const;

function csvCell(value: string | number | null) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  await requireAmbassadorSession("/admin/ambassadors", true);
  const month = request.nextUrl.searchParams.get("month") ?? "";
  if (!/^20\d\d-(?:0[1-9]|1[0-2])$/.test(month)) return new Response("Invalid report month", { status: 400 });
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const db = ambassadorDb();
  const rows: string[] = [[...columns, "current_commission_minor"].join(",")];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db.from("ambassador_commissions").select(columns.join(",") as typeof columns[number])
      .gte("paid_invoice_at", start.toISOString()).lt("paid_invoice_at", end.toISOString())
      .order("paid_invoice_at").order("id").range(offset, offset + pageSize - 1);
    if (error) return new Response("Commission report unavailable", { status: 503 });
    for (const row of data as unknown as Array<Record<typeof columns[number], string | number | null>>) {
      const current = row.status === "reversed" ? 0
        : Math.round((Number(row.net_minor) - Number(row.adjustment_minor)) * Number(row.commission_rate_bps) / 10000);
      rows.push([...columns.map(column => csvCell(row[column])), csvCell(current)].join(","));
    }
    if (data.length < pageSize) break;
  }
  return new Response(rows.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hoopcheck-ambassadors-${month}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
