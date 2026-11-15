import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { signToken, Role } from "./jwt";

export async function login(email: string, password: string, selectedRole: Role, companyName?: string) {
  // Find the user and include their company
  const user = await prisma.user.findFirst({
    where: { email },
    include: { company: true }
  });

  if (!user) throw new Error("INVALID_CREDENTIALS");
  if (!user.isActive) throw new Error("ACCOUNT_DISABLED");

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new Error("INVALID_CREDENTIALS");

  if (user.role !== selectedRole) throw new Error("ROLE_MISMATCH");

  // If the user is not a developer, check if they belong to the selected company
  if (user.role !== "developer") {
    if (!companyName) throw new Error("COMPANY_REQUIRED");
    if (user.company?.name !== companyName) throw new Error("WRONG_COMPANY");
  }

  const token = signToken({ 
    sub: user.id, 
    role: user.role as Role, 
    email: user.email,
    companyId: user.companyId 
  } as any);

  return {
    token,
    user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, companyId: user.companyId },
  };
}
