import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "session";
const MAX_AGE_DAYS = 30;

type SessionPayload = { userId: string; version: number };

// Valores de ejemplo publicados en .env.example o en la documentación: nunca válidos.
const EXAMPLE_SECRETS = ["genera-uno-con: openssl rand -base64 32", "cambia-esto"];

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32 || EXAMPLE_SECRETS.includes(secret)) {
    throw new Error("SESSION_SECRET debe ser un valor aleatorio de al menos 32 caracteres");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(userId: string, version: number) {
  const expires = new Date(Date.now() + MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  const token = await new SignJWT({ userId, version } satisfies SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(key());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.userId !== "string") return null;
    // Las sesiones anteriores a la versión no la llevan: equivalen a la 0.
    return { userId: payload.userId, version: typeof payload.version === "number" ? payload.version : 0 };
  } catch {
    return null;
  }
}

export async function deleteSession() {
  (await cookies()).delete(COOKIE);
}
