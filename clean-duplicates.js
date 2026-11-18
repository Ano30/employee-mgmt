const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function cleanDuplicates() {
  const locations = await prisma.location.findMany({ orderBy: { id: 'asc' } });
  const seen = new Set();
  let deletedCount = 0;

  for (const loc of locations) {
    const nameLower = loc.name.toLowerCase();
    if (seen.has(nameLower)) {
      await prisma.location.delete({ where: { id: loc.id } });
      deletedCount++;
      console.log(`Deleted duplicate: ${loc.name}`);
    } else {
      seen.add(nameLower);
    }
  }
  console.log(`Done! Deleted ${deletedCount} duplicates.`);
  await prisma.$disconnect();
}
cleanDuplicates();
