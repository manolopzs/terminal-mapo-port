import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }
  const { email, password } = (req.body as any) ?? {};
  const validEmail = process.env.AUTH_EMAIL ?? "";
  const validPass = process.env.AUTH_PASS ?? "";
  if (!validEmail || !validPass) {
    res.status(500).json({ error: "Auth not configured on server" });
    return;
  }
  const ok =
    typeof email === "string" &&
    typeof password === "string" &&
    email.toLowerCase() === validEmail.toLowerCase() &&
    password === validPass;
  res.status(ok ? 200 : 401).json(ok ? { ok: true } : { error: "Invalid credentials" });
}
