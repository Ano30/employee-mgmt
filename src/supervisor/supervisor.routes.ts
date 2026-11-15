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
        leaves: { where: { status: "approved" } } // Only show active leaves in the directory
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

// Get all leave requests for this supervisor's team
supervisorRouter.get("/leaves", authenticate, requireRole("supervisor"), async (req, res) => {
  const supervisorId = (req as any).user.sub;
  try {
    const leaves = await prisma.leaveRequest.findMany({
      where: {
        employee: {
          is: { supervisorId: supervisorId }
        }
      },
      include: {
        employee: { include: { user: { select: { fullName: true } } } }
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(leaves);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "FAILED_TO_FETCH_LEAVES" });
  }
});

// Approve or Reject a leave request
supervisorRouter.patch("/leaves/:id", authenticate, requireRole("supervisor"), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // "approved" or "rejected"
  const supervisorId = (req as any).user.sub;

  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "INVALID_STATUS" });
  }

  try {
    const leave = await prisma.leaveRequest.findUnique({
      where: { id: Number(id) },
      include: { employee: true }
    });

    if (!leave || leave.employee.supervisorId !== supervisorId) {
      return res.status(403).json({ error: "NOT_AUTHORIZED_FOR_THIS_EMPLOYEE" });
    }

    const updated = await prisma.leaveRequest.update({
      where: { id: Number(id) },
      data: {
        status,
        reviewedById: supervisorId,
        reviewedAt: new Date(),
      },
    });

    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "FAILED_TO_UPDATE_LEAVE" });
  }
});

// Recall an employee who is currently on approved leave
supervisorRouter.post("/leaves/:id/recall", authenticate, requireRole("supervisor"), async (req, res) => {
  const { id } = req.params;
  const supervisorId = (req as any).user.sub;

  try {
    const leave = await prisma.leaveRequest.findUnique({
      where: { id: Number(id) },
      include: { employee: true }
    });

    if (!leave || leave.employee.supervisorId !== supervisorId) {
      return res.status(403).json({ error: "NOT_AUTHORIZED_FOR_THIS_EMPLOYEE" });
    }

    if (leave.status !== "approved") {
      return res.status(400).json({ error: "CAN_ONLY_RECALL_APPROVED_LEAVES" });
    }

    const updated = await prisma.leaveRequest.update({
      where: { id: Number(id) },
      data: {
        status: "recalled",
        recalledById: supervisorId,
        recalledAt: new Date(),
      },
    });

    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "FAILED_TO_RECALL_LEAVE" });
  }
});
