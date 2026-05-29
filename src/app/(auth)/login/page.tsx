import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/LoginForm";
import { auth } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ deactivated?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user && session.user.isActive !== false) {
    redirect("/dashboard");
  }

  const { deactivated } = await searchParams;
  const notice = deactivated
    ? "Your account has been deactivated. Contact an admin."
    : undefined;

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-primary text-4xl">TrickFire</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Club Management Portal
          </p>
        </div>
        <LoginForm notice={notice} />
      </div>
    </div>
  );
}
