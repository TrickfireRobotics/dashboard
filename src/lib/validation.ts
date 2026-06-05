import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

const optionalPrice = z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(1_000_000));

const optionalUrl = z.preprocess(
    emptyToUndefined,
    z.string().trim().url("Enter a valid URL").max(500)
);

// Parts orders -------------------------------------------------------------

export const orderInputSchema = z.object({
    itemName: z.string().trim().min(1, "Item name is required").max(200),
    vendorUrl: optionalUrl.optional(),
    description: z.string().trim().max(2000).optional(),
    partType: z.string().trim().max(100).optional(),
    partNumber: z.string().trim().max(100).optional(),
    quantity: z.coerce.number().int().min(1, "At least 1").max(9999),
    unitPrice: optionalPrice.optional(),
    teamId: z.coerce.number().int().positive().optional(),
});

export const orderActionSchema = z.object({
    action: z.enum(["approve", "reject", "ordered"]),
    adminNote: z.string().trim().max(2000).optional(),
});

export const ORDER_ACTION_STATUS = {
    approve: "approved",
    reject: "rejected",
    ordered: "ordered",
} as const;

// API keys -----------------------------------------------------------------

export const createApiKeySchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(100),
});

// API Key Vault ------------------------------------------------------------

const vaultName = z.string().trim().min(1, "Name is required").max(100);
const vaultSecret = z.string().min(1, "Secret is required").max(5000);
const vaultDescription = z.preprocess(emptyToUndefined, z.string().trim().max(1000)).optional();

export const vaultEntrySchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("login"),
        name: vaultName,
        username: z.string().trim().min(1, "Username is required").max(200),
        secret: vaultSecret,
        description: vaultDescription,
    }),
    z.object({
        type: z.literal("api_key"),
        name: vaultName,
        secret: vaultSecret,
        description: vaultDescription,
    }),
]);

// Metadata edits without re-entering the secret; secret/username optional.
export const vaultEntryUpdateSchema = z
    .object({
        name: vaultName.optional(),
        username: z.string().trim().min(1).max(200).optional(),
        secret: vaultSecret.optional(),
        description: vaultDescription,
    })
    .refine((v) => Object.values(v).some((x) => x !== undefined), {
        message: "Nothing to update",
    });

// Grant / revoke per-person access to an api_key vault entry.
export const vaultAccessSchema = z.object({
    userId: z.string().trim().min(1, "User is required"),
});

// Minecraft whitelist ------------------------------------------------------

// Minecraft (Java) usernames: 3-16 chars, letters/digits/underscore.
const minecraftUsername = z
    .string()
    .trim()
    .min(3, "Username is too short")
    .max(16, "Username is too long")
    .regex(/^[A-Za-z0-9_]+$/, "Letters, numbers and underscore only");

export const whitelistRequestSchema = z.object({
    username: minecraftUsername,
    requestNote: z.string().trim().max(500).optional(),
});

export const whitelistActionSchema = z.object({
    action: z.enum(["approve", "reject"]),
    adminNote: z.string().trim().max(500).optional(),
});

export const whitelistDirectAddSchema = z.object({
    username: minecraftUsername,
    adminNote: z.string().trim().max(500).optional(),
});

// Headscale join requests --------------------------------------------------

export const joinRequestSchema = z.object({
    deviceName: z.string().trim().min(1, "Device name is required").max(100),
    machineKey: z.string().trim().max(200).optional(),
    requestNote: z.string().trim().max(500).optional(),
});

export const joinRequestActionSchema = z.object({
    action: z.enum(["approve", "reject"]),
    adminNote: z.string().trim().max(500).optional(),
});

// Admin user management ----------------------------------------------------

export const updateUserSchema = z
    .object({
        role: z.enum(["member", "admin"]).optional(),
        isActive: z.boolean().optional(),
        canAccessVault: z.boolean().optional(),
    })
    .refine(
        (v) =>
            v.role !== undefined || v.isActive !== undefined || v.canAccessVault !== undefined,
        {
            message: "Nothing to update",
        }
    );
