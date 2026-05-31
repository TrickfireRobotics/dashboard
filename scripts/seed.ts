// Load env before any module that reads process.env at import time
// (auth.ts reads BETTER_AUTH_SECRET, db/index.ts reads DATABASE_PATH).
// Static ESM imports are hoisted, so we use dynamic imports inside main().
try {
    process.loadEnvFile(".env.local");
} catch {
    // No .env.local - rely on the ambient environment.
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
    const { auth } = await import("../src/lib/auth");
    const { db } = await import("../src/lib/db");
    const { team, user } = await import("../src/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    for (const name of TEAMS) {
        db.insert(team).values({ name }).onConflictDoNothing().run();
    }
    console.log(`Seeded ${TEAMS.length} teams.`);

    const email = process.env.SEED_ADMIN_EMAIL;
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
        .set({ role: "admin", isActive: true, emailVerified: true })
        .where(eq(user.email, email))
        .run();

    console.log(`Ensured ${email} has role=admin, isActive=true.`);
    console.log("Seed complete.");
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
