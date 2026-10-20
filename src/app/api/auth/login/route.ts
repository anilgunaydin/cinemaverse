import { z } from "zod";
import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { establishSession } from "@/lib/auth/current-user";
import { jsonError, jsonOk, parseJsonBody, rateLimit } from "@/lib/http";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin."),
  password: z.string().optional(),
});

export async function POST(request: Request) {
  const limit = rateLimit("login", 12, 60_000);
  if (!limit.allowed) {
    return jsonError("Çok fazla giriş denemesi. Lütfen bekleyin.", 429, {
      code: "rate_limited",
    });
  }

  const parsed = await parseJsonBody(request, loginSchema);
  if (!parsed.success) return parsed.response;

  const { email, password } = parsed.data;
  const db = getDb();

  const rows = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  const user = rows[0];

  // "anil@cinemaverse.local" kullanicisi icin sifre kontrolunu atla (sifresiz giris).
  const isAnil = email === "anil@cinemaverse.local";
  let valid = true;
  if (!isAnil) {
    const hash = user?.passwordHash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin";
    valid = await verifyPassword(password ?? "", hash);
  }

  if (!user || !valid) {
    return jsonError("E-posta veya şifre hatalı.", 401, {
      code: "invalid_credentials",
    });
  }

  await establishSession(user.id, user.sessionVersion);

  return jsonOk({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
  });
}
