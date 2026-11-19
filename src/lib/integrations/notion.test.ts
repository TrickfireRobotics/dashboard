import { describe, expect, it } from "vitest";

import { parseNotionDatabaseId } from "./notion";

describe("parseNotionDatabaseId", () => {
    it("accepts a raw 32-char hex id", () => {
        expect(parseNotionDatabaseId("1301fd41ff5b81f28a91f837f0ea28a4")).toBe(
            "1301fd41-ff5b-81f2-8a91-f837f0ea28a4"
        );
    });

    it("accepts an already-dashed UUID", () => {
        expect(parseNotionDatabaseId("1301fd41-ff5b-81f2-8a91-f837f0ea28a4")).toBe(
            "1301fd41-ff5b-81f2-8a91-f837f0ea28a4"
        );
    });

    it("extracts the id from a full notion.so URL", () => {
        expect(
            parseNotionDatabaseId(
                "https://www.notion.so/trickfire/Arm-Tasks-1301fd41ff5b81f28a91f837f0ea28a4?v=abc"
            )
        ).toBe("1301fd41-ff5b-81f2-8a91-f837f0ea28a4");
    });

    it("returns null when nothing id-shaped is present", () => {
        expect(parseNotionDatabaseId("not a notion url")).toBeNull();
    });
});
