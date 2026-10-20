import { z } from "zod";
import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { establishSession } from "@/lib/auth/current-user";
import { jsonError, jsonOk, newId, parseJsonBody, rateLimit } from "@/lib/http";

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin."),
  password: z
    .string()
    .min(8, "Şifre en az 8 karakter olmalı.")
    .max(200, "Şifre çok uzun."),
  displayName: z
    .string()
    .trim()
    .min(2, "Görünen ad en az 2 karakter olmalı.")
    .max(60, "Görünen ad en fazla 60 karakter olabilir."),
});

export async function POST(request: Request) {
  const limit = rateLimit("register", 8, 60_000);
  if (!limit.allowed) {
    return jsonError("Çok fazla deneme. Lütfen bekleyin.", 429, {
      code: "rate_limited",
    });
  }

  const parsed = await parseJsonBody(request, registerSchema);
  if (!parsed.success) return parsed.response;

  const { email, password, displayName } = parsed.data;
  const db = getDb();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  if (existing.length > 0) {
    return jsonError("Bu e-posta ile bir hesap zaten var.", 409, {
      code: "email_taken",
    });
  }

  const id = newId("usr");
  const passwordHash = await hashPassword(password);

  await db.insert(users).values({
    id,
    email,
    passwordHash,
    displayName,
  });

  await establishSession(id, 1);

  return jsonOk({ user: { id, email, displayName } }, 201);
}
