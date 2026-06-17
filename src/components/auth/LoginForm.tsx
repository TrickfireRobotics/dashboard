"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { emailOtp, signIn, signUp } from "@/lib/auth/client";

const toAuthEmail = (value: string) => (value.includes("@") ? value : `${value}@admin.local`);

const credentialsSchema = z.object({
    name: z.string().optional(),
    email: z.string().min(1, "Enter your email or username"),
    password: z.string().min(1, "Password is required"),
    confirmPassword: z.string().optional(),
});

const PASSWORD_RULES = [
    { label: "8+ characters", test: (p: string) => p.length >= 8 },
    { label: "Uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
    { label: "Lowercase letter", test: (p: string) => /[a-z]/.test(p) },
    { label: "Number", test: (p: string) => /[0-9]/.test(p) },
    { label: "Special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

function PasswordChecklist({ password }: { password: string }) {
    return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
            {PASSWORD_RULES.map(({ label, test }) => {
                const met = password.length > 0 && test(password);
                return (
                    <div
                        key={label}
                        className={cn(
                            "flex items-center gap-1.5 text-xs transition-colors",
                            met ? "text-primary" : "text-muted-foreground"
                        )}
                    >
                        <div
                            className={cn(
                                "size-1.5 shrink-0 rounded-full transition-colors",
                                met ? "bg-primary" : "bg-muted-foreground/40"
                            )}
                        />
                        {label}
                    </div>
                );
            })}
        </div>
    );
}

const otpSchema = z.object({
    otp: z.string().length(6, "Enter the 6-digit code"),
});

const forgotSchema = z.object({
    email: z.email("Enter a valid email"),
});

const resetSchema = z.object({
    otp: z.string().length(6, "Enter the 6-digit code"),
    password: z.string().min(8, "Password must be at least 8 characters"),
});

type CredentialsValues = z.infer<typeof credentialsSchema>;
type OtpValues = z.infer<typeof otpSchema>;
type ForgotValues = z.infer<typeof forgotSchema>;
type ResetValues = z.infer<typeof resetSchema>;

type Mode = "signin" | "register";
type Step = "credentials" | "verify" | "forgot" | "reset";

function ErrorList({ messages }: { messages: string[] }) {
    if (!messages.length) return null;
    return (
        <div>
            {messages.map((msg, i) => (
                <p key={i} className="text-destructive text-sm">
                    {msg}
                </p>
            ))}
        </div>
    );
}

export function LoginForm({ notice }: { notice?: string }) {
    const router = useRouter();
    const [mode, setMode] = useState<Mode>("signin");
    const [step, setStep] = useState<Step>("credentials");
    const [pendingEmail, setPendingEmail] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    // One form instance per step schema
    const credForm = useForm<CredentialsValues>({
        resolver: zodResolver(credentialsSchema),
        defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
    });
    const watchedPassword = useWatch({ control: credForm.control, name: "password" });
    const otpForm = useForm<OtpValues>({
        resolver: zodResolver(otpSchema),
        defaultValues: { otp: "" },
    });
    const forgotForm = useForm<ForgotValues>({
        resolver: zodResolver(forgotSchema),
        defaultValues: { email: "" },
    });
    const resetForm = useForm<ResetValues>({
        resolver: zodResolver(resetSchema),
        defaultValues: { otp: "", password: "" },
    });

    function switchMode(next: Mode) {
        setMode(next);
        setStep("credentials");
        setServerError(null);
        credForm.reset({ name: "", email: "", password: "", confirmPassword: "" });
    }

    async function onCredentialsSubmit(values: CredentialsValues) {
        if (mode === "register" && !values.name?.trim()) {
            credForm.setError("name", { message: "Name is required" });
            return;
        }
        if (mode === "register" && !z.email().safeParse(values.email).success) {
            credForm.setError("email", { message: "Enter a valid email" });
            return;
        }
        if (mode === "register") {
            const p = values.password;
            if (
                p.length < 8 ||
                !/[A-Z]/.test(p) ||
                !/[a-z]/.test(p) ||
                !/[0-9]/.test(p) ||
                !/[^A-Za-z0-9]/.test(p)
            ) {
                credForm.setError("password", {
                    message: "Password does not meet all requirements",
                });
                return;
            }
            if (values.password !== values.confirmPassword) {
                credForm.setError("confirmPassword", { message: "Passwords do not match" });
                return;
            }
        }

        setSubmitting(true);
        setServerError(null);

        const authEmail = toAuthEmail(values.email);

        if (mode === "signin") {
            await signIn.email(
                { email: authEmail, password: values.password },
                {
                    onSuccess: () => {
                        toast.success("Welcome back");
                        router.push("/dashboard");
                        router.refresh();
                    },
                    onError: async (ctx) => {
                        const msg = ctx.error.message || "Invalid email or password";
                        if (
                            msg.toLowerCase().includes("email") &&
                            msg.toLowerCase().includes("verif")
                        ) {
                            setPendingEmail(authEmail);
                            const { error } = await emailOtp.sendVerificationOtp({
                                email: authEmail,
                                type: "email-verification",
                            });
                            if (error) {
                                setServerError(
                                    "Failed to send verification email. Please try again."
                                );
                            } else {
                                setStep("verify");
                            }
                        } else {
                            setServerError(msg);
                        }
                        setSubmitting(false);
                    },
                }
            );
        } else {
            await signUp.email(
                { name: values.name!, email: authEmail, password: values.password },
                {
                    onSuccess: async () => {
                        setPendingEmail(authEmail);
                        const { error } = await emailOtp.sendVerificationOtp({
                            email: authEmail,
                            type: "email-verification",
                        });
                        if (error) {
                            setServerError(
                                "Account created but failed to send verification email. Please try again."
                            );
                        } else {
                            setStep("verify");
                        }
                        setSubmitting(false);
                    },
                    onError: (ctx) => {
                        setServerError(ctx.error.message || "Registration failed");
                        setSubmitting(false);
                    },
                }
            );
        }
    }

    async function onOtpSubmit(values: OtpValues) {
        setSubmitting(true);
        setServerError(null);

        const { error } = await emailOtp.verifyEmail({
            email: pendingEmail,
            otp: values.otp,
        });

        if (error) {
            setServerError(error.message || "Invalid or expired code");
            setSubmitting(false);
            return;
        }

        toast.success("Email verified - welcome!");
        router.replace("/dashboard");
    }

    async function onForgotSubmit(values: ForgotValues) {
        setSubmitting(true);
        setServerError(null);

        const { error } = await emailOtp.sendVerificationOtp({
            email: values.email,
            type: "forget-password",
        });

        if (error) {
            setServerError(error.message || "Could not send reset code");
            setSubmitting(false);
            return;
        }

        setPendingEmail(values.email);
        setStep("reset");
        setSubmitting(false);
    }

    async function onResetSubmit(values: ResetValues) {
        setSubmitting(true);
        setServerError(null);

        const { error } = await emailOtp.resetPassword({
            email: pendingEmail,
            otp: values.otp,
            password: values.password,
        });

        if (error) {
            setServerError(error.message || "Invalid or expired code");
            setSubmitting(false);
            return;
        }

        toast.success("Password reset - please sign in");
        setStep("credentials");
        setMode("signin");
        resetForm.reset();
        setSubmitting(false);
    }

    return (
        <Card>
            <CardContent>
                {notice ? (
                    <p className="border-destructive/40 bg-destructive/10 text-destructive mb-3 rounded-md border px-3 py-2 text-sm">
                        {notice}
                    </p>
                ) : null}

                {/* ── Credentials step ── */}
                {step === "credentials" && (
                    <Form {...credForm}>
                        <form
                            onSubmit={(e) => e.preventDefault()}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey && !submitting) {
                                    e.preventDefault();
                                    credForm.handleSubmit(onCredentialsSubmit)();
                                }
                            }}
                            className="space-y-4"
                        >
                            <div className="space-y-4">
                                {mode === "register" && (
                                    <FormField
                                        control={credForm.control}
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
                                    control={credForm.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="text"
                                                    inputMode="email"
                                                    autoComplete="username"
                                                    placeholder="your@email.com or username"
                                                    {...field}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={credForm.control}
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
                                {mode === "register" && (
                                    <FormField
                                        control={credForm.control}
                                        name="confirmPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Confirm password</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="password"
                                                        autoComplete="new-password"
                                                        {...field}
                                                        value={field.value ?? ""}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </div>
                            {mode === "register" && (
                                <PasswordChecklist password={watchedPassword ?? ""} />
                            )}
                            <ErrorList
                                messages={
                                    [
                                        mode === "register"
                                            ? credForm.formState.errors.name?.message
                                            : undefined,
                                        credForm.formState.errors.email?.message,
                                        credForm.formState.errors.password?.message,
                                        mode === "register"
                                            ? credForm.formState.errors.confirmPassword?.message
                                            : undefined,
                                        serverError,
                                    ].filter(Boolean) as string[]
                                }
                            />
                            <Button
                                type="button"
                                onClick={() => credForm.handleSubmit(onCredentialsSubmit)()}
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
                            <div className="flex items-center justify-between text-sm">
                                <p className="text-muted-foreground">
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
                                            Have an account?{" "}
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
                                {mode === "signin" && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setStep("forgot");
                                            setServerError(null);
                                        }}
                                        className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                                    >
                                        Forgot password?
                                    </button>
                                )}
                            </div>
                        </form>
                    </Form>
                )}

                {/* ── Verify step ── */}
                {step === "verify" && (
                    <Form {...otpForm}>
                        <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-4">
                            <div className="space-y-1">
                                <p className="text-foreground text-sm font-medium">
                                    Check your email
                                </p>
                                <p className="text-muted-foreground text-sm">
                                    We sent a 6-digit code to{" "}
                                    <span className="text-foreground">{pendingEmail}</span>
                                </p>
                            </div>
                            <FormField
                                control={otpForm.control}
                                name="otp"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Verification code</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="text"
                                                inputMode="numeric"
                                                maxLength={6}
                                                placeholder="000000"
                                                className="text-center text-lg tracking-widest"
                                                {...field}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <ErrorList
                                messages={
                                    [otpForm.formState.errors.otp?.message, serverError].filter(
                                        Boolean
                                    ) as string[]
                                }
                            />
                            <Button type="submit" className="w-full" disabled={submitting}>
                                {submitting ? "Verifying..." : "Verify email"}
                            </Button>
                            <p className="text-muted-foreground text-center text-sm">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        await emailOtp.sendVerificationOtp({
                                            email: pendingEmail,
                                            type: "email-verification",
                                        });
                                        toast.info("Code resent");
                                    }}
                                    className="hover:text-foreground underline-offset-4 hover:underline"
                                >
                                    Resend code
                                </button>
                            </p>
                        </form>
                    </Form>
                )}

                {/* ── Forgot step ── */}
                {step === "forgot" && (
                    <Form {...forgotForm}>
                        <form
                            onSubmit={forgotForm.handleSubmit(onForgotSubmit)}
                            className="space-y-4"
                        >
                            <div className="space-y-1">
                                <p className="text-foreground text-sm font-medium">
                                    Reset your password
                                </p>
                                <p className="text-muted-foreground text-sm">
                                    Enter your email and we&apos;ll send a reset code.
                                </p>
                            </div>
                            <FormField
                                control={forgotForm.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="text"
                                                inputMode="email"
                                                autoComplete="email"
                                                placeholder="your@email.com"
                                                {...field}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <ErrorList
                                messages={
                                    [
                                        forgotForm.formState.errors.email?.message,
                                        serverError,
                                    ].filter(Boolean) as string[]
                                }
                            />
                            <Button type="submit" className="w-full" disabled={submitting}>
                                {submitting ? "Sending..." : "Send reset code"}
                            </Button>
                            <p className="text-muted-foreground text-center text-sm">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStep("credentials");
                                        setServerError(null);
                                    }}
                                    className="hover:text-foreground underline-offset-4 hover:underline"
                                >
                                    Back to sign in
                                </button>
                            </p>
                        </form>
                    </Form>
                )}

                {/* ── Reset step ── */}
                {step === "reset" && (
                    <Form {...resetForm}>
                        <form
                            onSubmit={resetForm.handleSubmit(onResetSubmit)}
                            className="space-y-4"
                        >
                            <div className="space-y-1">
                                <p className="text-foreground text-sm font-medium">
                                    Enter your new password
                                </p>
                                <p className="text-muted-foreground text-sm">
                                    Check <span className="text-foreground">{pendingEmail}</span>{" "}
                                    for the 6-digit code.
                                </p>
                            </div>
                            <div className="space-y-4">
                                <FormField
                                    control={resetForm.control}
                                    name="otp"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Reset code</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="text"
                                                    inputMode="numeric"
                                                    maxLength={6}
                                                    placeholder="000000"
                                                    className="text-center text-lg tracking-widest"
                                                    {...field}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={resetForm.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>New password</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="password"
                                                    autoComplete="new-password"
                                                    {...field}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <ErrorList
                                messages={
                                    [
                                        resetForm.formState.errors.otp?.message,
                                        resetForm.formState.errors.password?.message,
                                        serverError,
                                    ].filter(Boolean) as string[]
                                }
                            />
                            <Button type="submit" className="w-full" disabled={submitting}>
                                {submitting ? "Resetting..." : "Reset password"}
                            </Button>
                            <p className="text-muted-foreground text-center text-sm">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStep("credentials");
                                        setServerError(null);
                                    }}
                                    className="hover:text-foreground underline-offset-4 hover:underline"
                                >
                                    Back to sign in
                                </button>
                            </p>
                        </form>
                    </Form>
                )}
            </CardContent>
        </Card>
    );
}
