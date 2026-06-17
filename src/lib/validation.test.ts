import { describe, it, expect } from "vitest";
import {
    orderInputSchema,
    giftFundAdjustSchema,
    financeSettingsUpdateSchema,
    markOrderedSchema,
    vaultEntrySchema,
    whitelistRequestSchema,
    stfBucketInputSchema,
    updateUserSchema,
} from "./validation";

describe("orderInputSchema", () => {
    const validStf = {
        fundType: "STF",
        stfBucketId: 1,
        vendor: "Amazon",
        link: "https://example.com/item",
        itemName: "Motor",
        partNumber: "MT-001",
        quantity: 2,
        unitCost: 50,
    };

    const validGift = {
        fundType: "Gift",
        vendor: "Home Depot",
        link: "https://example.com/bolt",
        itemName: "Bolts",
        quantity: 10,
        unitCost: 2.99,
        notes: "M4 x 20mm",
    };

    it("accepts a valid STF order", () => {
        expect(() => orderInputSchema.parse(validStf)).not.toThrow();
    });

    it("accepts a valid Gift order", () => {
        expect(() => orderInputSchema.parse(validGift)).not.toThrow();
    });

    it("rejects STF order missing stfBucketId", () => {
        const result = orderInputSchema.safeParse({ ...validStf, stfBucketId: undefined });
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join("."));
            expect(paths).toContain("stfBucketId");
        }
    });

    it("rejects STF order missing partNumber", () => {
        const result = orderInputSchema.safeParse({ ...validStf, partNumber: undefined });
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join("."));
            expect(paths).toContain("partNumber");
        }
    });

    it("rejects Gift order missing notes", () => {
        const result = orderInputSchema.safeParse({ ...validGift, notes: undefined });
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join("."));
            expect(paths).toContain("notes");
        }
    });

    it("rejects quantity less than 1", () => {
        const result = orderInputSchema.safeParse({ ...validStf, quantity: 0 });
        expect(result.success).toBe(false);
    });

    it("rejects unitCost of 0", () => {
        const result = orderInputSchema.safeParse({ ...validStf, unitCost: 0 });
        expect(result.success).toBe(false);
    });

    it("rejects an invalid URL for link", () => {
        const result = orderInputSchema.safeParse({ ...validStf, link: "not-a-url" });
        expect(result.success).toBe(false);
    });
});

describe("giftFundAdjustSchema", () => {
    it("accepts a valid positive value", () => {
        expect(() => giftFundAdjustSchema.parse({ newValue: 500 })).not.toThrow();
    });

    it("accepts zero", () => {
        expect(() => giftFundAdjustSchema.parse({ newValue: 0 })).not.toThrow();
    });

    it("accepts an optional note", () => {
        expect(() => giftFundAdjustSchema.parse({ newValue: 100, note: "Top-up" })).not.toThrow();
    });

    it("rejects a negative value", () => {
        const result = giftFundAdjustSchema.safeParse({ newValue: -1 });
        expect(result.success).toBe(false);
    });

    it("rejects a value above the maximum", () => {
        const result = giftFundAdjustSchema.safeParse({ newValue: 10_000_001 });
        expect(result.success).toBe(false);
    });
});

describe("financeSettingsUpdateSchema", () => {
    it("accepts valid tax and shipping percentages", () => {
        expect(() =>
            financeSettingsUpdateSchema.parse({ taxPercent: 11, shippingPercent: 20 })
        ).not.toThrow();
    });

    it("accepts zero for tax and shipping", () => {
        expect(() =>
            financeSettingsUpdateSchema.parse({ taxPercent: 0, shippingPercent: 0 })
        ).not.toThrow();
    });

    it("rejects negative tax", () => {
        const result = financeSettingsUpdateSchema.safeParse({
            taxPercent: -1,
            shippingPercent: 10,
        });
        expect(result.success).toBe(false);
    });

    it("rejects negative shipping", () => {
        const result = financeSettingsUpdateSchema.safeParse({
            taxPercent: 10,
            shippingPercent: -0.01,
        });
        expect(result.success).toBe(false);
    });

    it("rejects percentages above 100", () => {
        expect(
            financeSettingsUpdateSchema.safeParse({ taxPercent: 101, shippingPercent: 10 }).success
        ).toBe(false);
        expect(
            financeSettingsUpdateSchema.safeParse({ taxPercent: 10, shippingPercent: 100.01 })
                .success
        ).toBe(false);
    });
});

describe("markOrderedSchema", () => {
    it("accepts an empty body to move all approved orders", () => {
        expect(() => markOrderedSchema.parse({})).not.toThrow();
    });

    it("accepts a list of order ids", () => {
        expect(() => markOrderedSchema.parse({ orderIds: [1, 2, 3] })).not.toThrow();
    });

    it("rejects an empty orderIds array", () => {
        const result = markOrderedSchema.safeParse({ orderIds: [] });
        expect(result.success).toBe(false);
    });

    it("rejects invalid order ids", () => {
        expect(markOrderedSchema.safeParse({ orderIds: [0, -1] }).success).toBe(false);
    });
});

describe("vaultEntrySchema (discriminated union)", () => {
    it("accepts a valid login entry", () => {
        expect(() =>
            vaultEntrySchema.parse({
                type: "login",
                name: "GitHub",
                username: "robot",
                secret: "hunter2",
            })
        ).not.toThrow();
    });

    it("accepts a valid api_key entry", () => {
        expect(() =>
            vaultEntrySchema.parse({
                type: "api_key",
                name: "Stripe Key",
                secret: "sk_live_abc",
            })
        ).not.toThrow();
    });

    it("rejects a login entry missing username", () => {
        const result = vaultEntrySchema.safeParse({
            type: "login",
            name: "GitHub",
            secret: "hunter2",
        });
        expect(result.success).toBe(false);
    });

    it("rejects an entry missing secret", () => {
        const result = vaultEntrySchema.safeParse({
            type: "api_key",
            name: "Stripe Key",
            secret: "",
        });
        expect(result.success).toBe(false);
    });

    it("rejects an unknown type", () => {
        const result = vaultEntrySchema.safeParse({
            type: "ssh_key",
            name: "Server",
            secret: "pem-data",
        });
        expect(result.success).toBe(false);
    });
});

describe("whitelistRequestSchema", () => {
    it("accepts a valid Minecraft username", () => {
        expect(() => whitelistRequestSchema.parse({ username: "Steve_123" })).not.toThrow();
    });

    it("rejects usernames shorter than 3 characters", () => {
        const result = whitelistRequestSchema.safeParse({ username: "ab" });
        expect(result.success).toBe(false);
    });

    it("rejects usernames longer than 16 characters", () => {
        const result = whitelistRequestSchema.safeParse({ username: "a".repeat(17) });
        expect(result.success).toBe(false);
    });

    it("rejects usernames with spaces or special characters", () => {
        expect(whitelistRequestSchema.safeParse({ username: "has space" }).success).toBe(false);
        expect(whitelistRequestSchema.safeParse({ username: "has-dash" }).success).toBe(false);
        expect(whitelistRequestSchema.safeParse({ username: "has.dot" }).success).toBe(false);
    });

    it("accepts underscores and mixed case", () => {
        expect(() => whitelistRequestSchema.parse({ username: "Cool_Player" })).not.toThrow();
    });
});

describe("stfBucketInputSchema", () => {
    it("accepts valid name and balance", () => {
        expect(() =>
            stfBucketInputSchema.parse({ name: "Drivetrain", startingBalance: 1000 })
        ).not.toThrow();
    });

    it("rejects empty name", () => {
        const result = stfBucketInputSchema.safeParse({ name: "", startingBalance: 500 });
        expect(result.success).toBe(false);
    });

    it("rejects negative balance", () => {
        const result = stfBucketInputSchema.safeParse({ name: "Arm", startingBalance: -1 });
        expect(result.success).toBe(false);
    });
});

describe("updateUserSchema", () => {
    it("accepts updating a single field", () => {
        expect(() => updateUserSchema.parse({ role: "admin" })).not.toThrow();
        expect(() => updateUserSchema.parse({ isActive: false })).not.toThrow();
    });

    it("rejects an update with no fields set", () => {
        const result = updateUserSchema.safeParse({});
        expect(result.success).toBe(false);
    });

    it("rejects invalid role values", () => {
        const result = updateUserSchema.safeParse({ role: "superuser" });
        expect(result.success).toBe(false);
    });
});
