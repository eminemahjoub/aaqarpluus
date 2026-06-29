export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, ok, created } from "@/lib/api-helpers";
import { handleError, unauthorized } from "@/lib/errors";
import { createExpense, listExpenses } from "@/lib/services/finance-service";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    const ds = await getDataSource();
    if (!user) throw unauthorized();
    const data = await listExpenses({ ds, user, reqUrl: req.url });
    return ok(data);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    const body = await req.json();
    const ds = await getDataSource();
    if (!user) throw unauthorized();
    const expense = await createExpense({ ds, user, body });
    return created(expense);
  } catch (err) {
    return handleError(err);
  }
}
