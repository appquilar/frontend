import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@/domain/models/AuthSession";
import { ApiAuthRepository } from "@/infrastructure/repositories/ApiAuthRepository";

type ApiClientMock = {
  post: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
};

type SessionStorageMock = {
  saveToken: ReturnType<typeof vi.fn>;
  getCurrentSession: ReturnType<typeof vi.fn>;
  getCurrentSessionSync: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
};

const createApiClientMock = (): ApiClientMock => ({
  post: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
});

const createSessionStorageMock = (): SessionStorageMock => ({
  saveToken: vi.fn(),
  getCurrentSession: vi.fn(),
  getCurrentSessionSync: vi.fn(),
  clear: vi.fn(),
});

const createSession = (): AuthSession => ({
  token: "jwt-token",
  userId: null,
  expiresAt: null,
  roles: [],
});

describe("ApiAuthRepository", () => {
  let apiClient: ApiClientMock;
  let sessionStorage: SessionStorageMock;
  let repository: ApiAuthRepository;

  beforeEach(() => {
    apiClient = createApiClientMock();
    sessionStorage = createSessionStorageMock();

    repository = new ApiAuthRepository(
      apiClient as never,
      sessionStorage as never
    );
  });

  it("throws when login succeeds without returning a token", async () => {
    apiClient.post.mockResolvedValueOnce({
      success: true,
      data: {},
    });

    await expect(
      repository.login({
        email: "victor@appquilar.com",
        password: "secret",
      })
    ).rejects.toThrow("Login response did not contain a token");

    expect(sessionStorage.saveToken).not.toHaveBeenCalled();
  });

  it("persists the returned token on successful login", async () => {
    const session = createSession();

    apiClient.post.mockResolvedValueOnce({
      success: true,
      data: {
        token: "jwt-token",
      },
    });
    sessionStorage.saveToken.mockReturnValue(session);

    await expect(
      repository.login({
        email: "victor@appquilar.com",
        password: "secret",
      })
    ).resolves.toBe(session);

    expect(apiClient.post).toHaveBeenCalledWith("/api/auth/login", {
      email: "victor@appquilar.com",
      password: "secret",
    });
    expect(sessionStorage.saveToken).toHaveBeenCalledWith("jwt-token");
  });

  it("registers users and resets forgotten passwords using backend DTOs", async () => {
    apiClient.post.mockResolvedValue(undefined);

    await repository.register({
      firstName: "Victor",
      lastName: "User",
      email: "victor@appquilar.com",
      password: "Password123!",
      captchaToken: "captcha-token",
    });

    await repository.resetPassword({
      token: "reset-token",
      newPassword: "new-secret",
    });

    expect(apiClient.post).toHaveBeenNthCalledWith(
      1,
      "/api/auth/register",
      expect.objectContaining({
        first_name: "Victor",
        last_name: "User",
        email: "victor@appquilar.com",
        password: "Password123!",
        captcha_token: "captcha-token",
      }),
      {
        skipParseJson: true,
      }
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      2,
      "/api/auth/change-password",
      {
        token: "reset-token",
        password: "new-secret",
      },
      {
        skipParseJson: true,
      }
    );
  });

  it("sends forgot-password requests without requiring a session", async () => {
    apiClient.post.mockResolvedValueOnce(undefined);

    await repository.requestPasswordReset("victor@appquilar.com");

    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/auth/forgot-password",
      {
        email: "victor@appquilar.com",
      },
      {
        skipParseJson: true,
      }
    );
  });

  it("logs out with Authorization header when a session exists and then clears it", async () => {
    const session = createSession();

    sessionStorage.getCurrentSession.mockReturnValue(session);
    apiClient.post.mockResolvedValueOnce(undefined);

    await repository.logout();

    expect(apiClient.post).toHaveBeenCalledWith("/api/auth/logout", undefined, {
      headers: {
        Authorization: "Bearer jwt-token",
      },
      skipParseJson: true,
    });
    expect(sessionStorage.clear).toHaveBeenCalledTimes(1);
  });

  it("still clears the local session when logout has no session or the API call fails", async () => {
    sessionStorage.getCurrentSession.mockReturnValueOnce(null);
    apiClient.post.mockResolvedValueOnce(undefined);

    await repository.logout();

    expect(apiClient.post).toHaveBeenCalledWith("/api/auth/logout", undefined, {
      headers: undefined,
      skipParseJson: true,
    });

    const session = createSession();

    sessionStorage.getCurrentSession.mockReturnValueOnce(session);
    apiClient.post.mockRejectedValueOnce(new Error("network down"));

    await expect(repository.logout()).resolves.toBeUndefined();
    expect(sessionStorage.clear).toHaveBeenCalledTimes(2);
  });

  it("changes password using the legacy user_id field from /api/me when needed", async () => {
    const session = createSession();

    sessionStorage.getCurrentSession.mockReturnValue(session);
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: {
        user_id: "user/2",
      },
    });
    apiClient.patch.mockResolvedValueOnce(undefined);

    await repository.changePassword({
      oldPassword: "old-secret",
      newPassword: "new-secret",
      token: "ignored-by-repository",
    });

    expect(apiClient.get).toHaveBeenCalledWith("/api/me", {
      headers: {
        Authorization: "Bearer jwt-token",
      },
    });
    expect(apiClient.patch).toHaveBeenCalledWith(
      "/api/users/user%2F2/change-password",
      {
        old_password: "old-secret",
        new_password: "new-secret",
      },
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
        skipParseJson: true,
      }
    );
  });

  it("changes password using the canonical id field from /api/me when available", async () => {
    const session = createSession();

    sessionStorage.getCurrentSession.mockReturnValue(session);
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: {
        id: "user-1",
      },
    });
    apiClient.patch.mockResolvedValueOnce(undefined);

    await repository.changePassword({
      oldPassword: "old-secret",
      newPassword: "new-secret",
      token: "ignored",
    });

    expect(apiClient.patch).toHaveBeenCalledWith(
      "/api/users/user-1/change-password",
      {
        old_password: "old-secret",
        new_password: "new-secret",
      },
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
        skipParseJson: true,
      }
    );
  });

  it("rejects authenticated password change when there is no current session", async () => {
    sessionStorage.getCurrentSession.mockReturnValue(null);

    await expect(
      repository.changePassword({
        oldPassword: "old-secret",
        newPassword: "new-secret",
        token: "unused",
      })
    ).rejects.toThrow("Cannot change password without an authenticated user");

    expect(apiClient.get).not.toHaveBeenCalled();
    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it("rejects authenticated password change when /api/me does not include a user id", async () => {
    const session = createSession();

    sessionStorage.getCurrentSession.mockReturnValue(session);
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: {},
    });

    await expect(
      repository.changePassword({
        oldPassword: "old-secret",
        newPassword: "new-secret",
        token: "unused",
      })
    ).rejects.toThrow("Unable to resolve user id from /api/me");

    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it("delegates current session lookups to the session storage", async () => {
    const session = createSession();

    sessionStorage.getCurrentSession.mockReturnValue(session);
    sessionStorage.getCurrentSessionSync.mockReturnValue(session);

    await expect(repository.getCurrentSession()).resolves.toBe(session);
    expect(repository.getCurrentSessionSync()).toBe(session);
  });
});
