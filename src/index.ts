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
  /** Session expiry (RFC 3339). Present on successful logins and tenant selection. */
  expiresAt?: string;
  user?: AuthrsUser;
}

/** A tenant an identity belongs to, returned by the tenant-less identity login. */
export interface AuthrsTenantMembership {
  tenantId: string;
  status: string;
}

/**
 * Result of a tenant-less SSO login: a short-lived identity token plus the tenants this
 * identity belongs to. Exchange the token via `selectTenant` for a tenant-scoped session.
 */
export interface AuthrsIdentityLogin {
  identityToken: string;
  tenants: AuthrsTenantMembership[];
}

/** Session metadata returned by `GET /session/validate`. */
export interface AuthrsSessionInfo {
  tenantId: string;
  userId: string;
  /** The global identity behind this membership (same human across tenants). */
  identityId: string;
  roles: string[];
  permissions: string[];
  expiresAt: string;
}

/** Current-session info returned by `GET /session/me`. */
export interface AuthrsMe {
  userId: string;
  identityId: string;
  roles: string[];
  permissions: string[];
  expiresAt: string;
  user: AuthrsUser;
}

/**
 * Returned by `signup` when the email/mobile already maps to an existing global identity:
 * a verify-to-join email is sent to the owner and no account is created synchronously.
 */
export interface AuthrsVerificationPending {
  message: string;
}

/** Membership created by accepting a verify-to-join invite (`POST /signup/verify`). */
export interface AuthrsMembership {
  id: string;
  tenantId: string;
  status: string;
}

export interface AuthrsRole {
  id: string;
  name: string;
  uid?: string;
  /** Parent role id when this role inherits from another role. Null/absent for root roles. */
  parentRoleId?: string | null;
  tenantId?: string;
  createdAt?: string;
}

/** A single ancestor in a role's hierarchy chain. */
export interface AuthrsRoleAncestor {
  id: string;
  name: string;
  uid: string;
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

export interface AuthrsGroup {
  id: string;
  name: string;
  uid: string;
  description?: string | null;
  tenantId?: string;
}

export interface AuthrsCreateGroupParams {
  name: string;
  description?: string;
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
  /**
   * Sign up within the current tenant. If the email/mobile already belongs to a global
   * identity (e.g. the user exists in another tenant), no account is created — a
   * verify-to-join email is sent to the owner and an `AuthrsVerificationPending`
   * `{ message }` is returned instead of the user. Disambiguate with `"id" in result`.
   */
  signup(firstName: string, lastName: string, email: string, password: string, retypePassword: string) {
    return this.request<AuthrsUser | AuthrsVerificationPending>("POST", "/signup", { body: { firstName, lastName, email, password, retypePassword } });
  }
  /** Accept a verify-to-join invite (token from the signup email). The tenant is encoded in the token — no X-Tenant-ID needed. */
  verifyMembership(token: string) {
    return this.request<AuthrsMembership>("POST", "/signup/verify", { tenantId: null, body: { token } });
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

  // SSO — tenant-less identity login + tenant selection (no X-Tenant-ID)
  /**
   * Log in by email across all tenants (single sign-on). Returns a short-lived identity
   * token plus every tenant this identity belongs to. Exchange it via `selectTenant`.
   */
  loginIdentity(email: string, password: string) {
    return this.request<AuthrsIdentityLogin>("POST", "/login/identity", { tenantId: null, body: { email, password } });
  }
  /** List the tenants for an identity token (the SSO tenant picker). Bearer = identity token. */
  identityTenants(identityToken: string) {
    return this.request<{ tenants: AuthrsTenantMembership[] }>("GET", "/identity/tenants", { token: identityToken, tenantId: null });
  }
  /** Exchange an identity token for a tenant-scoped session. Bearer = identity token. */
  selectTenant(identityToken: string, tenantId: string) {
    return this.request<AuthrsSession>("POST", "/login/select-tenant", { token: identityToken, tenantId: null, body: { tenantId } });
  }
  oauthAuthorizeUrl(provider: string): string { return `${this.baseUrl}/oauth/${encodeURIComponent(provider)}`; }
  oauthCallback(provider: string, code: string, state?: string, token?: string) {
    return this.request<AuthrsSession>("GET", `/oauth/${encodeURIComponent(provider)}/callback`, {
      token, query: { code, ...(state !== undefined ? { state } : {}) },
    });
  }
  /** Start a password reset. Operates on the GLOBAL identity — the reset (and the resulting
   *  password) applies across every tenant the identity belongs to. */
  forgotPassword(email: string) { return this.request<unknown>("POST", "/forgot-password", { body: { email } }); }
  resetPassword(token: string, newPassword: string, retypePassword: string) {
    return this.request<unknown>("POST", "/reset-password", { body: { token, newPassword, retypePassword } });
  }

  // Availability checks (auth token required). Email and mobile are checked GLOBALLY
  // (an identity handle is unique across all tenants); username remains per-tenant.
  checkEmailAvailability(token: string, email: string) {
    return this.request<{ available: boolean }>("POST", "/check-availability/email", { token, body: { email } });
  }
  checkUsernameAvailability(token: string, username: string) {
    return this.request<{ available: boolean }>("POST", "/check-availability/username", { token, body: { username } });
  }
  checkMobileAvailability(token: string, mobile: string, countryCode: string) {
    return this.request<{ available: boolean }>("POST", "/check-availability/mobile", { token, body: { mobile, countryCode } });
  }

  // Session (no X-Tenant-ID except logoutAll)
  validateSession(token: string) { return this.request<AuthrsSessionInfo>("GET", "/session/validate", { token, tenantId: null }); }
  me(token: string) { return this.request<AuthrsMe>("GET", "/session/me", { token, tenantId: null }); }
  changePassword(token: string, currentPassword: string, newPassword: string, retypePassword: string) {
    return this.request<unknown>("POST", "/session/change-password", { token, tenantId: null, body: { currentPassword, newPassword, retypePassword } });
  }
  logout(token: string) { return this.request<unknown>("POST", "/session/logout", { token, tenantId: null }); }
  /** Revoke all sessions for the user in the current tenant. */
  logoutAll(token: string) { return this.request<unknown>("POST", "/session/logout/all", { token }); }
  /** Switch to another tenant the same identity belongs to, without re-authenticating.
   *  Pass an active session token; returns a new session for the target tenant. */
  switchTenant(sessionToken: string, tenantId: string) {
    return this.request<AuthrsSession>("POST", "/session/switch", { token: sessionToken, tenantId: null, body: { tenantId } });
  }
  /** Global logout: revoke every session of this identity across all of its tenants. */
  logoutGlobal(token: string) { return this.request<unknown>("POST", "/session/logout/global", { token, tenantId: null }); }
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
  /** Create a role. Pass parentRoleId to make it inherit permissions from a parent role. */
  createRole(token: string, name: string, parentRoleId?: string | null) {
    return this.request<AuthrsRole>("POST", "/admin/roles", { token, body: { name, ...(parentRoleId != null ? { parentRoleId } : {}) } });
  }
  listRoles(token: string) { return this.request<{ roles: AuthrsRole[] }>("GET", "/admin/roles", { token }); }
  /** Set or clear a role's parent. Pass null to make the role a root (no parent). */
  setRoleParent(token: string, roleId: string, parentRoleId: string | null) {
    return this.request<unknown>("PUT", `/admin/roles/${encodeURIComponent(roleId)}/parent`, { token, body: { parentRoleId } });
  }
  /** Get the ancestor chain (root-first) for a role. */
  getRoleHierarchy(token: string, roleId: string) {
    return this.request<{ ancestors: AuthrsRoleAncestor[] }>("GET", `/admin/roles/${encodeURIComponent(roleId)}/hierarchy`, { token });
  }
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

  // Admin — Groups
  createGroup(token: string, params: AuthrsCreateGroupParams) {
    return this.request<AuthrsGroup>("POST", "/admin/groups", { token, body: params });
  }
  listGroups(token: string) {
    return this.request<{ groups: AuthrsGroup[] }>("GET", "/admin/groups", { token });
  }
  getGroup(token: string, groupId: string) {
    return this.request<AuthrsGroup>("GET", `/admin/groups/${encodeURIComponent(groupId)}`, { token });
  }
  deleteGroup(token: string, groupId: string) {
    return this.request<unknown>("DELETE", `/admin/groups/${encodeURIComponent(groupId)}`, { token });
  }
  addUserToGroup(token: string, groupId: string, userId: string) {
    return this.request<unknown>("POST", `/admin/groups/${encodeURIComponent(groupId)}/users`, { token, body: { userId } });
  }
  listGroupMembers(token: string, groupId: string) {
    return this.request<{ users: string[] }>("GET", `/admin/groups/${encodeURIComponent(groupId)}/users`, { token });
  }
  removeUserFromGroup(token: string, groupId: string, userId: string) {
    return this.request<unknown>("DELETE", `/admin/groups/${encodeURIComponent(groupId)}/users/${encodeURIComponent(userId)}`, { token });
  }
  listUserGroups(token: string, userId: string) {
    return this.request<{ groups: AuthrsGroup[] }>("GET", `/admin/users/${encodeURIComponent(userId)}/groups`, { token });
  }
  assignRoleToGroup(token: string, groupId: string, roleId: string) {
    return this.request<unknown>("POST", `/admin/groups/${encodeURIComponent(groupId)}/roles`, { token, body: { roleId } });
  }
  listGroupRoles(token: string, groupId: string) {
    return this.request<{ roles: AuthrsRole[] }>("GET", `/admin/groups/${encodeURIComponent(groupId)}/roles`, { token });
  }
  removeRoleFromGroup(token: string, groupId: string, roleId: string) {
    return this.request<unknown>("DELETE", `/admin/groups/${encodeURIComponent(groupId)}/roles/${encodeURIComponent(roleId)}`, { token });
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
