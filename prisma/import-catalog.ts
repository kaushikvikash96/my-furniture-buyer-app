/**
 * Optional: snapshots the shop's catalogue into our local database.
 *
 *   npm run db:import-catalog
 *
 * The catalogue page now fetches live from the shop's API on every view
 * (see lib/cognitivo.ts and app/catalogue/page.tsx) — this script is no
 * longer what powers the home page. It's still useful for:
 *   - Browsing the catalogue offline in Prisma Studio (`npm run db:studio`)
 *   - A fallback snapshot if the live API is ever unreachable
 *   - Pre-populating Product rows so "Add to order" has zero first-click
 *     latency (the order flow lazily creates a row from the live API on
 *     first add anyway, so this is a convenience, not a requirement)
 *
 * See architecture.md §7 for the full picture of how the live catalogue
 * page and this script now relate.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { fetchAllProducts, toDisplayProduct } from "../lib/cognitivo";

const db = new PrismaClient();

/** Kept only so previously-imported photos aren't orphaned — this script
 * no longer writes here itself (the live API never returns images). */
const IMAGE_DIR = path.join(process.cwd(), "public", "products");

async function main() {
  await mkdir(IMAGE_DIR, { recursive: true });

  console.log("Reading products from the shop's catalogue API…");
  const items = await fetchAllProducts();

  let imported = 0;
  let skipped = 0;

  for (const item of items) {
    const sourceId = (item.item_id ?? "").trim();
    if (!sourceId || typeof item.price !== "number" || Number.isNaN(item.price)) {
      skipped++;
      continue;
    }

    const { sourceId: _ignore, ...fields } = toDisplayProduct(item);

    // Update in place if we've imported this product before, so a re-run
    // doesn't delete rows that existing orders point at.
    const existing = await db.product.findFirst({
      where: { sourceId },
      select: { id: true },
    });

    if (existing) {
      // The live API never returns an image. Don't blank out a photo we
      // already have from an earlier import.
      const { imageUrl: _skipImage, ...rest } = fields;
      await db.product.update({ where: { id: existing.id }, data: rest });
    } else {
      await db.product.create({ data: { ...fields, sourceId } });
    }

    imported++;
    if (imported % 100 === 0) console.log(`  …${imported} imported`);
  }

  // Remove the placeholder products (they have no sourceId). Any draft order
  // lines pointing at them go too — a draft is a work in progress, and the
  // products it referenced no longer exist.
  const placeholders = await db.product.findMany({
    where: { sourceId: null },
    select: { id: true },
  });

  let removedPlaceholders = 0;
  if (placeholders.length > 0) {
    const ids = placeholders.map((p) => p.id);
    const blocking = await db.orderItem.findMany({
      where: { productId: { in: ids }, order: { status: "PLACED" } },
      select: { id: true },
    });

    if (blocking.length > 0) {
      // Placed orders are history — we don't delete history to tidy up a table.
      console.log(
        `Keeping ${placeholders.length} placeholder products: ${blocking.length} placed order line(s) still reference them.`,
      );
    } else {
      await db.orderItem.deleteMany({ where: { productId: { in: ids } } });
      const result = await db.product.deleteMany({ where: { sourceId: null } });
      removedPlaceholders = result.count;
    }
  }

  console.log(
    `\nImported ${imported} products` +
      (skipped > 0 ? `, skipped ${skipped} without an id or price` : "") +
      (removedPlaceholders > 0
        ? `, removed ${removedPlaceholders} placeholder products`
        : "") +
      ".",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
