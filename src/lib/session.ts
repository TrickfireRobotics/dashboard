import { headers } from "next/headers";

import { auth } from "./auth";

export type SessionUser = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>["user"];

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}
