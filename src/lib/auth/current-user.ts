import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  clearSessionCookie,
  createSessionToken,
  getSessionCookieValue,
  readSessionToken,
  setSessionCookie,
} from "@/lib/auth/session";

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  role: "user" | "moderator" | "admin";
  libraryVisibility: "private" | "followers" | "public";
  reviewsVisibility: "private" | "followers" | "public";
};

/**
 * Veri Erisim Katmani (DAL): oturum cerezini dogrular ve kullaniciyi
 * veritabanindan okur. Oturum surumu uyusmuyorsa oturum gecersizdir.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = await getSessionCookieValue();
  const session = await readSessionToken(token);
  if (!session) return null;

  const db = getDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  const user = rows[0];
  if (!user) return null;
  if (user.sessionVersion !== session.sessionVersion) return null;

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    libraryVisibility: user.libraryVisibility,
    reviewsVisibility: user.reviewsVisibility,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Bu islem icin giris yapmaniz gerekiyor.");
    this.name = "UnauthorizedError";
  }
}

/** Giris sonrasi oturum cerezini yazar. */
export async function establishSession(
  userId: string,
  sessionVersion: number,
): Promise<void> {
  const token = await createSessionToken({ userId, sessionVersion });
  await setSessionCookie(token);
}

export async function destroySession(): Promise<void> {
  await clearSessionCookie();
}
