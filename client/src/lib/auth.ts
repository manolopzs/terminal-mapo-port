const AUTH_KEY = "mapo_auth";

// Credentials are read from build-time env vars (VITE_AUTH_EMAIL / VITE_AUTH_PASS).
// Set these in a local .env file — never commit real values to source control.
const VALID_EMAIL = (import.meta.env.VITE_AUTH_EMAIL as string | undefined) ?? "";
const VALID_PASS = (import.meta.env.VITE_AUTH_PASS as string | undefined) ?? "";

export function login(email: string, password: string): boolean {
  if (!VALID_EMAIL || !VALID_PASS) {
    console.error("Auth env vars not configured (VITE_AUTH_EMAIL / VITE_AUTH_PASS).");
    return false;
  }
  if (email.toLowerCase() === VALID_EMAIL.toLowerCase() && password === VALID_PASS) {
    sessionStorage.setItem(AUTH_KEY, "1");
    return true;
  }
  return false;
}

export function logout() {
  sessionStorage.removeItem(AUTH_KEY);
}

export function isAuthenticated(): boolean {
  return sessionStorage.getItem(AUTH_KEY) === "1";
}
