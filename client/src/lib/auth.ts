const AUTH_KEY = "mapo_auth";
const VALID_EMAIL = "mapo@redacted.io";
const VALID_PASS = "REDACTED";

export function login(email: string, password: string): boolean {
  if (email.toLowerCase() === VALID_EMAIL && password === VALID_PASS) {
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
