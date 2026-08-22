import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

// Parts orders -------------------------------------------------------------

const fundTypeSchema = z.enum(["STF", "Gift"]);

// A single requested item. Fund type and STF bucket are deliberately absent:
// officers assign those during triage, so members never pick a bucket.
export const orderItemSchema = z.object({
    vendor: z.string().trim().min(1, "Vendor is required").max(200),
    link: z.string().trim().url("Enter a valid URL").max(500),
    itemName: z.string().trim().min(1, "Item name is required").max(200),
    partNumber: z.string().trim().max(100).optional(),
    quantity: z.coerce.number().int().min(1, "At least 1").max(9999),
    unitCost: z.coerce.number().min(0.01, "Unit cost is required").max(1_000_000),
    notes: z.string().trim().max(2000).optional(),
});

export const MAX_ORDER_BATCH_ITEMS = 50;

export const orderBatchInputSchema = z.object({
    items: z
        .array(orderItemSchema)
        .min(1, "Add at least one item")
        .max(MAX_ORDER_BATCH_ITEMS, `At most ${MAX_ORDER_BATCH_ITEMS} items per submission`),
});

// Member edit of one of their own pending/denied orders.
export const orderInputSchema = orderItemSchema;

export const orderAssignSchema = z
    .object({
        orderIds: z.array(z.coerce.number().int().positive()).min(1, "Select at least one order"),
        fundType: fundTypeSchema,
        stfBucketId: z.coerce.number().int().positive().optional(),
    })
    .superRefine((data, ctx) => {
        if (data.fundType === "STF" && !data.stfBucketId) {
            ctx.addIssue({
                code: "custom",
                message: "Select an STF bucket",
                path: ["stfBucketId"],
            });
        }
    });

export const orderBulkActionSchema = z.object({
    orderIds: z.array(z.coerce.number().int().positive()).min(1, "Select at least one order"),
    action: z.enum(["approve", "deny"]),
    denialComment: z.string().trim().max(2000).optional(),
});

export const orderActionSchema = z.object({
    action: z.enum(["approve", "deny"]),
    denialComment: z.string().trim().max(2000).optional(),
});

export const ORDER_ACTION_STATUS = {
    approve: "approved",
    deny: "denied",
} as const;

export const markOrderedSchema = z.object({
    orderIds: z.array(z.coerce.number().int().positive()).min(1).optional(),
});

// Finance ------------------------------------------------------------------

export const stfBucketInputSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(100),
    startingBalance: z.coerce.number().min(0).max(10_000_000),
});

export const stfBucketUpdateSchema = z
    .object({
        name: z.string().trim().min(1).max(100).optional(),
        startingBalance: z.coerce.number().min(0).max(10_000_000).optional(),
        isActive: z.boolean().optional(),
    })
    .refine((v) => Object.values(v).some((x) => x !== undefined), {
        message: "Nothing to update",
    });

export const giftFundAdjustSchema = z.object({
    newValue: z.coerce.number().min(0).max(10_000_000),
    note: z.string().trim().max(500).optional(),
});

export const quarterResetSchema = z.object({
    quarterName: z.string().trim().min(1).max(100),
    newQuarterName: z.string().trim().min(1).max(100),
});

export const financeSettingsUpdateSchema = z.object({
    taxPercent: z.coerce.number().min(0, "Tax cannot be negative").max(100),
    shippingPercent: z.coerce.number().min(0, "Shipping cannot be negative").max(100),
});

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

export const whitelistActionSchema = z.object({
    action: z.enum(["approve", "reject"]),
    adminNote: z.string().trim().max(500).optional(),
});

export const whitelistDirectAddSchema = z.object({
    username: minecraftUsername,
    adminNote: z.string().trim().max(500).optional(),
});

// Network join requests ----------------------------------------------------

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
        isActive: z.boolean().optional(),
        approved: z.boolean().optional(),
    })
    .refine((v) => v.isActive !== undefined || v.approved !== undefined, {
        message: "Nothing to update",
    });
