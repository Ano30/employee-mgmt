import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { authenticate, requireRole } from "../auth/middleware";

export const directorRouter = Router();

// Get all employees for a specific company (Director & HR)
directorRouter.get("/all-employees", authenticate, requireRole("director", "hr"), async (req, res) => {
  const companyId = (req as any).user.companyId;
  try {
    const employees = await prisma.employee.findMany({
      where: { user: { companyId: companyId } },
      include: {
        user: { select: { fullName: true, email: true, role: true } },
        location: { select: { name: true } },
        // Fetch the full latest attendance log including GPS
        attendance: { orderBy: { clockedAt: "desc" }, take: 1 },
        leaves: { where: { status: "approved" } }
      }
    });
    res.json(employees);
  } catch (e) {
    res.status(500).json({ error: "FAILED_TO_FETCH_EMPLOYEES" });
  }
});

// Change any employee's password (For Director/HR)
directorRouter.post("/change-password", authenticate, requireRole("director", "hr"), async (req, res) => {
  const { userId, newPassword } = req.body;
  try {
    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash }
    });
    res.json({ message: "Password updated successfully" });
  } catch (e) {
    res.status(500).json({ error: "FAILED_TO_UPDATE_PASSWORD" });
  }
});

// Add a new HR or Supervisor (used by Director)
directorRouter.post("/users", authenticate, requireRole("director"), async (req, res) => {
  const { fullName, email, password, role } = req.body;
  const companyId = (req as any).user.companyId;

  if (!["hr", "supervisor"].includes(role)) {
    return res.status(400).json({ error: "INVALID_ROLE" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const newUser = await prisma.user.create({
      data: { fullName, email, passwordHash, role, companyId },
    });
    res.json({ id: newUser.id, email: newUser.email, role: newUser.role });
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "EMAIL_EXISTS" });
    res.status(500).json({ error: "FAILED_TO_CREATE_USER" });
  }
});
