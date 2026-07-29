/**
 * Loads the real product catalogue from the shop's MongoDB into our own
 * database, replacing the placeholder products from seed.ts.
 *
 *   npm run db:import-catalog
 *
 * The connection string comes from CATALOG_MONGODB_URI in .env — it is never
 * hardcoded here, because this file is committed to git and .env is not.
 *
 * The app itself never talks to MongoDB. This is a one-way import, so the
 * running app stays a single SQLite file (architecture.md §2).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { MongoClient } from "mongodb";

const db = new PrismaClient();

/** Shape of a document in the source `catalog` collection. */
type CatalogDoc = {
  item_id?: string;
  product_name?: string;
  category?: string;
  price?: number;
  colours?: string[];
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  link?: string;
  image_url?: string; // base64-encoded image data, NOT a URL
  image_mime_type?: string;
};

/** Where the decoded images are written, and how the app refers to them. */
const IMAGE_DIR = path.join(process.cwd(), "public", "products");
const IMAGE_URL_PREFIX = "/products";

/**
 * Source prices are decimal numbers like 51.6, meaning 51 dollars 60 cents.
 * We store integer cents, so multiply and round — 51.6 * 100 is 5159.999...
 * in floating point, which is exactly the drift ADR-3 exists to avoid.
 */
function toCents(price: number): number {
  return Math.round(price * 100);
}

/**
 * The source `product_name` is generic ("Bar stool"), and dozens of products
 * share one. The product link carries the series name, so
 *   .../p/nordviken-bar-table-black-00368814/  ->  "Nordviken Bar table"
 * which makes the catalogue readable instead of a wall of duplicates.
 */
function buildName(doc: CatalogDoc): string {
  const productName = (doc.product_name ?? "").trim() || "Untitled product";
  const slug = /\/p\/([^/]+)\/?/.exec(doc.link ?? "")?.[1];
  const series = slug?.split("-")[0] ?? "";

  // Reject anything that isn't a plausible series name.
  if (series.length < 3 || /\d/.test(series)) return productName;

  const titled = series[0].toUpperCase() + series.slice(1).toLowerCase();
  // Don't produce "Billy Billy bookcase" if the name already starts with it.
  if (productName.toLowerCase().startsWith(titled.toLowerCase())) {
    return productName;
  }
  return `${titled} ${productName}`;
}

/** The source has no description, so build one from colours and dimensions. */
function buildDescription(doc: CatalogDoc): string {
  const parts: string[] = [];

  const colours = (doc.colours ?? []).filter(Boolean);
  if (colours.length > 0) {
    const readable = colours.join(", ");
    parts.push(readable[0].toUpperCase() + readable.slice(1));
  }

  const dims: string[] = [];
  if (doc.width != null) dims.push(`W${doc.width}`);
  if (doc.depth != null) dims.push(`D${doc.depth}`);
  if (doc.height != null) dims.push(`H${doc.height}`);
  if (dims.length > 0) parts.push(`${dims.join(" × ")} cm`);

  if (parts.length === 0) return doc.category ?? "Furniture";
  return parts.join(" · ");
}

function extensionFor(mimeType: string | undefined): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

/**
 * Images arrive as base64 data. Storing 66MB of base64 in the database would
 * bloat every query and every page; writing them to public/ keeps the database
 * small and lets the browser cache them like any other image.
 */
async function saveImage(doc: CatalogDoc, key: string): Promise<string | null> {
  if (!doc.image_url) return null;
  const extension = extensionFor(doc.image_mime_type);
  const fileName = `${key}.${extension}`;
  try {
    await writeFile(
      path.join(IMAGE_DIR, fileName),
      Buffer.from(doc.image_url, "base64"),
    );
    return `${IMAGE_URL_PREFIX}/${fileName}`;
  } catch {
    return null;
  }
}

async function main() {
  const uri = process.env.CATALOG_MONGODB_URI;
  if (!uri) {
    throw new Error(
      "CATALOG_MONGODB_URI is not set. Copy .env.example to .env and fill it in.",
    );
  }

  await mkdir(IMAGE_DIR, { recursive: true });

  const mongo = new MongoClient(uri, { serverSelectionTimeoutMS: 20000 });
  let imported = 0;
  let skipped = 0;
  const seenSourceIds: string[] = [];

  try {
    await mongo.connect();
    const collection = mongo.db().collection<CatalogDoc>("catalog");
    const total = await collection.countDocuments();
    console.log(`Reading ${total} products from the source catalogue…`);

    for await (const doc of collection.find({})) {
      const sourceId = (doc.item_id ?? "").trim();
      const price = doc.price;

      // Without an id or a price we can't order it, so it isn't useful to us.
      if (!sourceId || typeof price !== "number" || Number.isNaN(price)) {
        skipped++;
        continue;
      }

      const imageUrl = await saveImage(doc, sourceId);
      const fields = {
        name: buildName(doc),
        description: buildDescription(doc),
        category: (doc.category ?? "Uncategorised").trim(),
        priceCents: toCents(price),
        imageUrl: imageUrl ?? "",
        sourceUrl: doc.link ?? null,
      };

      // Update in place if we've imported this product before, so a re-run
      // doesn't delete rows that existing orders point at.
      const existing = await db.product.findFirst({
        where: { sourceId },
        select: { id: true },
      });

      if (existing) {
        await db.product.update({ where: { id: existing.id }, data: fields });
      } else {
        await db.product.create({ data: { ...fields, sourceId } });
      }

      seenSourceIds.push(sourceId);
      imported++;
      if (imported % 100 === 0) console.log(`  …${imported} imported`);
    }
  } finally {
    await mongo.close();
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

  const categories = await db.product.groupBy({
    by: ["category"],
    _count: { category: true },
    orderBy: { _count: { category: "desc" } },
  });

  console.log(
    `\nImported ${imported} products` +
      (skipped > 0 ? `, skipped ${skipped} without an id or price` : "") +
      (removedPlaceholders > 0
        ? `, removed ${removedPlaceholders} placeholder products`
        : "") +
      ".",
  );
  console.log(`Categories (${categories.length}):`);
  for (const c of categories.slice(0, 10)) {
    console.log(`  ${c._count.category.toString().padStart(4)}  ${c.category}`);
  }
  if (categories.length > 10) console.log(`  … and ${categories.length - 10} more`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
