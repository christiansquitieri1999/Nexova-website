/**
 * Authentication client module.
 *
 * Handles login, token storage (localStorage), header injection, and
 * session state for the backoffice frontend.
 *
 * The User/Auth API lives at the port configured in NEXT_PUBLIC_AUTH_API_URL
 * (default http://127.0.0.1:8002).
 */

export const AUTH_API_URL =
  process.env.NEXT_PUBLIC_AUTH_API_URL ?? "http://127.0.0.1:8002";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name?: string;
  phone?: string;
  address?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface ProfileData {
  name: string;
  phone: string;
  address: string;
}

export interface CurrentUserResponse {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  profile: ProfileData | null;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  new_password: string;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

const TOKEN_KEY = "nexova_access_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // localStorage may be unavailable in some environments
  }
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // noop
  }
}

// ---------------------------------------------------------------------------
// Auth header helper
// ---------------------------------------------------------------------------

/**
 * Returns the `Authorization` header object if a token is present,
 * or an empty object. Spread this into fetch options on protected calls.
 *
 * @example
 *   fetch(url, { headers: { "Content-Type": "application/json", ...authHeaders() } })
 */
export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ---------------------------------------------------------------------------
// 401 interceptor — redirects to /login if the API returns 401
// ---------------------------------------------------------------------------

/**
 * Wraps a fetch call so that if the response is 401 Unauthorized,
 * the token is cleared and the user is redirected to /login.
 *
 * Call this instead of raw fetch for any protected API request.
 *
 * @example
 *   const response = await authFetch("/suppliers", { method: "POST", ... });
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, init);

  if (response.status === 401 && typeof window !== "undefined") {
    clearToken();
    const currentPath = window.location.pathname;
    if (currentPath !== "/login" && currentPath !== "/register") {
      window.location.replace("/login");
    }
  }

  return response;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

function apiUrl(path: string): string {
  const base = AUTH_API_URL.replace(/\/+$/, "");
  return `${base}${path}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseError(body: unknown, fallback: string): string {
  if (isObject(body)) {
    if (typeof body.error === "string") return body.error;
    if (typeof body.detail === "string") return body.detail;
  }
  return fallback;
}

/** Request a password reset email. */
export async function forgotPassword(
  payload: ForgotPasswordPayload,
): Promise<void> {
  const response = await fetch(apiUrl("/auth/forgot-password"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(responseError(body, "Could not process the request."));
  }
}

/** Reset a password using a signed reset token. */
export async function resetPassword(
  payload: ResetPasswordPayload,
): Promise<void> {
  const response = await fetch(apiUrl("/auth/reset-password"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      responseError(body, "This reset link is invalid or has expired."),
    );
  }
}

/** Change the password of the authenticated user. */
export async function changePassword(
  payload: ChangePasswordPayload,
): Promise<void> {
  const response = await authFetch(apiUrl("/auth/change-password"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(responseError(body, "Could not change the password."));
  }
}

/** Authenticate with email + password, store the returned token. */
export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const response = await fetch(apiUrl("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body: unknown = await response.json();

  if (!response.ok) {
    const message =
      isObject(body) && typeof body.detail === "string"
        ? body.detail
        : "Invalid email or password.";
    throw new Error(message);
  }

  if (!isObject(body) || typeof body.access_token !== "string") {
    throw new Error("The authentication service returned an invalid response.");
  }

  setToken(body.access_token as string);

  return {
    access_token: body.access_token as string,
    token_type: (body.token_type as string) ?? "bearer",
  };
}

/** Register a new user, then automatically log in. */
export async function register(payload: RegisterPayload): Promise<LoginResponse> {
  // 1. Create the user
  const createResponse = await fetch(apiUrl("/users"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: payload.email, password: payload.password }),
  });

  const createBody: unknown = await createResponse.json();

  if (!createResponse.ok) {
    const message =
      isObject(createBody) && typeof createBody.detail === "string"
        ? createBody.detail
        : isObject(createBody) &&
            typeof (createBody as Record<string, unknown>).email === "string"
          ? (createBody as Record<string, unknown>).email as string
          : "Registration failed. Please check your input.";
    throw new Error(message);
  }

  // 2. Log in to get a token
  const loginResult = await login({ email: payload.email, password: payload.password });

  // 3. If profile fields were provided, update profile (now we have a token)
  if (payload.name || payload.phone || payload.address) {
    await fetch(apiUrl("/profiles/me"), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginResult.access_token}`,
      },
      body: JSON.stringify({
        name: payload.name ?? "",
        phone: payload.phone ?? "",
        address: payload.address ?? "",
      }),
    }).catch(() => {
      // Profile update is best-effort during registration
    });
  }

  return loginResult;
}

/** Fetch the current user + profile. Returns null if not authenticated. */
export async function getCurrentUser(): Promise<CurrentUserResponse | null> {
  const token = getToken();
  if (!token) return null;

  const response = await fetch(apiUrl("/auth/me"), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    clearToken();
    return null;
  }

  if (!response.ok) return null;

  const body: unknown = await response.json();
  if (!isObject(body) || typeof body.email !== "string") return null;

  return {
    id: (body.id as string) ?? "",
    email: body.email as string,
    role: (body.role as string) ?? "user",
    is_active: (body.is_active as boolean) ?? true,
    profile: isObject(body.profile)
      ? {
          name: (body.profile as Record<string, unknown>).name as string ?? "",
          phone: (body.profile as Record<string, unknown>).phone as string ?? "",
          address: (body.profile as Record<string, unknown>).address as string ?? "",
        }
      : null,
  };
}

/** Log out: clear the stored token. */
export function logout(): void {
  clearToken();
}

/** Check if a token is currently stored. */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}