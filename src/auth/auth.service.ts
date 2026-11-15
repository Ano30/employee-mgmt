import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { signToken, Role } from "./jwt";

export async function login(email: string, password: string, selectedRole: Role, companyName?: string) {
  const user = await prisma.user.findFirst({
    where: { email },
    include: { company: true }
  });

  if (!user) throw new Error("INVALID_CREDENTIALS");
  if (!user.isActive) throw new Error("ACCOUNT_DISABLED");

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new Error("INVALID_CREDENTIALS");

  if (user.role !== selectedRole) throw new Error("ROLE_MISMATCH");

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

// ADDED BACK: changePassword function
export async function changePassword(userId: number, currentPwd: string, newPwd: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("NOT_FOUND");

  const ok = await bcrypt.compare(currentPwd, user.passwordHash);
  if (!ok) throw new Error("INVALID_CREDENTIALS");

  if (newPwd.length < 8) throw new Error("WEAK_PASSWORD");

  const hash = await bcrypt.hash(newPwd, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
}
