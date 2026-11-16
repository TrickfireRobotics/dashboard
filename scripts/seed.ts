// Load env before any module that reads process.env at import time
// (auth.ts reads BETTER_AUTH_SECRET, db/index.ts reads DATABASE_PATH).
// Static ESM imports are hoisted, so we use dynamic imports inside main().
for (const f of [".env.local", ".env.production"]) {
    try {
        process.loadEnvFile(f);
        break;
    } catch {
        /* try next */
    }
}

const TEAMS = [
    "Arm",
    "Autonomous",
    "Chassis",
    "Drivebase",
    "Drone",
    "Science",
    "Simulation",
    "Mission Control",
    "Power Delivery",
    "Business & Marketing",
];

async function main() {
    const { auth } = await import("../src/lib/auth/auth");
    const { db } = await import("../src/lib/db");
    const { giftFund, order, stfBucket, stfQuarter, team, user } =
        await import("../src/lib/db/schema");
    const { GIFT_FUND_ID } = await import("../src/lib/finance/finance");
    const { financeSettings } = await import("../src/lib/db/schema");
    const { eq, like, or } = await import("drizzle-orm");
    const { bucketStartingBalances, generateSeedOrders, SEED_BATCH_PREFIX, SEED_MEMBERS } =
        await import("./seed-catalog");

    // Generated up front because the bucket allocations below are sized
    // against what these orders charge.
    const orderCount = Number(process.env.SEED_ORDER_COUNT ?? 260);
    const generated = generateSeedOrders({ count: orderCount });
    const startingBalances = bucketStartingBalances(generated);

    for (const name of TEAMS) {
        db.insert(team).values({ name }).onConflictDoNothing().run();
    }
    console.log(`Seeded ${TEAMS.length} teams.`);

    const existingGift = db.select().from(giftFund).where(eq(giftFund.id, GIFT_FUND_ID)).get();
    if (!existingGift) {
        db.insert(giftFund).values({ id: GIFT_FUND_ID, currentValueCents: 120_400 }).run();
        console.log("Seeded gift fund.");
    } else if (existingGift.currentValueCents === 0) {
        db.update(giftFund)
            .set({ currentValueCents: 120_400 })
            .where(eq(giftFund.id, GIFT_FUND_ID))
            .run();
        console.log("Updated gift fund seed value.");
    }

    let quarter = db.select().from(stfQuarter).where(eq(stfQuarter.isActive, true)).get();
    if (!quarter) {
        quarter = db
            .insert(stfQuarter)
            .values({ name: "2025-2026", isActive: true })
            .returning()
            .get();
        console.log(`Seeded active school year: ${quarter.name}`);
    }

    // Seed-owned buckets get their allocation rewritten every run so the
    // balances stay consistent with the sample orders. Buckets created by hand
    // in the app are left untouched.
    for (const [name, startingBalanceCents] of startingBalances) {
        const exists = db.select().from(stfBucket).where(eq(stfBucket.name, name)).get();
        if (exists) {
            db.update(stfBucket)
                .set({ startingBalanceCents })
                .where(eq(stfBucket.id, exists.id))
                .run();
        } else {
            db.insert(stfBucket)
                .values({ quarterId: quarter.id, name, startingBalanceCents })
                .run();
        }
    }
    console.log(`Seeded ${startingBalances.size} STF buckets.`);

    const existingSettings = db
        .select()
        .from(financeSettings)
        .where(eq(financeSettings.id, 1))
        .get();
    if (!existingSettings) {
        db.insert(financeSettings)
            .values({ id: 1, taxPercentBps: 1100, shippingPercentBps: 2000 })
            .run();
        console.log("Seeded finance settings.");
    }

    const rawEmail = process.env.SEED_ADMIN_EMAIL;
    const email = rawEmail?.includes("@") ? rawEmail : `${rawEmail}@admin.local`;
    const password = process.env.SEED_ADMIN_PASSWORD;
    const name = process.env.SEED_ADMIN_NAME ?? "TrickFire Admin";

    if (!email || !password) {
        throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set.");
    }

    const existing = db.select().from(user).where(eq(user.email, email)).get();

    if (!existing) {
        await auth.api.signUpEmail({ body: { email, password, name } });
        console.log(`Created admin user: ${email}`);
    }

    db.update(user)
        .set({ isActive: true, emailVerified: true, approved: true })
        .where(eq(user.email, email))
        .run();

    console.log(`Ensured ${email} has isActive=true, approved=true.`);

    const adminUser = db.select().from(user).where(eq(user.email, email)).get();

    // Requesters for the sample orders. They have no credential rows, so they
    // cannot sign in - they exist to give the order tables a realistic spread
    // of names instead of one account submitting everything.
    for (const member of SEED_MEMBERS) {
        db.insert(user)
            .values({
                id: member.id,
                name: member.name,
                email: member.email,
                emailVerified: true,
                isActive: true,
                approved: true,
            })
            .onConflictDoNothing()
            .run();
    }
    console.log(`Seeded ${SEED_MEMBERS.length} sample members.`);

    if (adminUser && quarter) {
        const bucketIdByName = new Map(
            db
                .select({ id: stfBucket.id, name: stfBucket.name })
                .from(stfBucket)
                .where(eq(stfBucket.quarterId, quarter.id))
                .all()
                .map((b) => [b.name, b.id] as const)
        );

        // Drop the previous sample set (including the older "[seed] " orders)
        // so re-seeding replaces the dataset instead of piling onto it. Real
        // orders are never tagged with a seed batch id.
        const removed = db
            .delete(order)
            .where(
                or(like(order.batchId, `${SEED_BATCH_PREFIX}%`), like(order.itemName, "[seed] %"))
            )
            .run();

        const reviewedAt = new Date();

        const rows = generated.map((o) => ({
            userId: o.userIndex === -1 ? adminUser.id : SEED_MEMBERS[o.userIndex].id,
            fundType: o.fundType,
            batchId: o.batchId,
            stfBucketId: o.bucketName ? (bucketIdByName.get(o.bucketName) ?? null) : null,
            quarterId: o.fundType === "STF" ? quarter.id : null,
            vendor: o.vendor,
            link: o.link,
            itemName: o.itemName,
            partNumber: o.partNumber,
            quantity: o.quantity,
            unitCostCents: o.unitCostCents,
            notes: o.notes,
            status: o.status,
            denialComment: o.denialComment,
            reviewedBy: o.status !== "pending" ? adminUser.id : null,
            reviewedAt: o.status !== "pending" ? reviewedAt : null,
            createdAt: o.createdAt,
        }));

        // One statement per chunk; SQLite caps bound parameters per statement.
        for (let i = 0; i < rows.length; i += 50) {
            db.insert(order)
                .values(rows.slice(i, i + 50))
                .run();
        }

        const tally = (status: string) => generated.filter((o) => o.status === status).length;
        const untriaged = generated.filter((o) => o.fundType === null).length;
        const mine = generated.filter((o) => o.userIndex === -1).length;

        console.log(
            `Sample orders: ${rows.length} inserted, ${removed.changes} replaced ` +
                `(${tally("pending")} pending incl. ${untriaged} untriaged, ` +
                `${tally("approved")} approved, ${tally("ordered")} ordered, ${tally("denied")} denied; ` +
                `${mine} owned by ${email}).`
        );
    }

    console.log("Seed complete.");
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
