import { Router } from "express";
import { login, changePassword } from "./auth.service";
import { authenticate, AuthedRequest } from "./middleware"; // Corrected import

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const { email, password, role } = req.body ?? {};
  if (!email || !password || !role) {
    return res.status(400).json({ error: "MISSING_FIELDS" });
  }
  try {
    const result = await login(email, password, role);
    res.json(result);
  } catch (e: any) {
    const map: Record<string, number> = {
      INVALID_CREDENTIALS: 401,
      ACCOUNT_DISABLED: 403,
      ROLE_MISMATCH: 403,
    };
    res.status(map[e.message] ?? 500).json({ error: e.message ?? "SERVER_ERROR" });
  }
});

authRouter.post("/change-password", authenticate, async (req: AuthedRequest, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "MISSING_FIELDS" });
  }
  try {
    await changePassword(req.user!.sub, currentPassword, newPassword);
    res.json({ ok: true });
  } catch (e: any) {
    const map: Record<string, number> = {
      INVALID_CREDENTIALS: 401,
      WEAK_PASSWORD: 400,
      NOT_FOUND: 404,
    };
    res.status(map[e.message] ?? 500).json({ error: e.message ?? "SERVER_ERROR" });
  }
});
