// Catalog and generator for the dev order dataset. Pure data, no db or env
// access, so seed.ts can import it statically.
//
// The shape here is tuned to match what production actually looks like:
// ~20 STF buckets, a dozen requesters, a few hundred orders, most of them
// submitted in big multi-item batches with very long vendor item names.

export type SeedStatus = "pending" | "approved" | "ordered" | "denied";
export type SeedFund = "STF" | "Gift";

export const SEED_BATCH_PREFIX = "seed-";

// baseBalanceCents is the bucket's allocation before anything is charged to
// it. The seed tops this up from the generated spend so the finance numbers
// stay coherent at any SEED_ORDER_COUNT - see bucketStartingBalances.
export const STF_BUCKETS: { name: string; baseBalanceCents: number }[] = [
    { name: "Mechanical", baseBalanceCents: 180_000 },
    { name: "Electronics", baseBalanceCents: 142_500 },
    { name: "Fasteners", baseBalanceCents: 96_000 },
    { name: "Aluminium Tubes & Bars", baseBalanceCents: 125_000 },
    { name: "Plastics & Elastomers", baseBalanceCents: 68_000 },
    { name: "Metal Manufacturing", baseBalanceCents: 110_000 },
    { name: "Wiring", baseBalanceCents: 42_000 },
    { name: "Electrical Components", baseBalanceCents: 73_500 },
    { name: "Electrical Controllers", baseBalanceCents: 58_000 },
    { name: "Electrical Tools", baseBalanceCents: 31_000 },
    { name: "Voltage Management", baseBalanceCents: 47_000 },
    { name: "Actuators, Motors, Gears, Belts, etc.", baseBalanceCents: 215_000 },
    { name: "Rods & Shafts", baseBalanceCents: 36_000 },
    { name: "Bearings & Bushings", baseBalanceCents: 28_500 },
    { name: "Life Detection Mission", baseBalanceCents: 64_000 },
    { name: "Autonomous", baseBalanceCents: 52_000 },
    { name: "Drone", baseBalanceCents: 81_000 },
    { name: "Science Payload", baseBalanceCents: 44_000 },
    { name: "Adhesives & Consumables", baseBalanceCents: 15_500 },
    { name: "Safety & Pit Supplies", baseBalanceCents: 22_000 },
    // Edge cases worth keeping around: an empty bucket and a nearly-empty one
    // exercise the over-budget styling as soon as anything is charged to them.
    { name: "Software", baseBalanceCents: 0 },
    { name: "Outreach & Marketing", baseBalanceCents: 1_250 },
];

// Matches the seeded finance settings (11% tax + 20% shipping). Only used to
// size bucket allocations; the app itself computes charges from the stored
// settings via stfOrderTotalCents.
const CHARGE_MULTIPLIER = 1.31;

/**
 * Sizes each bucket's starting balance against what the generated orders
 * actually charge to it, so most buckets land with a plausible amount unused
 * and a couple end up over budget on purpose.
 */
export function bucketStartingBalances(orders: GeneratedOrder[]): Map<string, number> {
    const spend = new Map<string, number>();
    for (const o of orders) {
        if (o.fundType !== "STF" || !o.bucketName) continue;
        if (o.status !== "approved" && o.status !== "ordered") continue;
        spend.set(
            o.bucketName,
            (spend.get(o.bucketName) ?? 0) + o.quantity * o.unitCostCents * CHARGE_MULTIPLIER
        );
    }

    const balances = new Map<string, number>();
    STF_BUCKETS.forEach((bucket, index) => {
        const charged = spend.get(bucket.name) ?? 0;
        // Every fifth bucket with real spend is deliberately underfunded.
        const headroom = charged > 0 && index % 5 === 3 ? 0.82 : 1.1 + ((index * 7) % 6) * 0.1;
        const total = bucket.baseBalanceCents + charged * headroom;
        balances.set(bucket.name, Math.round(total / 100) * 100);
    });
    return balances;
}

// Data-only members. They cannot sign in; they exist so the tables show a
// realistic spread of requesters instead of one admin submitting everything.
export const SEED_MEMBERS: { id: string; name: string; email: string }[] = [
    { id: "seed-user-01", name: "Daniel Shilov", email: "dshilov@seed.local" },
    { id: "seed-user-02", name: "Luke Matthews", email: "lmatthews@seed.local" },
    { id: "seed-user-03", name: "Calin Prutean", email: "cprutean@seed.local" },
    { id: "seed-user-04", name: "Tee Trahan", email: "ttrahan@seed.local" },
    { id: "seed-user-05", name: "Kaitlin Nguyen", email: "knguyen@seed.local" },
    { id: "seed-user-06", name: "Alex Sing", email: "asing@seed.local" },
    { id: "seed-user-07", name: "Priya Raghunathan", email: "praghunathan@seed.local" },
    { id: "seed-user-08", name: "Marcus Oyelaran", email: "moyelaran@seed.local" },
    { id: "seed-user-09", name: "Sofia Berg", email: "sberg@seed.local" },
    { id: "seed-user-10", name: "Julian Doliov", email: "jdoliov@seed.local" },
    { id: "seed-user-11", name: "Hana Watanabe", email: "hwatanabe@seed.local" },
    { id: "seed-user-12", name: "Owen Castellanos", email: "ocastellanos@seed.local" },
];

type CatalogItem = {
    name: string;
    vendor: string;
    bucket: string;
    minCents: number;
    maxCents: number;
    partNumber?: string;
};

// Long names are deliberate: production is full of pasted Amazon titles and
// they are what makes the table layout hard.
export const ITEM_CATALOG: CatalogItem[] = [
    {
        name: "1/4-20 Black-Oxide Alloy Steel Socket Head Screw",
        vendor: "McMaster-Carr",
        bucket: "Fasteners",
        minCents: 750,
        maxCents: 4_600,
        partNumber: "91290A115",
    },
    {
        name: "High-Strength Steel Hex Nut, Grade 8, 1/4-20 Thread",
        vendor: "McMaster-Carr",
        bucket: "Fasteners",
        minCents: 900,
        maxCents: 2_400,
        partNumber: "95505A140",
    },
    {
        name: "Low-Strength Steel Nylon-Insert Locknut",
        vendor: "McMaster-Carr",
        bucket: "Fasteners",
        minCents: 600,
        maxCents: 1_900,
        partNumber: "90631A009",
    },
    {
        name: "300 Pieces M3 Stainless Steel Split Lock Washers, 304 Stainless Steel Spring Lock Washers for Screws Bolts, Silver",
        vendor: "Amazon",
        bucket: "Fasteners",
        minCents: 800,
        maxCents: 1_500,
    },
    {
        name: "1120PCS M3 Socket Screws Assortment Kit, M3x6/8/10/12/16/20/25/30 mm Hex Head Cap Screws with Storage Case",
        vendor: "Amazon",
        bucket: "Fasteners",
        minCents: 1_300,
        maxCents: 2_200,
    },
    {
        name: "560PCS M4 Socket Head Screws Assortment Kit, M4x6/8/10/12/16/20/30 mm",
        vendor: "Amazon",
        bucket: "Fasteners",
        minCents: 1_100,
        maxCents: 1_900,
    },
    {
        name: '110 Pieces 1/4" Stainless Flat Washers, 3/4" Outside Diameter, 0.055" Thickness, 304 Stainless Steel Fender Washers for Screws Bolts',
        vendor: "Amazon",
        bucket: "Fasteners",
        minCents: 1_000,
        maxCents: 1_800,
    },
    {
        name: "Corrosion-Resistant 18-8 Stainless Steel Female Threaded Hex Standoff",
        vendor: "McMaster-Carr",
        bucket: "Fasteners",
        minCents: 1_600,
        maxCents: 5_500,
        partNumber: "93657A101",
    },
    {
        name: "Lightweight Aluminum Female Threaded Hex Standoff, M3 x 0.5 mm Thread",
        vendor: "McMaster-Carr",
        bucket: "Fasteners",
        minCents: 1_400,
        maxCents: 3_900,
    },
    {
        name: '3/16" x 3/8" Aluminum Blind Pop Rivets with Steel Mandrel (180-Pack)',
        vendor: "Home Depot",
        bucket: "Fasteners",
        minCents: 1_500,
        maxCents: 3_200,
    },
    {
        name: 'Multipurpose 6061 Aluminum Round Tube, 1" OD x 0.125" Wall, 6 ft Length',
        vendor: "Online Metals",
        bucket: "Aluminium Tubes & Bars",
        minCents: 6_500,
        maxCents: 68_000,
        partNumber: "OM-6061-RT",
    },
    {
        name: 'Multipurpose 6061 Aluminum Rectangular Tube, 2" x 1" x 0.125" Wall',
        vendor: "Online Metals",
        bucket: "Aluminium Tubes & Bars",
        minCents: 5_800,
        maxCents: 42_000,
    },
    {
        name: 'Architectural 6063 Aluminum U-Channel, 1-1/2" Base x 1" Legs',
        vendor: "McMaster-Carr",
        bucket: "Aluminium Tubes & Bars",
        minCents: 9_200,
        maxCents: 41_000,
        partNumber: "1630T32",
    },
    {
        name: 'Multipurpose 6061 Aluminum Rod, 3/4" Diameter, 3 ft Length',
        vendor: "Online Metals",
        bucket: "Aluminium Tubes & Bars",
        minCents: 2_200,
        maxCents: 9_800,
    },
    {
        name: '1/8" Aluminum Sheet 6061-T6 (24" x 24")',
        vendor: "Online Metals",
        bucket: "Metal Manufacturing",
        minCents: 14_000,
        maxCents: 58_000,
    },
    {
        name: 'High-Strength 2024 Aluminum Disc, 6" Diameter x 1/2" Thick',
        vendor: "McMaster-Carr",
        bucket: "Metal Manufacturing",
        minCents: 11_000,
        maxCents: 26_000,
    },
    {
        name: "Waterjet Cutting Service - Chassis Gusset Set (DXF supplied)",
        vendor: "SendCutSend",
        bucket: "Metal Manufacturing",
        minCents: 18_000,
        maxCents: 72_000,
    },
    {
        name: 'Polycarbonate Sheet 48 x 96 x 1/16" Clear Plastic, Plexiglass Replacement',
        vendor: "TAP Plastics",
        bucket: "Plastics & Elastomers",
        minCents: 8_900,
        maxCents: 21_000,
        partNumber: "PC-1-16",
    },
    {
        name: 'Polycarbonate Sheet 12 x 12 x 1/8 0.118" Clear Plastic, Replaces Plexiglass',
        vendor: "Amazon",
        bucket: "Plastics & Elastomers",
        minCents: 1_100,
        maxCents: 4_200,
    },
    {
        name: 'Metal-Backed Polyurethane Rubber Sheet, 1/4" Thick, 12" x 24"',
        vendor: "McMaster-Carr",
        bucket: "Plastics & Elastomers",
        minCents: 12_000,
        maxCents: 29_000,
    },
    {
        name: 'Cambric Mesh Dust Cover Black Fabric for Underside Repair Furniture Upholstery DIY Crafting / 40" Wide / Sold By The Yard (Black, 40" x 108" (3 yards))',
        vendor: "Amazon",
        bucket: "Plastics & Elastomers",
        minCents: 1_200,
        maxCents: 2_600,
    },
    {
        name: "High-Temperature Silicone Rubber Grommet Assortment",
        vendor: "McMaster-Carr",
        bucket: "Plastics & Elastomers",
        minCents: 1_400,
        maxCents: 3_800,
    },
    {
        name: "Oil-Resistant Soft Buna-N O-Rings, AS568 Assortment Kit",
        vendor: "McMaster-Carr",
        bucket: "Plastics & Elastomers",
        minCents: 1_800,
        maxCents: 4_400,
    },
    {
        name: "OVERTURE High Speed PETG Filament 1.75mm, 1kg Spool",
        vendor: "Amazon",
        bucket: "Plastics & Elastomers",
        minCents: 1_700,
        maxCents: 3_100,
    },
    {
        name: "BNTECHGO 22 Gauge Silicone Wire Spool 50 ft Flexible 22 AWG Stranded Tinned Copper Wire",
        vendor: "Amazon",
        bucket: "Wiring",
        minCents: 1_400,
        maxCents: 2_400,
    },
    {
        name: "ELFCULB 5 Pairs Amass XT90H 2+2 Connectors for Robotics and RC Models",
        vendor: "Amazon",
        bucket: "Wiring",
        minCents: 1_600,
        maxCents: 3_400,
    },
    {
        name: "TICONN 120 Pcs Heat Shrink Wire Connectors, Marine Crimp Ring Terminal Kit",
        vendor: "Amazon",
        bucket: "Wiring",
        minCents: 1_200,
        maxCents: 2_600,
    },
    {
        name: 'Joinfworld Power Distribution Block Bus Bar 12V 250A with 4 x 5/16"(M8) Studs Marine Bus Bar 12 Volt DC Battery Busbar Terminal Block for Automotive, Car, Boat, Solar Wiring - Negative&Positive',
        vendor: "Amazon",
        bucket: "Electrical Components",
        minCents: 4_800,
        maxCents: 7_900,
    },
    {
        name: "50 mm Fan Filters with Aluminum Mesh (10 Pack)",
        vendor: "Digi-Key",
        bucket: "Electrical Components",
        minCents: 600,
        maxCents: 1_800,
    },
    {
        name: "Waveshare SN65HVD230 CAN Board Connecting MCUs to CAN Network Features ESD Protection Communication Evaluation Development Board 3.3V [2 PCS]",
        vendor: "Amazon",
        bucket: "Electrical Controllers",
        minCents: 1_900,
        maxCents: 3_600,
    },
    {
        name: "3PCS ESP32-S3 Development Board Type-C WiFi + Bluetooth Dual Type-C Core Board ESP32-S3-DevKit N16R8",
        vendor: "Amazon",
        bucket: "Electrical Controllers",
        minCents: 2_200,
        maxCents: 4_100,
    },
    {
        name: "Teensy 4.1 Development Board with Ethernet Kit",
        vendor: "PJRC",
        bucket: "Electrical Controllers",
        minCents: 3_200,
        maxCents: 5_600,
    },
    {
        name: "200A High Precision Power Analyzer Multi Meter for Measuring Voltage, Current and Watt-Hours",
        vendor: "Amazon",
        bucket: "Electrical Tools",
        minCents: 2_100,
        maxCents: 3_600,
    },
    {
        name: "T18 Soldering Tips For HAKKO FX-888D FX-888 FX-8801 FX-600 (10 pcs tip set)",
        vendor: "Amazon",
        bucket: "Electrical Tools",
        minCents: 2_200,
        maxCents: 3_400,
    },
    {
        name: "Flex Tools 24V 8.0Ah Lithium-Ion Battery FX0221-1",
        vendor: "Lowe's",
        bucket: "Voltage Management",
        minCents: 17_000,
        maxCents: 24_000,
    },
    {
        name: "Amazon Basics 48-Count AA & AAA High-Performance Alkaline Batteries Value Pack, 24 AA and 24 AAA",
        vendor: "Amazon",
        bucket: "Voltage Management",
        minCents: 2_000,
        maxCents: 3_200,
    },
    {
        name: "AK45-36 V3.0 KV80 Quasi-Direct-Drive Actuator Module",
        vendor: "CubeMars",
        bucket: "Actuators, Motors, Gears, Belts, etc.",
        minCents: 68_000,
        maxCents: 94_000,
    },
    {
        name: "DC 6V 12V 24V Micro Electric Linear Actuator 50MM Max Thrust 42 lbs 188N 19Kgs (Model 0041645)",
        vendor: "Amazon",
        bucket: "Actuators, Motors, Gears, Belts, etc.",
        minCents: 5_900,
        maxCents: 9_200,
    },
    {
        name: "3417 Series 5mm HTD Pitch Set-Screw Pinion Timing Belt Pulley (6mm D-Bore, 16 Tooth)",
        vendor: "goBILDA",
        bucket: "Actuators, Motors, Gears, Belts, etc.",
        minCents: 1_100,
        maxCents: 3_400,
        partNumber: "3417-0016-0006",
    },
    {
        name: "Corrosion-Resistant Timing Belt Pulley XL Series, Hub, 2 Flanges, 9.5mm Maximum Belt Width, 25mm OD",
        vendor: "McMaster-Carr",
        bucket: "Actuators, Motors, Gears, Belts, etc.",
        minCents: 1_800,
        maxCents: 4_200,
    },
    {
        name: "Brushed 12V DC Gear Motor 0.13 Kg.cm / 947 RPM w/ 4.75:1 Planetary Gearbox",
        vendor: "ServoCity",
        bucket: "Actuators, Motors, Gears, Belts, etc.",
        minCents: 800,
        maxCents: 4_900,
    },
    {
        name: "Flanged Ball Bearing, 1/2 in. Hex ID, 1.125 in. OD, Shielded (FR8ZZ-HexHD)",
        vendor: "goBILDA",
        bucket: "Bearings & Bushings",
        minCents: 1_600,
        maxCents: 4_700,
    },
    {
        name: 'Corrosion-Resistant 440C Stainless Steel Ball Bearing Shielded, Trade Number R6-2Z, 3/8" Shaft Diameter',
        vendor: "McMaster-Carr",
        bucket: "Bearings & Bushings",
        minCents: 2_100,
        maxCents: 5_300,
    },
    {
        name: 'D-Profile Rotary Shaft, 1045 Carbon Steel, 3/8" Diameter, 6" Long',
        vendor: "McMaster-Carr",
        bucket: "Rods & Shafts",
        minCents: 1_000,
        maxCents: 3_400,
    },
    {
        name: 'Set Screw Precision Flexible Shaft Coupling, Spiral Cut, for 7/16" x 3/8" Shaft, 1-1/4" Long, 1-1/4" OD',
        vendor: "McMaster-Carr",
        bucket: "Rods & Shafts",
        minCents: 9_800,
        maxCents: 14_000,
    },
    {
        name: "Adafruit VL53L4CD Time of Flight Distance Sensor - ~1 to 1300mm - STEMMA QT / Qwiic",
        vendor: "Adafruit",
        bucket: "Life Detection Mission",
        minCents: 1_800,
        maxCents: 3_000,
        partNumber: "5396",
    },
    {
        name: "Capacitive Soil Moisture Sensor v2.0 with Corrosion-Resistant Coating",
        vendor: "DFRobot",
        bucket: "Life Detection Mission",
        minCents: 3_400,
        maxCents: 5_200,
    },
    {
        name: '3/4" x 6" Ship Auger Bit for Regolith Sampling',
        vendor: "Home Depot",
        bucket: "Life Detection Mission",
        minCents: 2_900,
        maxCents: 4_800,
    },
    {
        name: "Micro Limit Switch (Bump Lever) - 2 Pack",
        vendor: "Pololu",
        bucket: "Life Detection Mission",
        minCents: 400,
        maxCents: 1_400,
    },
    {
        name: "Intel RealSense Depth Camera D435if with Mounting Bracket",
        vendor: "Mouser",
        bucket: "Autonomous",
        minCents: 32_000,
        maxCents: 41_000,
    },
    {
        name: "Hollyland LARK A2 Mini Duo (2TX + 1RX) Wireless Microphone, Noise Canceling",
        vendor: "B&H",
        bucket: "Autonomous",
        minCents: 5_200,
        maxCents: 8_400,
    },
    {
        name: "Hall Effect Sensor Module DRV5032 30kHz Open Drain Digital Output Board",
        vendor: "Amazon",
        bucket: "Autonomous",
        minCents: 700,
        maxCents: 1_900,
    },
    {
        name: "Rigid Lightweight Carbon Fiber Round Tube, 20mm OD x 18mm ID, 1000mm",
        vendor: "Dragon Plate",
        bucket: "Drone",
        minCents: 28_000,
        maxCents: 49_000,
    },
    {
        name: "T-Motor MN505-S KV320 Brushless Motor for Heavy-Lift Multirotor",
        vendor: "GetFPV",
        bucket: "Drone",
        minCents: 11_000,
        maxCents: 18_000,
    },
    {
        name: "Spectrometer Breakout - AS7341 11-Channel Visible Light Sensor",
        vendor: "SparkFun",
        bucket: "Science Payload",
        minCents: 2_600,
        maxCents: 4_900,
    },
    {
        name: "Peltier Thermoelectric Cooler Module TEC1-12706 with Heatsink (4 Pack)",
        vendor: "Amazon",
        bucket: "Science Payload",
        minCents: 1_900,
        maxCents: 3_700,
    },
    {
        name: "Loctite 88442 Red 272 High Temperature/Strength Thread Locker, 50 mL Bottle",
        vendor: "Grainger",
        bucket: "Adhesives & Consumables",
        minCents: 3_400,
        maxCents: 5_100,
        partNumber: "24221",
    },
    {
        name: "3-Pack Duct Tape Heavy Duty Black Waterproof, 66 Yards x 1.88 Inch Total Strong Adhesive Duct Tape No Residue Bulk for Home Use, DIY, Projects, Outdoor Repairs Tear by Hand",
        vendor: "Amazon",
        bucket: "Adhesives & Consumables",
        minCents: 900,
        maxCents: 1_800,
    },
    {
        name: "Blue Painters Tape 1 Inch Wide, 2 Rolls Masking Tape 0.98 in x 55 Yd, No Residue, Easy Tear Paint Tape for Wall Painting, DIY, Window Masking, Home Improvement",
        vendor: "Amazon",
        bucket: "Adhesives & Consumables",
        minCents: 1_100,
        maxCents: 2_000,
    },
    {
        name: "Blue Nitrile Disposable Gloves, 6 mil, Powder-Free (Case of 1000)",
        vendor: "Uline",
        bucket: "Safety & Pit Supplies",
        minCents: 2_800,
        maxCents: 4_600,
    },
    {
        name: "Safety Glasses, Clear Anti-Fog Lens, ANSI Z87.1 (12 Pack)",
        vendor: "Uline",
        bucket: "Safety & Pit Supplies",
        minCents: 2_200,
        maxCents: 3_900,
    },
    {
        name: 'Cuttable Gasket Strip Material, Closed-Cell Neoprene, 1/4" Thick',
        vendor: "McMaster-Carr",
        bucket: "Safety & Pit Supplies",
        minCents: 1_200,
        maxCents: 2_400,
    },
];

const NOTES = [
    null,
    null,
    null,
    "Needed before the next build weekend.",
    "Replacement for the one we stripped during assembly.",
    "Drivetrain fastener retention.",
    "Spare stock, we keep running out mid-session.",
    "Same part as last order, quantity bumped.",
    "Checked with the mech leads, this is the right size.",
    "Long lead time, ordering early.",
    null,
    "For the competition spares kit.",
];

const DENIAL_COMMENTS = [
    "Too expensive for this application. Resubmit with a steel alternative.",
    "We already have these in the pit cabinet, check before reordering.",
    "Duplicate of another request in this batch.",
    "Out of budget for this quarter, resubmit after the next STF cycle.",
];

// Deterministic PRNG so repeated seeds produce the same dataset.
function mulberry32(seed: number) {
    let a = seed >>> 0;
    return function next() {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export type GeneratedOrder = {
    userIndex: number; // -1 means the admin account
    fundType: SeedFund | null;
    bucketName: string | null;
    vendor: string;
    link: string;
    itemName: string;
    partNumber: string | null;
    quantity: number;
    unitCostCents: number;
    notes: string | null;
    status: SeedStatus;
    denialComment: string | null;
    batchId: string;
    createdAt: Date;
};

// Each batch lands in one of these states. The weights are tuned so the
// generated mix is roughly double what production carries in every section:
// a deep triage pile, a deeper review pile, and a long ordered archive.
const BATCH_STATES: {
    weight: number;
    status: SeedStatus;
    triaged: boolean;
    minDaysAgo: number;
    maxDaysAgo: number;
}[] = [
    { weight: 18, status: "pending", triaged: false, minDaysAgo: 0, maxDaysAgo: 30 },
    { weight: 25, status: "pending", triaged: true, minDaysAgo: 2, maxDaysAgo: 45 },
    { weight: 10, status: "approved", triaged: true, minDaysAgo: 18, maxDaysAgo: 70 },
    { weight: 43, status: "ordered", triaged: true, minDaysAgo: 40, maxDaysAgo: 240 },
    { weight: 9, status: "denied", triaged: false, minDaysAgo: 8, maxDaysAgo: 200 },
];

/**
 * Builds a production-shaped order dataset: orders arrive in dated batches from
 * a dozen requesters, older batches have already been ordered, recent ones are
 * still waiting on triage or review.
 */
export function generateSeedOrders({
    count = 260,
    seed = 20260101,
    now = new Date(),
}: {
    count?: number;
    seed?: number;
    now?: Date;
} = {}): GeneratedOrder[] {
    const rand = mulberry32(seed);
    const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
    const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

    const totalWeight = BATCH_STATES.reduce((sum, s) => sum + s.weight, 0);
    const pickState = () => {
        let roll = rand() * totalWeight;
        for (const state of BATCH_STATES) {
            roll -= state.weight;
            if (roll <= 0) return state;
        }
        return BATCH_STATES[BATCH_STATES.length - 1];
    };

    const orders: GeneratedOrder[] = [];
    let batchIndex = 0;

    while (orders.length < count) {
        batchIndex++;

        // Most submissions are a part or two; every so often somebody dumps a
        // whole BOM in at once, which is what makes production tables long.
        const roll = rand();
        const batchSize = roll < 0.45 ? between(1, 2) : roll < 0.8 ? between(3, 6) : between(9, 18);

        // The admin submits a slice of the orders so "Your orders" is not empty.
        const userIndex = rand() < 0.18 ? -1 : between(0, SEED_MEMBERS.length - 1);

        const { status, triaged: baseTriaged, minDaysAgo, maxDaysAgo } = pickState();
        // A denied order may or may not have been triaged before it was refused.
        const triaged = status === "denied" ? rand() < 0.5 : baseTriaged;

        const daysAgo = between(minDaysAgo, maxDaysAgo);
        const createdAt = new Date(now.getTime() - daysAgo * 86_400_000);
        createdAt.setHours(between(9, 23), between(0, 59), between(0, 59), 0);

        const batchId = `${SEED_BATCH_PREFIX}batch-${String(batchIndex).padStart(4, "0")}`;

        for (let i = 0; i < batchSize && orders.length < count; i++) {
            const item = pick(ITEM_CATALOG);
            // Gift fund covers the odds and ends that do not fit an STF bucket.
            const useGift = triaged && rand() < 0.12;
            const fundType: SeedFund | null = triaged ? (useGift ? "Gift" : "STF") : null;

            orders.push({
                userIndex,
                fundType,
                bucketName: fundType === "STF" ? item.bucket : null,
                vendor: item.vendor,
                link: `https://example.com/${item.vendor.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/${batchIndex}-${i}`,
                itemName: item.name,
                partNumber: item.partNumber ?? null,
                quantity: rand() < 0.65 ? 1 : between(2, 12),
                unitCostCents: between(item.minCents, item.maxCents),
                notes: pick(NOTES),
                status,
                denialComment: status === "denied" ? pick(DENIAL_COMMENTS) : null,
                batchId,
                createdAt,
            });
        }
    }

    return orders;
}
