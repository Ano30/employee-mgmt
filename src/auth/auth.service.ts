import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { signToken, Role } from "./jwt";

export async function login(email: string, password: string, selectedRole: Role) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) throw new Error("INVALID_CREDENTIALS");
  if (!user.isActive) throw new Error("ACCOUNT_DISABLED");

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new Error("INVALID_CREDENTIALS");

  if (user.role !== selectedRole) throw new Error("ROLE_MISMATCH");

  const token = signToken({ sub: user.id, role: user.role as Role, email: user.email });
  return {
    token,
    user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
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
