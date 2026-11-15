const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function createDeveloper() {
  const hash = await bcrypt.hash("Developer123!", 12);
  try {
    const user = await prisma.user.create({
      data: {
        fullName: "System Developer",
        email: "developer@example.com",
        passwordHash: hash,
        role: "developer",
      },
    });
    console.log("Developer account created successfully!");
    console.log("Email: developer@example.com");
    console.log("Password: Developer123!");
  } catch (e) {
    console.log("Error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}
createDeveloper();
