/**
 * Fills the database with demo logins and a placeholder furniture catalogue.
 * Run with:  npm run db:reset
 *
 * PLACEHOLDER DATA — the products here are invented so the app has something
 * real-looking to show. Replace the PRODUCTS array below with the real
 * catalogue when it's ready; nothing else needs to change.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// Prices are in CENTS, never dollars — see architecture.md ADR-3.
// $1,299.00 is written as 129900.
const PRODUCTS = [
  {
    name: "Aalto Two-Seat Sofa",
    description:
      "Low-slung oak frame with a boucle seat. Ships flat, assembles in ten minutes.",
    category: "Seating",
    priceCents: 129900,
  },
  {
    name: "Larkin Wingback Armchair",
    description: "Deep buttoned back in olive velvet, solid beech legs.",
    category: "Seating",
    priceCents: 74500,
  },
  {
    name: "Pell Stacking Chair",
    description: "Powder-coated steel, stacks six high. Indoor or covered outdoor.",
    category: "Seating",
    priceCents: 8900,
  },
  {
    name: "Harlow Dining Table",
    description: "Two-metre solid ash top on a trestle base. Seats eight.",
    category: "Tables",
    priceCents: 189000,
  },
  {
    name: "Nook Round Café Table",
    description: "700mm marble-effect top, weighted pedestal base.",
    category: "Tables",
    priceCents: 32900,
  },
  {
    name: "Brim Nesting Coffee Tables",
    description: "Set of two, walnut veneer with a brushed brass rim.",
    category: "Tables",
    priceCents: 45000,
  },
  {
    name: "Kestrel Six-Drawer Dresser",
    description: "Soft-close runners, hand-finished birch, ten-year frame warranty.",
    category: "Storage",
    priceCents: 96500,
  },
  {
    name: "Ledger Open Shelving Unit",
    description: "Five bays of blackened steel and reclaimed pine. Wall-fixed.",
    category: "Storage",
    priceCents: 58000,
  },
  {
    name: "Muster Hallway Bench",
    description: "Slatted seat over two woven baskets. Compact 900mm footprint.",
    category: "Storage",
    priceCents: 27500,
  },
  {
    name: "Thistle Floor Lamp",
    description: "Adjustable brass arm, linen drum shade, dimmable LED included.",
    category: "Lighting",
    priceCents: 21900,
  },
  {
    name: "Halyard Pendant Cluster",
    description: "Three hand-blown smoked glass globes on braided cord.",
    category: "Lighting",
    priceCents: 39500,
  },
  {
    name: "Ember Reading Sconce",
    description: "Plug-in wall light with a pivoting head. No wiring needed.",
    category: "Lighting",
    priceCents: 12400,
  },
];

const BUYERS = [
  {
    email: "buyer@shop.test",
    name: "Sam Okonjo",
    password: "furniture123",
    // $50,000.00 to spend
    budgetCents: 5_000_000,
  },
  {
    email: "alex@shop.test",
    name: "Alex Rivera",
    password: "furniture123",
    // $12,000.00 — a tighter budget, useful for demoing the rejection
    budgetCents: 1_200_000,
  },
];

/** A stable placeholder photo per product, so the grid looks like a real shop. */
function imageUrlFor(name: string): string {
  const seed = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `https://picsum.photos/seed/${seed}/600/450`;
}

async function main() {
  // Order matters: children before parents, because of the relations.
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.session.deleteMany();
  await db.product.deleteMany();
  await db.user.deleteMany();

  for (const buyer of BUYERS) {
    await db.user.create({
      data: {
        email: buyer.email,
        name: buyer.name,
        budgetCents: buyer.budgetCents,
        // 10 salt rounds: the standard cost factor. Never store the password.
        passwordHash: await bcrypt.hash(buyer.password, 10),
      },
    });
  }

  await db.product.createMany({
    data: PRODUCTS.map((p) => ({ ...p, imageUrl: imageUrlFor(p.name) })),
  });

  console.log(
    `Seeded ${BUYERS.length} buyers and ${PRODUCTS.length} products.\n` +
      `Log in with:  ${BUYERS[0].email}  /  ${BUYERS[0].password}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
