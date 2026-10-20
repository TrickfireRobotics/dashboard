import { describe, it, expect, beforeEach } from "vitest";

import { db } from "@/lib/db";
import { simAccessCode } from "@/lib/db/schema";
import { getAccessCode } from "./access-code";
import { authenticateSimRequest } from "./request-auth";

beforeEach(() => {
    db.delete(simAccessCode).run();
});

let ipCounter = 0;
function request(headers: Record<string, string>) {
    return new Request("http://localhost/api/sim/export", {
        method: "POST",
        headers: { "x-forwarded-for": `10.0.0.${++ipCounter}`, ...headers },
    });
}

function status(req: Request): number {
    return authenticateSimRequest(req)?.status ?? 200;
}

describe("authenticateSimRequest", () => {
    it("rejects a request with no code", () => {
        expect(status(request({}))).toBe(401);
    });

    it("no longer accepts an api key", () => {
        expect(status(request({ "x-api-key": "tf_anything" }))).toBe(401);
    });

    it("accepts the current code", () => {
        expect(status(request({ "x-access-code": getAccessCode().code }))).toBe(200);
    });

    it("accepts a code with separators in it", () => {
        const code = getAccessCode().code;
        expect(status(request({ "x-access-code": `${code.slice(0, 3)}-${code.slice(3)}` }))).toBe(
            200
        );
    });

    it("rejects a wrong code", () => {
        const wrong = String((Number(getAccessCode().code) + 1) % 1_000_000).padStart(6, "0");
        expect(status(request({ "x-access-code": wrong }))).toBe(401);
    });

    it("rate limits an IP after repeated wrong codes", () => {
        const wrong = String((Number(getAccessCode().code) + 1) % 1_000_000).padStart(6, "0");
        const headers = { "x-forwarded-for": "10.1.1.1", "x-access-code": wrong };
        let last = 0;
        for (let i = 0; i < 12; i++) {
            last = status(new Request("http://localhost", { headers }));
        }
        expect(last).toBe(429);
    });

    it("does not spend the failure budget on correct codes", () => {
        const headers = { "x-forwarded-for": "10.2.2.2", "x-access-code": getAccessCode().code };
        for (let i = 0; i < 50; i++) {
            status(new Request("http://localhost", { headers }));
        }
        expect(status(new Request("http://localhost", { headers }))).toBe(200);
    });
});
