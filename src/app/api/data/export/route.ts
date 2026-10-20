import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { jsonError } from "@/lib/http";
import { exportLibraryCsv, exportUserData } from "@/lib/data/service";

export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonError(error.message, 401, { code: "unauthorized" });
    }
    throw error;
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "json";
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const csv = await exportLibraryCsv(user.id);
    return new Response(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cinemaverse-kutuphane-${stamp}.csv"`,
      },
    });
  }

  const payload = await exportUserData(user.id);
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="cinemaverse-yedek-${stamp}.json"`,
    },
  });
}
