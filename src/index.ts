/**
 * AuthrsClient — TypeScript client for the Authrs multi-tenant auth service.
 *
 * No external dependencies — uses native fetch (Node 18+, Next.js, Bun, Deno, browser).
 *
 * Configuration (env vars or constructor):
 *   AUTHRS_BASE_URL   — Authrs server base URL  (default: http://localhost:3000)
 *   AUTHRS_TENANT_ID  — Tenant identifier        (default: "")
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthrsConfig {
  baseUrl?: string;
  tenantId?: string;
}

export interface AuthrsUser {
  id: string;
  email?: string;
  username?: string;
  mobile?: string;
  countryCode?: string;
  firstName?: string;
  lastName?: string;
  status?: string;
  isArchived?: boolean;
  accessValidUntil?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthrsSession {
  sessionToken: string;
  user?: AuthrsUser;
}

export interface AuthrsRole {
  id: string;
  name: string;
  uid?: string;
  tenantId?: string;
  createdAt?: string;
}

export interface AuthrsPermissionStatement {
  sid?: string;
  effect: "Allow" | "Deny";
  principals: string[];
  actions: string[];
  resources: string[];
  conditions?: unknown[];
}

export interface AuthrsPermissionDocument {
  version: string;
  statements: AuthrsPermissionStatement[];
}

export interface AuthrsPermission {
  id: string;
  name: string;
  description?: string;
  document?: AuthrsPermissionDocument;
  tenantId?: string;
}

export interface AuthrsPermissionCheckResult {
  resource: string;
  action?: string;
  allowed?: boolean;
  decisions?: Record<string, boolean>;
}

export interface AuthrsCreatePermissionParams {
  name: string;
  description?: string;
  document: AuthrsPermissionDocument;
}

export interface AuthrsPackageSyncParams {
  packageId: string;
  tables: string[];
  customActions?: string[];
}

export interface AuthrsKvEntry {
  groupKey: string;
  key: string;
  value: string;
}

export interface AuthrsCreateUserParams {
  firstName?: string;
  lastName?: string;
  email?: string;
  username?: string;
  mobile?: string;
  countryCode?: string;
  password?: string;
  retypePassword?: string;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class AuthrsError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "AuthrsError";
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class AuthrsClient {
  private readonly baseUrl: string;
  private readonly tenantId: string;

  constructor(config: AuthrsConfig = {}) {
    this.baseUrl = (
      config.baseUrl ??
      (typeof process !== "undefined" ? process.env.AUTHRS_BASE_URL : undefined) ??
      "http://localhost:3000"
    ).replace(/\/+$/, "");
    this.tenantId =
      config.tenantId ??
      (typeof process !== "undefined" ? process.env.AUTHRS_TENANT_ID : undefined) ??
      "";
  }

  private async request<T>(
    method: string,
    path: string,
    opts: {
      token?: string;
      tenantId?: string | null;
      body?: unknown;
      query?: Record<string, string | boolean | undefined>;
    } = {},
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (opts.query) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined) params.set(k, String(v));
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    const headers: Record<string, string> = {};
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
    const tid = opts.tenantId === undefined ? this.tenantId : opts.tenantId;
    if (tid) headers["X-Tenant-ID"] = tid;

    const res = await fetch(url, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

    if (!res.ok) {
      let body: unknown;
      try { body = await res.json(); } catch { body = await res.text().catch(() => null); }
      throw new AuthrsError(`Authrs ${method} ${path} → ${res.status}`, res.status, body);
    }
    if (res.status === 204) return {} as T;
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) return res.json() as Promise<T>;
    return res.text() as unknown as T;
  }

  // Health
  healthCheck() { return this.request<{ status: string }>("GET", "/health", { tenantId: null }); }
  getMetrics() { return this.request<unknown>("GET", "/metrics", { tenantId: null }); }
  getSpec() { return this.request<unknown>("GET", "/spec", { tenantId: null }); }

  // Auth (tenant-scoped, no auth token)
  signup(firstName: string, lastName: string, email: string, password: string, retypePassword: string) {
    return this.request<AuthrsUser>("POST", "/signup", { body: { firstName, lastName, email, password, retypePassword } });
  }
  loginEmailPassword(email: string, password: string) {
    return this.request<AuthrsSession>("POST", "/login/email-password", { body: { email, password } });
  }
  loginUsernamePassword(username: string, password: string) {
    return this.request<AuthrsSession>("POST", "/login/username-password", { body: { username, password } });
  }
  loginEmailOtpRequest(email: string) {
    return this.request<unknown>("POST", "/login/email-otp/request", { body: { email } });
  }
  loginMobileOtpRequest(mobile: string, countryCode: string) {
    return this.request<unknown>("POST", "/login/mobile-otp/request", { body: { mobile, countryCode } });
  }
  loginWhatsAppOtpRequest(mobile: string, countryCode: string) {
    return this.request<unknown>("POST", "/login/mobile-whatsapp-otp/request", { body: { mobile, countryCode } });
  }
  loginOtpVerify(identifier: string, code: string, channel: "email" | "sms" | "whatsapp") {
    return this.request<AuthrsSession>("POST", "/login/otp/verify", { body: { identifier, code, channel } });
  }
  oauthAuthorizeUrl(provider: string): string { return `${this.baseUrl}/oauth/${encodeURIComponent(provider)}`; }
  oauthCallback(provider: string, code: string, state?: string, token?: string) {
    return this.request<AuthrsSession>("GET", `/oauth/${encodeURIComponent(provider)}/callback`, {
      token, query: { code, ...(state !== undefined ? { state } : {}) },
    });
  }
  forgotPassword(email: string) { return this.request<unknown>("POST", "/forgot-password", { body: { email } }); }
  resetPassword(token: string, newPassword: string, retypePassword: string) {
    return this.request<unknown>("POST", "/reset-password", { body: { token, newPassword, retypePassword } });
  }

  // Session (no X-Tenant-ID except logoutAll)
  validateSession(token: string) { return this.request<{ valid: boolean }>("GET", "/session/validate", { token, tenantId: null }); }
  me(token: string) { return this.request<AuthrsUser>("GET", "/session/me", { token, tenantId: null }); }
  changePassword(token: string, currentPassword: string, newPassword: string, retypePassword: string) {
    return this.request<unknown>("POST", "/session/change-password", { token, tenantId: null, body: { currentPassword, newPassword, retypePassword } });
  }
  logout(token: string) { return this.request<unknown>("POST", "/session/logout", { token, tenantId: null }); }
  logoutAll(token: string) { return this.request<unknown>("POST", "/session/logout/all", { token }); }
  /** Complete a forced password change. Use the changeToken returned by login when passwordChangeRequired is true. */
  forceChangePassword(changeToken: string, newPassword: string, retypePassword: string) {
    return this.request<AuthrsSession>("POST", "/session/force-change-password", { body: { changeToken, newPassword, retypePassword } });
  }

  // MFA (auth token + tenant-scoped)
  enableMfa(token: string) { return this.request<unknown>("POST", "/mfa/enable", { token }); }
  verifyMfa(token: string, code: string) { return this.request<unknown>("POST", "/mfa/verify", { token, body: { code } }); }
  validateMfa(token: string, code: string) { return this.request<unknown>("POST", "/mfa/validate", { token, body: { code } }); }

  // Admin — Users
  createUser(token: string, params: AuthrsCreateUserParams) {
    return this.request<AuthrsUser>("POST", "/admin/users", { token, body: params });
  }
  listUsers(token: string, options: { includeArchived?: boolean } = {}) {
    return this.request<{ users: AuthrsUser[] }>("GET", "/admin/users", {
      token, query: options.includeArchived ? { includeArchived: "true" } : undefined,
    });
  }
  archiveUser(token: string, userId: string) {
    return this.request<unknown>("POST", `/admin/users/${encodeURIComponent(userId)}/archive`, { token });
  }
  listUserRoles(token: string, userId: string) {
    return this.request<{ roles: AuthrsRole[] }>("GET", `/admin/users/${encodeURIComponent(userId)}/roles`, { token });
  }
  assignRole(token: string, userId: string, roleId: string) {
    return this.request<unknown>("POST", `/admin/users/${encodeURIComponent(userId)}/roles`, { token, body: { roleId } });
  }
  removeRole(token: string, userId: string, roleId: string) {
    return this.request<unknown>("DELETE", `/admin/users/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`, { token });
  }
  resetUserPassword(token: string, userId: string, newPassword: string, retypePassword: string, forcePasswordChange = false) {
    return this.request<unknown>("POST", `/admin/users/${encodeURIComponent(userId)}/reset-password`, { token, body: { newPassword, retypePassword, forcePasswordChange } });
  }
  /** Set or clear the access expiry for a user. Pass null to remove the expiry (access becomes indefinite). */
  setAccessValidity(token: string, userId: string, accessValidUntil: string | null) {
    return this.request<unknown>("PATCH", `/admin/users/${encodeURIComponent(userId)}/access-validity`, { token, body: { accessValidUntil } });
  }

  // Admin — Roles & Permissions
  createRole(token: string, name: string) { return this.request<AuthrsRole>("POST", "/admin/roles", { token, body: { name } }); }
  listRoles(token: string) { return this.request<{ roles: AuthrsRole[] }>("GET", "/admin/roles", { token }); }
  listRolePermissions(token: string, roleId: string) {
    return this.request<{ permissions: AuthrsPermission[] }>("GET", `/admin/roles/${encodeURIComponent(roleId)}/permissions`, { token });
  }
  attachPermissionToRole(token: string, roleId: string, permissionId: string) {
    return this.request<unknown>("POST", `/admin/roles/${encodeURIComponent(roleId)}/permissions`, { token, body: { permissionId } });
  }
  detachPermissionFromRole(token: string, roleId: string, permissionId: string) {
    return this.request<unknown>("DELETE", `/admin/roles/${encodeURIComponent(roleId)}/permissions/${encodeURIComponent(permissionId)}`, { token });
  }
  createPermission(token: string, params: AuthrsCreatePermissionParams) {
    return this.request<AuthrsPermission>("POST", "/admin/permissions", { token, body: params });
  }
  listPermissions(token: string) { return this.request<{ permissions: AuthrsPermission[] }>("GET", "/admin/permissions", { token }); }
  getPermission(token: string, permissionId: string) {
    return this.request<AuthrsPermission>("GET", `/admin/permissions/${encodeURIComponent(permissionId)}`, { token });
  }
  deletePermission(token: string, permissionId: string) {
    return this.request<unknown>("DELETE", `/admin/permissions/${encodeURIComponent(permissionId)}`, { token });
  }
  checkPermission(token: string, userId: string, resource: string, action?: string, context: Record<string, unknown> = {}) {
    return this.request<AuthrsPermissionCheckResult>("POST", "/admin/permissions/check", {
      token, body: { userId, resource, ...(action !== undefined ? { action } : {}), context },
    });
  }

  // Admin — Packages
  syncPackage(token: string, params: AuthrsPackageSyncParams) {
    return this.request<unknown>("POST", "/admin/packages/sync", { token, body: params });
  }

  // Admin — KV Store
  listKvKeys(token: string) { return this.request<AuthrsKvEntry[]>("GET", "/admin/kv_store", { token }); }
  getKvValue(token: string, groupKey: string, key: string) {
    return this.request<AuthrsKvEntry>("GET", `/admin/kv_store/${encodeURIComponent(groupKey)}/${encodeURIComponent(key)}`, { token });
  }
  setKvValue(token: string, groupKey: string, key: string, value: string) {
    return this.request<AuthrsKvEntry>("PUT", `/admin/kv_store/${encodeURIComponent(groupKey)}/${encodeURIComponent(key)}`, { token, body: { value } });
  }
  deleteKvValue(token: string, groupKey: string, key: string) {
    return this.request<unknown>("DELETE", `/admin/kv_store/${encodeURIComponent(groupKey)}/${encodeURIComponent(key)}`, { token });
  }
}

// Singleton for Next.js / server use
let _client: AuthrsClient | undefined;
export function getAuthrsClient(config?: AuthrsConfig): AuthrsClient {
  if (!_client || config) _client = new AuthrsClient(config);
  return _client;
}

export default AuthrsClient;
