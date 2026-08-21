import { describe, it, expect } from "vitest";

import { parseItemRows } from "./PasteItemsPanel";

describe("parseItemRows", () => {
    it("parses a tab-separated spreadsheet row", () => {
        const items = parseItemRows(
            "1/4-20 hex bolt\tMcMaster-Carr\thttps://mcmaster.com/91251A542\t91251A542\t25\t0.42"
        );
        expect(items).toEqual([
            {
                itemName: "1/4-20 hex bolt",
                vendor: "McMaster-Carr",
                link: "https://mcmaster.com/91251A542",
                partNumber: "91251A542",
                quantity: "25",
                unitCost: "0.42",
            },
        ]);
    });

    it("parses comma-separated rows", () => {
        const items = parseItemRows("Motor, Amazon, https://a.com/m, M-1, 2, 19.99");
        expect(items).toHaveLength(1);
        expect(items[0].vendor).toBe("Amazon");
        expect(items[0].quantity).toBe("2");
        expect(items[0].unitCost).toBe("19.99");
    });

    it("parses multiple lines and skips blank ones", () => {
        const items = parseItemRows("Motor\tAmazon\n\n  \nBolt\tMcMaster\n");
        expect(items.map((i) => i.itemName)).toEqual(["Motor", "Bolt"]);
    });

    it("skips a pasted header row", () => {
        const items = parseItemRows("Item name\tVendor\tLink\nMotor\tAmazon");
        expect(items).toHaveLength(1);
        expect(items[0].itemName).toBe("Motor");
    });

    it("defaults quantity to 1 when missing or not a whole number", () => {
        expect(parseItemRows("Motor\tAmazon")[0].quantity).toBe("1");
        expect(parseItemRows("Motor\tAmazon\t\t\t2.5")[0].quantity).toBe("1");
    });

    it("strips currency formatting from unit cost", () => {
        expect(parseItemRows("Motor\tAmazon\t\t\t1\t$1,299.00")[0].unitCost).toBe("1299.00");
    });

    it("leaves unit cost blank when it is not a positive number", () => {
        expect(parseItemRows("Motor\tAmazon\t\t\t1\tTBD")[0].unitCost).toBe("");
        expect(parseItemRows("Motor\tAmazon\t\t\t1\t0")[0].unitCost).toBe("");
    });

    it("requires an item name", () => {
        expect(parseItemRows("\tAmazon\thttps://a.com")).toEqual([]);
    });

    it("returns nothing for empty input", () => {
        expect(parseItemRows("")).toEqual([]);
        expect(parseItemRows("   \n  ")).toEqual([]);
    });
});
