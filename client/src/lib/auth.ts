const AUTH_KEY = "mapo_auth";

export async function login(email: string, password: string): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      sessionStorage.setItem(AUTH_KEY, "1");
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function logout() {
  sessionStorage.removeItem(AUTH_KEY);
}

export function isAuthenticated(): boolean {
  return sessionStorage.getItem(AUTH_KEY) === "1";
}
