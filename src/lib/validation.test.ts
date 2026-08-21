import { describe, it, expect } from "vitest";
import {
    orderInputSchema,
    orderBatchInputSchema,
    orderAssignSchema,
    MAX_ORDER_BATCH_ITEMS,
    giftFundAdjustSchema,
    financeSettingsUpdateSchema,
    markOrderedSchema,
    vaultEntrySchema,
    whitelistRequestSchema,
    stfBucketInputSchema,
    updateUserSchema,
} from "./validation";

const validItem = {
    vendor: "Amazon",
    link: "https://example.com/item",
    itemName: "Motor",
    partNumber: "MT-001",
    quantity: 2,
    unitCost: 50,
};

describe("orderInputSchema", () => {
    it("accepts a valid item", () => {
        expect(() => orderInputSchema.parse(validItem)).not.toThrow();
    });

    it("accepts an item without a part number or notes", () => {
        const rest = { ...validItem, partNumber: undefined };
        expect(orderInputSchema.safeParse(rest).success).toBe(true);
    });

    it("ignores a fund type if one is sent", () => {
        const result = orderInputSchema.safeParse({ ...validItem, fundType: "STF" });
        expect(result.success).toBe(true);
        expect(result.data).not.toHaveProperty("fundType");
    });

    it("rejects quantity less than 1", () => {
        expect(orderInputSchema.safeParse({ ...validItem, quantity: 0 }).success).toBe(false);
    });

    it("rejects a missing vendor", () => {
        expect(orderInputSchema.safeParse({ ...validItem, vendor: "" }).success).toBe(false);
    });

    it("rejects a non-URL link", () => {
        expect(orderInputSchema.safeParse({ ...validItem, link: "not-a-url" }).success).toBe(false);
    });

    it("rejects a zero unit cost", () => {
        expect(orderInputSchema.safeParse({ ...validItem, unitCost: 0 }).success).toBe(false);
    });
});

describe("orderBatchInputSchema", () => {
    it("accepts a single item", () => {
        expect(orderBatchInputSchema.safeParse({ items: [validItem] }).success).toBe(true);
    });

    it("accepts many items", () => {
        const items = Array.from({ length: 12 }, (_, i) => ({
            ...validItem,
            itemName: `Motor ${i}`,
        }));
        const result = orderBatchInputSchema.safeParse({ items });
        expect(result.success).toBe(true);
        expect(result.data?.items).toHaveLength(12);
    });

    it("rejects an empty batch", () => {
        expect(orderBatchInputSchema.safeParse({ items: [] }).success).toBe(false);
    });

    it("rejects more than the batch limit", () => {
        const items = Array.from({ length: MAX_ORDER_BATCH_ITEMS + 1 }, () => validItem);
        expect(orderBatchInputSchema.safeParse({ items }).success).toBe(false);
    });

    it("rejects the whole batch when one item is invalid", () => {
        const result = orderBatchInputSchema.safeParse({
            items: [validItem, { ...validItem, link: "nope" }],
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.map((i) => i.path.join("."))).toContain("items.1.link");
        }
    });
});

describe("orderAssignSchema", () => {
    it("accepts an STF assignment with a bucket", () => {
        const result = orderAssignSchema.safeParse({
            orderIds: [1, 2],
            fundType: "STF",
            stfBucketId: 3,
        });
        expect(result.success).toBe(true);
    });

    it("rejects an STF assignment without a bucket", () => {
        const result = orderAssignSchema.safeParse({ orderIds: [1], fundType: "STF" });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.map((i) => i.path.join("."))).toContain("stfBucketId");
        }
    });

    it("accepts a Gift assignment without a bucket", () => {
        expect(orderAssignSchema.safeParse({ orderIds: [1], fundType: "Gift" }).success).toBe(true);
    });

    it("rejects an empty selection", () => {
        expect(orderAssignSchema.safeParse({ orderIds: [], fundType: "Gift" }).success).toBe(false);
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
        expect(() => updateUserSchema.parse({ isActive: false })).not.toThrow();
        expect(() => updateUserSchema.parse({ approved: true })).not.toThrow();
    });

    it("rejects an update with no fields set", () => {
        const result = updateUserSchema.safeParse({});
        expect(result.success).toBe(false);
    });
});
