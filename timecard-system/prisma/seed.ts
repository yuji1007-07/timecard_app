import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "../src/lib/seed-data";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 シード開始...");
  const counts = await seedDatabase(prisma);
  console.log("✅ シード完了", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
