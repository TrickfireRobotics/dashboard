import { NextResponse } from "next/server";

export async function PATCH() {
    return NextResponse.json({ error: "Not supported" }, { status: 410 });
}
