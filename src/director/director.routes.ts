import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { authenticate, requireRole } from "../auth/middleware";

export const directorRouter = Router();

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

    const formattedUsers = users.map(u => ({
      userId: u.id,
      name: u.fullName,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      location: u.employeeProfile?.location?.name || "N/A",
      locationId: u.employeeProfile?.locationId || null,
      supervisorId: u.employeeProfile?.supervisorId || null,
      isOnLeave: (u.employeeProfile?.leaves?.length || 0) > 0,
      latestClock: u.employeeProfile?.attendance?.[0] || null,
    }));

    res.json(formattedUsers);
  } catch (e) {
    res.status(500).json({ error: "FAILED_TO_FETCH_USERS" });
  }
});

// UPDATE USER (WITH ROLE CHANGE LOGIC)
directorRouter.put("/users/:id", authenticate, requireRole("director", "hr"), async (req, res) => {
  const { id } = req.params;
  const { fullName, email, role, supervisorId, locationId } = req.body;
  const currentUserId = (req as any).user.sub;
  
  try {
    const targetUser = await prisma.user.findUnique({ 
      where: { id: Number(id) },
      include: { employeeProfile: true }
    });
    
    if (!targetUser) return res.status(404).json({ error: "USER_NOT_FOUND" });
    if (targetUser.role === "developer") return res.status(403).json({ error: "CANNOT_EDIT_DEVELOPER" });
    if (targetUser.id === currentUserId) return res.status(403).json({ error: "CANNOT_EDIT_YOURSELF" });

    const oldRole = targetUser.role;
    const newRole = role;

    // 1. Update the basic User details
    await prisma.user.update({
      where: { id: Number(id) },
      data: { fullName, email, role: newRole }
    });

    // 2. Handle Role Changes
    if (oldRole === "employee" && newRole !== "employee") {
      // PROMOTION: Delete their employee profile (removes location/supervisor tracking)
      if (targetUser.employeeProfile) {
        await prisma.employee.delete({ where: { id: targetUser.employeeProfile.id } });
      }
    } else if (oldRole !== "employee" && newRole === "employee") {
      // DEMOTION: Create a new employee profile (need to assign supervisor and location)
      await prisma.employee.create({
        data: {
          userId: targetUser.id,
          employeeCode: `EMP-${targetUser.id}`, // Auto-generate code
          department: "General",
          supervisorId: Number(supervisorId),
          locationId: Number(locationId)
        }
      });
    } else if (newRole === "employee") {
      // STILL AN EMPLOYEE: Update their existing supervisor and location
      await prisma.employee.update({
        where: { userId: Number(id) },
        data: { 
          supervisorId: Number(supervisorId), 
          locationId: Number(locationId) 
        }
      });
    }

    res.json({ message: "User updated successfully" });
  } catch (e: any) {
    console.error(e);
    if (e.code === "P2002") return res.status(400).json({ error: "EMAIL_ALREADY_EXISTS" });
    res.status(500).json({ error: "FAILED_TO_UPDATE_USER" });
  }
});

directorRouter.delete("/users/:id", authenticate, requireRole("director", "hr"), async (req, res) => {
  const { id } = req.params;
  const currentUserId = (req as any).user.sub;

  try {
    const targetUser = await prisma.user.findUnique({ where: { id: Number(id) }, include: { employeeProfile: true } });
    if (!targetUser) return res.status(404).json({ error: "USER_NOT_FOUND" });
    if (targetUser.role === "developer") return res.status(403).json({ error: "CANNOT_DELETE_DEVELOPER" });
    if (targetUser.id === currentUserId) return res.status(403).json({ error: "CANNOT_DELETE_YOURSELF" });

    if (targetUser.employeeProfile) {
      await prisma.attendanceLog.deleteMany({ where: { employeeId: targetUser.employeeProfile.id } });
      await prisma.leaveRequest.deleteMany({ where: { employeeId: targetUser.employeeProfile.id } });
      await prisma.employee.delete({ where: { id: targetUser.employeeProfile.id } });
    }

    await prisma.employee.updateMany({ where: { supervisorId: targetUser.id }, data: { supervisorId: currentUserId } });
    await prisma.user.delete({ where: { id: Number(id) } });
    
    res.json({ message: "User completely deleted from database" });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: "FAILED_TO_DELETE_USER" });
  }
});

directorRouter.post("/change-password", authenticate, requireRole("director", "hr"), async (req, res) => {
  const { userId, newPassword } = req.body;
  try {
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (targetUser?.role === "developer") return res.status(403).json({ error: "CANNOT_CHANGE_DEVELOPER_PASSWORD" });
    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
    res.json({ message: "Password updated successfully" });
  } catch (e) {
    res.status(500).json({ error: "FAILED_TO_UPDATE_PASSWORD" });
  }
});

directorRouter.post("/users", authenticate, requireRole("director"), async (req, res) => {
  const { fullName, email, password, role } = req.body;
  const companyId = (req as any).user.companyId;
  if (!["hr", "supervisor"].includes(role)) return res.status(400).json({ error: "INVALID_ROLE" });
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
