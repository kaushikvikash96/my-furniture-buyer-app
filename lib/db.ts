import { PrismaClient } from "@prisma/client";

// One shared database connection for the whole app.
// The globalThis dance stops Next.js's hot-reloading from opening a new
// connection every time you save a file during development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
