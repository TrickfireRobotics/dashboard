import { createAuthClient } from "better-auth/react";
import { emailOTPClient, inferAdditionalFields } from "better-auth/client/plugins";

import type { auth } from "./auth";

export const authClient = createAuthClient({
    plugins: [inferAdditionalFields<typeof auth>(), emailOTPClient()],
});

export const { signIn, signOut, signUp, useSession, emailOtp } = authClient;
