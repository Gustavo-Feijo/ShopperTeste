import { PrismaClient } from "@prisma/client";
// Instanciate and export the prisma client.
const prisma = new PrismaClient();
export default prisma;