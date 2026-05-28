// lib/prisma.js — Prisma 5 (simples)
import { PrismaClient } from '@prisma/client';

let prisma;
if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global._prisma) global._prisma = new PrismaClient();
  prisma = global._prisma;
}
export default prisma;
