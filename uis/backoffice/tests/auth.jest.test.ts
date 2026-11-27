import {
  authHeaders,
  authFetch,
  clearToken,
  changePassword,
  forgotPassword,
  getCurrentUser,
  getToken,
  isAuthenticated,
  login,
  logout,
  register,
  resetPassword,
  setToken,
} from "../lib/auth";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const storage = new MemoryStorage();

beforeAll(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        pathname: "/",
        replace: jest.fn(),
      },
    },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
});

beforeEach(() => {
  storage.clear();
  jest.restoreAllMocks();
});

describe("authentication token helpers", () => {
  test("stores, reads, checks, and clears a token", () => {
    expect(getToken()).toBeNull();
    expect(isAuthenticated()).toBe(false);

    setToken("test-token");

    expect(getToken()).toBe("test-token");
    expect(isAuthenticated()).toBe(true);
    expect(authHeaders()).toEqual({ Authorization: "Bearer test-token" });

    logout();
    expect(getToken()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  test("returns safe defaults when browser storage is unavailable", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: undefined,
    });

    expect(getToken()).toBeNull();
    expect(() => setToken("test")).not.toThrow();
    expect(() => clearToken()).not.toThrow();

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          pathname: "/",
          replace: jest.fn(),
        },
      },
    });
  });

  test("ignores storage read failures", () => {
    jest.spyOn(storage, "getItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });

    expect(getToken()).toBeNull();
  });
});

describe("login API boundary", () => {
  test("accepts a valid login and stores the access token", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "valid-token",
          token_type: "bearer",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(
      login({ email: "alice@example.com", password: "secret123" }),
    ).resolves.toEqual({
      access_token: "valid-token",
      token_type: "bearer",
    });
    expect(getToken()).toBe("valid-token");
  });

  test("converts invalid credentials into a human-readable error", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: "Invalid email or password" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      login({ email: "nobody@example.com", password: "wrong" }),
    ).rejects.toThrow("Invalid email or password");
  });

  test("handles network failures with a safe fallback", async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(
      login({ email: "alice@example.com", password: "secret123" }),
    ).rejects.toThrow("The authentication service is temporarily unavailable.");
  });

  test("rejects malformed success responses", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ token_type: "bearer" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      login({ email: "alice@example.com", password: "secret123" }),
    ).rejects.toThrow("The authentication service returned an invalid response.");
  });
});

describe("password and registration flows", () => {
  test("changes password through the protected API", async () => {
    setToken("valid-token");
    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Password changed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      changePassword({
        current_password: "secret123",
        new_password: "new-secret123",
      }),
    ).resolves.toBeUndefined();
  });

  test("forwards forgot-password failures with a safe server message", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Could not send email" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      forgotPassword({ email: "alice@example.com" }),
    ).rejects.toThrow("Could not send email");
  });

  test("accepts forgot-password and reset-password success responses", async () => {
    globalThis.fetch = jest.fn().mockImplementation(
      () =>
        Promise.resolve(
          new Response(JSON.stringify({ message: "accepted" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
    );

    await expect(
      forgotPassword({ email: "alice@example.com" }),
    ).resolves.toBeUndefined();
    await expect(
      resetPassword({ token: "valid", new_password: "new-secret123" }),
    ).resolves.toBeUndefined();
  });

  test("maps reset-token failures to the human-readable fallback", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: "Reset link expired" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      resetPassword({ token: "expired", new_password: "new-secret123" }),
    ).rejects.toThrow("Reset link expired");
  });

  test("registers, logs in, and returns the login session", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user: { id: "u1" } }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "registered-token",
            token_type: "bearer",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    globalThis.fetch = fetchMock;

    await expect(
      register({ email: "alice@example.com", password: "secret123" }),
    ).resolves.toEqual({
      access_token: "registered-token",
      token_type: "bearer",
    });
  });

  test("registers profile fields after login", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user: { id: "u1" } }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "registered-token",
            token_type: "bearer",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ name: "Alice" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    await register({
      email: "alice@example.com",
      password: "secret123",
      name: "Alice",
      phone: "+341234",
      address: "Valencia",
    });

    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("/profiles/me"),
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          Authorization: "Bearer registered-token",
        }),
      }),
    );
  });
});

describe("protected and current-user flows", () => {
  test("authFetch clears an expired session and redirects to login", async () => {
    setToken("expired-token");
    const pathname = (globalThis as typeof globalThis & {
      window: { location: { pathname: string; replace: jest.Mock } };
    }).window.location.pathname;
    expect(pathname).toBe("/");

    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await authFetch("https://example.com/protected");

    expect(response.status).toBe(401);
    expect(getToken()).toBeNull();
  });

  test("getCurrentUser returns null without a token", async () => {
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  test("getCurrentUser parses profile and applies safe defaults", async () => {
    setToken("valid-token");
    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "u1",
          email: "alice@example.com",
          profile: {
            name: null,
            phone: null,
            address: null,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(getCurrentUser()).resolves.toEqual({
      id: "u1",
      email: "alice@example.com",
      role: "user",
      is_active: true,
      profile: {
        name: "",
        phone: "",
        address: "",
      },
    });
  });

  test("getCurrentUser clears a 401 session", async () => {
    setToken("expired-token");
    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    );

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(getToken()).toBeNull();
  });

  test("getCurrentUser returns null for malformed successful payload", async () => {
    setToken("valid-token");
    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "u1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getCurrentUser()).resolves.toBeNull();
  });
});
