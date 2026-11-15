import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { authenticate, requireRole } from "../auth/middleware";

export const directorRouter = Router();

// View everyone currently on approved leave
directorRouter.get("/on-leave", authenticate, requireRole("director"), async (req, res) => {
  try {
    const onLeave = await prisma.leaveRequest.findMany({
      where: { status: "approved" },
      include: {
        employee: { include: { user: { select: { fullName: true } } } }
      },
    });
    res.json(onLeave);
  } catch (e) {
    res.status(500).json({ error: "FAILED_TO_FETCH_ON_LEAVE" });
  }
});

// Get all employees and their current status (NEW ROUTE)
directorRouter.get("/all-employees", authenticate, requireRole("director"), async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      include: {
        user: { select: { fullName: true, email: true } },
        supervisor: { select: { fullName: true } },
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

// Add a new HR or Supervisor
directorRouter.post("/users", authenticate, requireRole("director"), async (req, res) => {
  const { fullName, email, password, role } = req.body;

  if (!["hr", "supervisor"].includes(role)) {
    return res.status(400).json({ error: "DIRECTOR_CAN_ONLY_CREATE_HR_OR_SUPERVISOR" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const newUser = await prisma.user.create({
      data: { fullName, email, passwordHash, role },
    });
    res.json({ id: newUser.id, email: newUser.email, role: newUser.role });
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "EMAIL_ALREADY_EXISTS" });
    res.status(500).json({ error: "FAILED_TO_CREATE_USER" });
  }
});

// Change a user's password
directorRouter.patch("/users/:id/password", authenticate, requireRole("director"), async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: "WEAK_PASSWORD" });
  }

  try {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: Number(id) },
      data: { passwordHash },
    });
    res.json({ ok: true, message: "PASSWORD_UPDATED" });
  } catch (e) {
    res.status(500).json({ error: "FAILED_TO_UPDATE_PASSWORD" });
  }
});

// Soft Delete a user (Deactivate them)
directorRouter.delete("/users/:id", authenticate, requireRole("director"), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.user.update({
      where: { id: Number(id) },
      data: { isActive: false },
    });
    res.json({ ok: true, message: "USER_DEACTIVATED" });
  } catch (e) {
    res.status(500).json({ error: "FAILED_TO_DELETE_USER" });
  }
});
