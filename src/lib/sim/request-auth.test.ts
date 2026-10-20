import { describe, it, expect, beforeAll } from "vitest";
import { NextResponse } from "next/server";

import { currentAccessCode } from "./access-code";
import { authenticateSimRequest } from "./request-auth";

beforeAll(() => {
    process.env.SIM_ACCESS_CODE_SECRET = "test-secret";
});

let ipCounter = 0;
function request(headers: Record<string, string>) {
    return new Request("http://localhost/api/sim/export", {
        method: "POST",
        headers: { "x-forwarded-for": `10.0.0.${++ipCounter}`, ...headers },
    });
}

async function status(result: ReturnType<typeof authenticateSimRequest>) {
    return result instanceof NextResponse ? result.status : 200;
}

describe("authenticateSimRequest", () => {
    it("rejects a request with no credentials", async () => {
        expect(await status(authenticateSimRequest(request({})))).toBe(401);
    });

    it("accepts today's access code", () => {
        const result = authenticateSimRequest(request({ "x-access-code": currentAccessCode() }));
        expect(result).toEqual({ via: "access-code" });
    });

    it("accepts a code with separators in it", () => {
        const code = currentAccessCode();
        const result = authenticateSimRequest(
            request({ "x-access-code": `${code.slice(0, 3)}-${code.slice(3)}` })
        );
        expect(result).toEqual({ via: "access-code" });
    });

    it("rejects a wrong code", async () => {
        const wrong = String((Number(currentAccessCode()) + 1) % 1_000_000).padStart(6, "0");
        expect(await status(authenticateSimRequest(request({ "x-access-code": wrong })))).toBe(401);
    });

    it("rejects an unknown api key", async () => {
        expect(await status(authenticateSimRequest(request({ "x-api-key": "tf_nope" })))).toBe(401);
    });

    it("rate limits an IP after repeated wrong codes", async () => {
        const ip = "10.1.1.1";
        const wrong = { "x-forwarded-for": ip, "x-access-code": "000000" };
        let lastStatus = 0;
        for (let i = 0; i < 12; i++) {
            lastStatus = await status(
                authenticateSimRequest(new Request("http://localhost", { headers: wrong }))
            );
        }
        expect(lastStatus).toBe(429);
    });

    it("does not spend the failure budget on correct codes", async () => {
        const ip = "10.2.2.2";
        const good = { "x-forwarded-for": ip, "x-access-code": currentAccessCode() };
        for (let i = 0; i < 50; i++) {
            authenticateSimRequest(new Request("http://localhost", { headers: good }));
        }
        const result = authenticateSimRequest(new Request("http://localhost", { headers: good }));
        expect(result).toEqual({ via: "access-code" });
    });
});
