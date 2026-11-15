import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { authenticate, requireRole } from "../auth/middleware";

export const supervisorRouter = Router();

// Get only assigned employees
supervisorRouter.get("/my-employees", authenticate, requireRole("supervisor"), async (req, res) => {
  const supervisorId = (req as any).user.sub;
  try {
    const employees = await prisma.employee.findMany({
      where: { supervisorId: supervisorId },
      include: {
        user: { select: { fullName: true, email: true, role: true } },
        location: { select: { name: true } },
        attendance: { orderBy: { clockedAt: "desc" }, take: 1 },
        leaves: { where: { status: "approved" } }
      }
    });
    res.json(employees);
  } catch (e) {
    res.status(500).json({ error: "FAILED_TO_FETCH_EMPLOYEES" });
  }
});

// Change assigned employee's password
supervisorRouter.post("/change-password", authenticate, requireRole("supervisor"), async (req, res) => {
  const { userId, newPassword } = req.body;
  const supervisorId = (req as any).user.sub;

  try {
    // Verify this employee is actually assigned to this supervisor
    const employee = await prisma.employee.findFirst({
      where: { userId: userId, supervisorId: supervisorId }
    });

    if (!employee) return res.status(403).json({ error: "NOT_AUTHORIZED" });

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

// (Keep your existing leave routes here...)
supervisorRouter.get("/leaves", authenticate, requireRole("supervisor"), async (req, res) => {
    // ... existing code ...
});
