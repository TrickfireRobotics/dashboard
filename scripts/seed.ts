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
    const { eq } = await import("drizzle-orm");

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

    const defaultBuckets = [
        { name: "Mechanical", startingBalanceCents: 43_000 },
        { name: "Electronics", startingBalanceCents: 12_050 },
        { name: "Software", startingBalanceCents: 0 },
        { name: "Poggers", startingBalanceCents: 67 },
        { name: "Wind Turbines", startingBalanceCents: 999 },
        { name: "Some more", startingBalanceCents: 929 },
        { name: "Some more 2", startingBalanceCents: 8795 },
        { name: "I'm unoriginal ik", startingBalanceCents: 999 },
    ];
    for (const bucket of defaultBuckets) {
        const exists = db.select().from(stfBucket).where(eq(stfBucket.name, bucket.name)).get();
        if (!exists) {
            db.insert(stfBucket)
                .values({
                    quarterId: quarter.id,
                    name: bucket.name,
                    startingBalanceCents: bucket.startingBalanceCents,
                })
                .run();
        }
    }
    console.log("Seeded STF buckets.");

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
    const mechanical = db.select().from(stfBucket).where(eq(stfBucket.name, "Mechanical")).get();
    const electronics = db.select().from(stfBucket).where(eq(stfBucket.name, "Electronics")).get();

    const SEED_ITEM_PREFIX = "[seed] ";
    const UNTRIAGED_BATCH_ID = "seed-untriaged-batch";
    const seedOrders = [
        {
            itemName: `${SEED_ITEM_PREFIX}1/4-20 hex bolt assortment`,
            fundType: "STF" as const,
            stfBucketName: "Mechanical",
            vendor: "McMaster-Carr",
            link: "https://example.com/mcmaster-bolts",
            partNumber: "91290A115",
            quantity: 2,
            unitCostCents: 2450,
            notes: "Assorted lengths for drivetrain assembly",
            status: "ordered" as const,
        },
        {
            itemName: `${SEED_ITEM_PREFIX}REV NEO brushless motor`,
            fundType: "STF" as const,
            stfBucketName: "Mechanical",
            vendor: "REV Robotics",
            link: "https://example.com/rev-neo",
            partNumber: "REV-21-1650",
            quantity: 4,
            unitCostCents: 12_500,
            notes: null,
            status: "ordered" as const,
        },
        {
            itemName: `${SEED_ITEM_PREFIX}Pit organization tape`,
            fundType: "Gift" as const,
            stfBucketName: null,
            vendor: "Amazon",
            link: "https://example.com/pit-tape",
            partNumber: null,
            quantity: 6,
            unitCostCents: 899,
            notes: "Colored tape for pit cable management",
            status: "ordered" as const,
        },
        {
            itemName: `${SEED_ITEM_PREFIX}Aluminum 1x1x1/8 wall tube`,
            fundType: "STF" as const,
            stfBucketName: "Mechanical",
            vendor: "Online Metals",
            link: "https://example.com/aluminum-tube",
            partNumber: "OM-1X1-125",
            quantity: 3,
            unitCostCents: 18_750,
            notes: "Frame rail stock",
            status: "ordered" as const,
        },
        {
            itemName: `${SEED_ITEM_PREFIX}Limelight 3 vision camera`,
            fundType: "STF" as const,
            stfBucketName: "Electronics",
            vendor: "Limelight",
            link: "https://example.com/limelight-3",
            partNumber: "LL3",
            quantity: 1,
            unitCostCents: 39_900,
            notes: null,
            status: "ordered" as const,
        },
        {
            itemName: `${SEED_ITEM_PREFIX}Polycarbonate sheet 1/4"`,
            fundType: "STF" as const,
            stfBucketName: "Mechanical",
            vendor: "TAP Plastics",
            link: "https://example.com/polycarbonate",
            partNumber: "PC-025",
            quantity: 2,
            unitCostCents: 6200,
            notes: "Bumper backing plate material",
            status: "approved" as const,
        },
        {
            itemName: `${SEED_ITEM_PREFIX}Kraken X60 motor controller`,
            fundType: "STF" as const,
            stfBucketName: "Electronics",
            vendor: "WCP",
            link: "https://example.com/kraken-x60",
            partNumber: "WCP-KRAKEN-X60",
            quantity: 2,
            unitCostCents: 14_900,
            notes: "Drivetrain motor controllers",
            status: "approved" as const,
        },
        {
            itemName: `${SEED_ITEM_PREFIX}NEO Vortex motor`,
            fundType: "STF" as const,
            stfBucketName: "Mechanical",
            vendor: "REV Robotics",
            link: "https://example.com/neo-vortex",
            partNumber: "REV-21-1651",
            quantity: 2,
            unitCostCents: 11_200,
            notes: null,
            status: "approved" as const,
        },
        {
            itemName: `${SEED_ITEM_PREFIX}Blue Nitrile gloves (case)`,
            fundType: "Gift" as const,
            stfBucketName: null,
            vendor: "Uline",
            link: "https://example.com/nitrile-gloves",
            partNumber: null,
            quantity: 1,
            unitCostCents: 3200,
            notes: "Pit safety supplies",
            status: "approved" as const,
        },
        {
            itemName: `${SEED_ITEM_PREFIX}Zip ties assortment`,
            fundType: "Gift" as const,
            stfBucketName: null,
            vendor: "Amazon",
            link: "https://example.com/zip-ties",
            partNumber: null,
            quantity: 3,
            unitCostCents: 1299,
            notes: "Cable management for robot and pit",
            status: "approved" as const,
        },
        {
            itemName: `${SEED_ITEM_PREFIX}VersaHub gearbox kit`,
            fundType: "STF" as const,
            stfBucketName: "Mechanical",
            vendor: "VEXPro",
            link: "https://example.com/versahub",
            partNumber: "217-7050",
            quantity: 1,
            unitCostCents: 8750,
            notes: "Elevator pivot gearbox",
            status: "approved" as const,
        },
        {
            itemName: `${SEED_ITEM_PREFIX}CAN wire spool`,
            fundType: "STF" as const,
            stfBucketName: "Electronics",
            vendor: "West Coast Products",
            link: "https://example.com/can-wire",
            partNumber: "WCP-CAN-50",
            quantity: 1,
            unitCostCents: 4500,
            notes: null,
            status: "pending" as const,
        },
        {
            itemName: `${SEED_ITEM_PREFIX}Over-budget titanium fastener`,
            fundType: "STF" as const,
            stfBucketName: "Mechanical",
            vendor: "McMaster-Carr",
            link: "https://example.com/titanium-bolt",
            partNumber: "91290A999",
            quantity: 1,
            unitCostCents: 99_900,
            notes: "Denied — use steel alternative",
            status: "denied" as const,
            denialComment: "Too expensive for this application. Resubmit with steel hardware.",
        },
        // Untriaged: submitted together as one batch, awaiting officer triage.
        {
            itemName: `${SEED_ITEM_PREFIX}M3 x 10mm standoff (100pk)`,
            fundType: null,
            stfBucketName: null,
            vendor: "McMaster-Carr",
            link: "https://example.com/m3-standoff",
            partNumber: "93657A101",
            quantity: 1,
            unitCostCents: 1899,
            notes: "Electronics board mounting",
            status: "pending" as const,
        },
        {
            itemName: `${SEED_ITEM_PREFIX}Heat shrink tubing kit`,
            fundType: null,
            stfBucketName: null,
            vendor: "Amazon",
            link: "https://example.com/heat-shrink",
            partNumber: null,
            quantity: 2,
            unitCostCents: 1299,
            notes: null,
            status: "pending" as const,
        },
        {
            itemName: `${SEED_ITEM_PREFIX}Loctite 242 threadlocker`,
            fundType: null,
            stfBucketName: null,
            vendor: "Grainger",
            link: "https://example.com/loctite-242",
            partNumber: "24221",
            quantity: 3,
            unitCostCents: 1150,
            notes: "Drivetrain fastener retention",
            status: "pending" as const,
        },
    ];

    if (adminUser && quarter && mechanical && electronics) {
        const reviewedAt = new Date("2025-10-15");
        const bucketByName = {
            Mechanical: mechanical.id,
            Electronics: electronics.id,
        };
        let inserted = 0;
        let reset = 0;

        for (const seed of seedOrders) {
            const stfBucketId =
                seed.fundType === "STF" && seed.stfBucketName
                    ? bucketByName[seed.stfBucketName as keyof typeof bucketByName]
                    : null;

            const values = {
                userId: adminUser.id,
                fundType: seed.fundType,
                batchId: seed.fundType === null ? UNTRIAGED_BATCH_ID : null,
                stfBucketId,
                quarterId: seed.fundType === "STF" ? quarter.id : null,
                vendor: seed.vendor,
                link: seed.link,
                itemName: seed.itemName,
                partNumber: seed.partNumber,
                quantity: seed.quantity,
                unitCostCents: seed.unitCostCents,
                notes: seed.notes,
                status: seed.status,
                denialComment: "denialComment" in seed ? seed.denialComment : null,
                reviewedBy: seed.status !== "pending" ? adminUser.id : null,
                reviewedAt: seed.status !== "pending" ? reviewedAt : null,
            };

            const exists = db.select().from(order).where(eq(order.itemName, seed.itemName)).get();
            if (exists) {
                db.update(order).set(values).where(eq(order.id, exists.id)).run();
                reset++;
                continue;
            }

            db.insert(order).values(values).run();
            inserted++;
        }

        const ordered = seedOrders.filter((o) => o.status === "ordered").length;
        const approved = seedOrders.filter((o) => o.status === "approved").length;
        const pending = seedOrders.filter((o) => o.status === "pending").length;
        const denied = seedOrders.filter((o) => o.status === "denied").length;
        const untriaged = seedOrders.filter((o) => o.fundType === null).length;

        if (inserted > 0 || reset > 0) {
            console.log(
                `Sample orders: ${inserted} inserted, ${reset} reset (${ordered} ordered, ${approved} approved, ${pending} pending incl. ${untriaged} untriaged, ${denied} denied).`
            );
        }
    }

    console.log("Seed complete.");
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
