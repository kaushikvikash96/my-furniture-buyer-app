/**
 * Fills the database with demo logins.
 * Run with:  npm run db:reset
 *
 * That's all this seeds now — products, orders, and balance all come live
 * from the furniture shop's own API (lib/cognitivo.ts), not from anything
 * stored locally. See architecture.md §7 for why.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const BUYERS = [
  { email: "buyer@shop.test", name: "Sam Okonjo", password: "furniture123" },
  { email: "alex@shop.test", name: "Alex Rivera", password: "furniture123" },
];

async function main() {
  await db.session.deleteMany();
  await db.user.deleteMany();

  for (const buyer of BUYERS) {
    await db.user.create({
      data: {
        email: buyer.email,
        name: buyer.name,
        // 10 salt rounds: the standard cost factor. Never store the password.
        passwordHash: await bcrypt.hash(buyer.password, 10),
      },
    });
  }

  console.log(
    `Seeded ${BUYERS.length} buyers.\n` +
      `Log in with:  ${BUYERS[0].email}  /  ${BUYERS[0].password}\n` +
      `Both act as the same real shop account — see architecture.md §7.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
