import type { IncomingMessage, ServerResponse } from "http";

export default function handler(req: IncomingMessage & { body?: any; method?: string }, res: ServerResponse & { status: (n: number) => any; json: (b: any) => void; end: () => void }) {
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
