import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { authenticate, requireRole } from "../auth/middleware";

export const hrRouter = Router();

// Get lists for dropdowns
hrRouter.get("/locations", authenticate, requireRole("hr"), async (req, res) => {
  const locations = await prisma.location.findMany();
  res.json(locations);
});

hrRouter.get("/supervisors", authenticate, requireRole("hr"), async (req, res) => {
  const supervisors = await prisma.user.findMany({ where: { role: "supervisor" }, select: { id: true, fullName: true } });
  res.json(supervisors);
});

// HR adds a new location
hrRouter.post("/locations", authenticate, requireRole("hr"), async (req, res) => {
  const { name, latitude, longitude, radiusMeters } = req.body;
  try {
    const location = await prisma.location.create({
      data: {
        name,
        latitude,
        longitude,
        radiusMeters: radiusMeters || 100,
        createdById: (req as any).user.sub,
      },
    });
    res.json(location);
  } catch (e) {
    res.status(500).json({ error: "FAILED_TO_CREATE_LOCATION" });
  }
});

// HR adds a new employee and assigns supervisor + location
hrRouter.post("/employees", authenticate, requireRole("hr"), async (req, res) => {
  const { fullName, email, password, employeeCode, department, supervisorId, locationId } = req.body;
  
  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          fullName,
          email,
          passwordHash,
          role: "employee",
        },
      });

      const newEmployee = await tx.employee.create({
        data: {
          userId: newUser.id,
          supervisorId: Number(supervisorId),
          locationId: Number(locationId),
          employeeCode,
          department,
        },
      });

      return { user: newUser, employee: newEmployee };
    });

    res.json(result);
  } catch (e: any) {
    if (e.code === "P2002") {
      return res.status(400).json({ error: "EMAIL_OR_CODE_ALREADY_EXISTS" });
    }
    res.status(500).json({ error: "FAILED_TO_CREATE_EMPLOYEE", details: e.message });
  }
});

// HR views attendance logs
hrRouter.get("/attendance", authenticate, requireRole("hr"), async (req, res) => {
  try {
    const logs = await prisma.attendanceLog.findMany({
      include: {
        employee: {
          include: { user: { select: { fullName: true } } }
        }
      },
      orderBy: { clockedAt: "desc" },
    });
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: "FAILED_TO_FETCH_ATTENDANCE" });
  }
});
