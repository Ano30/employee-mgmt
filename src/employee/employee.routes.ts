import { Router } from "express";
import { prisma } from "../db";
import { authenticate, requireRole } from "../auth/middleware";

export const employeeRouter = Router();

// Haversine formula to calculate distance between two GPS points in meters
function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Earth radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

// Employee clocks in/out with GPS
employeeRouter.post("/clock", authenticate, requireRole("employee"), async (req, res) => {
  const { clockType, latitude, longitude } = req.body;
  const userId = (req as any).user.sub;

  try {
    const employee = await prisma.employee.findUnique({
      where: { userId },
      include: { location: true },
    });

    if (!employee) return res.status(404).json({ error: "EMPLOYEE_PROFILE_NOT_FOUND" });

    const distance = getDistanceFromLatLonInMeters(
      latitude, longitude, 
      Number(employee.location.latitude), Number(employee.location.longitude)
    );

    const isWithinGeofence = distance <= employee.location.radiusMeters;

    const log = await prisma.attendanceLog.create({
      data: {
        employeeId: employee.id,
        clockType,
        latitude,
        longitude,
        distanceMeters: distance,
        isWithinGeofence,
      },
    });

    res.json({
      message: isWithinGeofence ? "CLOCK_IN_SUCCESS" : "CLOCKED_IN_OUTSIDE_BOUNDS",
      distanceMeters: Math.round(distance),
      isWithinGeofence,
      log,
    });
  } catch (e: any) {
    res.status(500).json({ error: "CLOCK_FAILED", details: e.message });
  }
});

// Employee requests leave
employeeRouter.post("/leaves", authenticate, requireRole("employee"), async (req, res) => {
  const { leaveType, startDate, endDate, reason } = req.body;
  const userId = (req as any).user.sub;

  try {
    const employee = await prisma.employee.findUnique({ where: { userId } });
    if (!employee) return res.status(404).json({ error: "EMPLOYEE_NOT_FOUND" });

    const leave = await prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        leaveType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
      },
    });

    res.json(leave);
  } catch (e: any) {
    res.status(500).json({ error: "FAILED_TO_SUBMIT_LEAVE" });
  }
});

// Employee views their own leave requests (NEW ROUTE)
employeeRouter.get("/leaves", authenticate, requireRole("employee"), async (req, res) => {
  const userId = (req as any).user.sub;
  try {
    const employee = await prisma.employee.findUnique({ where: { userId } });
    if (!employee) return res.status(404).json({ error: "EMPLOYEE_NOT_FOUND" });

    const leaves = await prisma.leaveRequest.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: "desc" },
    });
    res.json(leaves);
  } catch (e) {
    res.status(500).json({ error: "FAILED_TO_FETCH_LEAVES" });
  }
});
