const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function resetDeveloperPassword() {
  const hash = await bcrypt.hash("Developer123!", 12);
  try {
    // Find the developer account and update their password
    const user = await prisma.user.update({
      where: { email: "developer@example.com" },
      data: { passwordHash: hash, isActive: true },
    });
    console.log("Developer password reset successfully!");
    console.log("Email: developer@example.com");
    console.log("Password: Developer123!");
  } catch (e) {
    console.log("Error resetting password:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}
resetDeveloperPassword();
