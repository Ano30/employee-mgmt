import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { authenticate, requireRole } from "../auth/middleware";

export const directorRouter = Router();

// Get ALL users (Employees, Supervisors, HR) for the company
directorRouter.get("/all-employees", authenticate, requireRole("director", "hr"), async (req, res) => {
  const companyId = (req as any).user.companyId;
  try {
    const users = await prisma.user.findMany({
      where: { companyId: companyId },
      include: {
        employeeProfile: {
          include: {
            location: { select: { name: true } },
            attendance: { orderBy: { clockedAt: "desc" }, take: 1 },
            leaves: { where: { status: "approved" } }
          }
        }
      }
    });

    // Format the data so the frontend can read it easily
    const formattedUsers = users.map(u => ({
      userId: u.id,
      name: u.fullName,
      role: u.role,
      location: u.employeeProfile?.location?.name || "N/A",
      isOnLeave: (u.employeeProfile?.leaves?.length || 0) > 0,
      latestClock: u.employeeProfile?.attendance?.[0] || null,
    }));

    res.json(formattedUsers);
  } catch (e) {
    res.status(500).json({ error: "FAILED_TO_FETCH_USERS" });
  }
});

// Change any user's password (For Director/HR)
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
