import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { signToken, Role } from "./jwt";

export async function login(email: string, password: string, selectedRole: Role) {
  // Find the user by email
  const user = await prisma.user.findUnique({
    where: { email },
    include: { company: true }
  });

  if (!user) throw new Error("INVALID_CREDENTIALS");
  if (!user.isActive) throw new Error("ACCOUNT_DISABLED");

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new Error("INVALID_CREDENTIALS");

  if (user.role !== selectedRole) throw new Error("ROLE_MISMATCH");

  // Sign the token and include the companyId
  const token = signToken({ 
    sub: user.id, 
    role: user.role as Role, 
    email: user.email,
    companyId: user.companyId 
  } as any);

  // Return the user info, including the company name so the frontend can display it
  return {
    token,
    user: { 
      id: user.id, 
      fullName: user.fullName, 
      email: user.email, 
      role: user.role, 
      companyId: user.companyId,
      companyName: user.company?.name || "System Developer"
    },
  };
}

export async function changePassword(userId: number, currentPwd: string, newPwd: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("NOT_FOUND");

  const ok = await bcrypt.compare(currentPwd, user.passwordHash);
  if (!ok) throw new Error("INVALID_CREDENTIALS");

  if (newPwd.length < 8) throw new Error("WEAK_PASSWORD");

  const hash = await bcrypt.hash(newPwd, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
}
