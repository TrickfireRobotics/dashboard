import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";

import { db } from "./db";
import * as schema from "./db/schema";
import { sendEmail } from "./email";

const extraOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: extraOrigins,
    database: drizzleAdapter(db, {
        provider: "sqlite",
        schema,
    }),
    plugins: [
        emailOTP({
            otpLength: 6,
            expiresIn: 600,
            async sendVerificationOTP({ email, otp, type }) {
                const isReset = type === "forget-password";
                await sendEmail({
                    to: email,
                    subject: isReset
                        ? "Reset your TrickFire password"
                        : "Verify your TrickFire account",
                    html: `
                        <div style="font-family:sans-serif;max-width:400px;margin:0 auto">
                            <h2 style="color:#00fe00">${isReset ? "Password reset" : "Verify your account"}</h2>
                            <p>Your ${isReset ? "password reset" : "verification"} code:</p>
                            <p style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#ffffff;background:#222;padding:16px;border-radius:8px;text-align:center">${otp}</p>
                            <p style="color:#999;font-size:13px">Expires in 10 minutes. If you didn't request this, ignore this email.</p>
                        </div>
                    `,
                });
            },
        }),
    ],
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
    },
    emailVerification: {
        autoSignInAfterVerification: true,
    },
    user: {
        additionalFields: {
            role: {
                type: "string",
                required: false,
                defaultValue: "member",
                input: false,
            },
            isActive: {
                type: "boolean",
                required: false,
                defaultValue: true,
                input: false,
            },
        },
    },
});
