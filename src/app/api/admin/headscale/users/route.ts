import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({ error: "Not supported" }, { status: 410 });
}
