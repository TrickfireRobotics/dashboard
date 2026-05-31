"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { signIn, signUp } from "@/lib/auth-client";

const schema = z.object({
    name: z.string().optional(),
    email: z.email("Enter a valid email"),
    password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm({ notice }: { notice?: string }) {
    const router = useRouter();
    const [mode, setMode] = useState<"signin" | "register">("signin");
    const [submitting, setSubmitting] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { name: "", email: "", password: "" },
    });

    function switchMode(next: "signin" | "register") {
        setMode(next);
        setServerError(null);
        form.reset({ name: "", email: "", password: "" });
    }

    async function onSubmit(values: FormValues) {
        if (mode === "register" && !values.name?.trim()) {
            form.setError("name", { message: "Name is required" });
            return;
        }

        setSubmitting(true);
        setServerError(null);

        if (mode === "signin") {
            await signIn.email(
                { email: values.email, password: values.password },
                {
                    onSuccess: () => {
                        toast.success("Welcome back");
                        router.push("/dashboard");
                        router.refresh();
                    },
                    onError: (ctx) => {
                        setServerError(ctx.error.message || "Invalid email or password");
                        setSubmitting(false);
                    },
                }
            );
        } else {
            await signUp.email(
                { name: values.name!, email: values.email, password: values.password },
                {
                    onSuccess: () => {
                        toast.success("Account created");
                        router.push("/dashboard");
                        router.refresh();
                    },
                    onError: (ctx) => {
                        setServerError(ctx.error.message || "Registration failed");
                        setSubmitting(false);
                    },
                }
            );
        }
    }

    const { errors } = form.formState;
    const errorMessages = [
        mode === "register" ? errors.name?.message : undefined,
        errors.email?.message,
        errors.password?.message,
        serverError,
    ].filter(Boolean) as string[];

    return (
        <Card>
            <CardContent>
                {notice ? (
                    <p className="border-destructive/40 bg-destructive/10 text-destructive mb-3 rounded-md border px-3 py-2 text-sm">
                        {notice}
                    </p>
                ) : null}
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-4">
                            {mode === "register" && (
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Name</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="text"
                                                    autoComplete="name"
                                                    placeholder="Your name"
                                                    {...field}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            )}
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="text"
                                                inputMode="email"
                                                autoComplete="email"
                                                placeholder="you@trickfirerobotics.com"
                                                {...field}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Password</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="password"
                                                autoComplete={
                                                    mode === "signin"
                                                        ? "current-password"
                                                        : "new-password"
                                                }
                                                {...field}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>
                        {errorMessages.length > 0 && (
                            <div>
                                {errorMessages.map((msg, i) => (
                                    <p key={i} className="text-destructive text-sm">
                                        {msg}
                                    </p>
                                ))}
                            </div>
                        )}
                        <Button
                            type="submit"
                            className="w-full"
                            style={
                                mode === "register"
                                    ? {
                                          backgroundColor: "var(--secondary)",
                                          color: "var(--secondary-foreground)",
                                      }
                                    : undefined
                            }
                            disabled={submitting}
                        >
                            {submitting
                                ? mode === "signin"
                                    ? "Signing in..."
                                    : "Registering..."
                                : mode === "signin"
                                  ? "Sign in"
                                  : "Register"}
                        </Button>
                        <p className="text-muted-foreground text-center text-sm">
                            {mode === "signin" ? (
                                <>
                                    No account?{" "}
                                    <button
                                        type="button"
                                        onClick={() => switchMode("register")}
                                        className="text-secondary underline-offset-4 hover:underline"
                                    >
                                        Register
                                    </button>
                                </>
                            ) : (
                                <>
                                    Already a member?{" "}
                                    <button
                                        type="button"
                                        onClick={() => switchMode("signin")}
                                        className="text-foreground underline-offset-4 hover:underline"
                                    >
                                        Sign in
                                    </button>
                                </>
                            )}
                        </p>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
