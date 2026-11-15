const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function createDirector() {
  const hash = await bcrypt.hash("Password123!", 12);
  try {
    const user = await prisma.user.create({
      data: {
        fullName: "System Director",
        email: "director@example.com",
        passwordHash: hash,
        role: "director",
      },
    });
    console.log("Director account created successfully!");
    console.log("Email: director@example.com");
    console.log("Password: Password123!");
  } catch (e) {
    console.log("Error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}
createDirector();
