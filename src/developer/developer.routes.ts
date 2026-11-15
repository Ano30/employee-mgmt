import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { authenticate, requireRole } from "../auth/middleware";

export const developerRouter = Router();

// Create a new company and its Director
developerRouter.post("/companies", authenticate, requireRole("developer"), async (req, res) => {
  const { companyName, directorName, directorEmail, directorPassword } = req.body;
  try {
    const passwordHash = await bcrypt.hash(directorPassword, 12);
    
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Company
      const company = await tx.company.create({ data: { name: companyName } });
      // 2. Create Director assigned to this company
      const director = await tx.user.create({
        data: {
          fullName: directorName,
          email: directorEmail,
          passwordHash,
          role: "director",
          companyId: company.id
        }
      });
      return { company, director };
    });
    res.json(result);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "EMAIL_EXISTS" });
    res.status(500).json({ error: "FAILED_TO_CREATE_COMPANY", details: e.message });
  }
});

// Get all companies (for Developer Dashboard)
developerRouter.get("/companies", authenticate, requireRole("developer"), async (req, res) => {
  try {
    const companies = await prisma.company.findMany({
      include: { users: { where: { role: "director" } } }
    });
    res.json(companies);
  } catch (e) {
    res.status(500).json({ error: "FAILED_TO_FETCH_COMPANIES" });
  }
});
