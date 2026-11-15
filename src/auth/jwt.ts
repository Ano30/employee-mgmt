import jwt from "jsonwebtoken";

export type Role = "director" | "hr" | "supervisor" | "employee";

export interface JwtPayload {
  sub: number;
  role: Role;
  email: string;
}

const SECRET = process.env.JWT_SECRET || "fallback-secret";
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN } as any);
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, SECRET);
  return decoded as unknown as JwtPayload;
}
