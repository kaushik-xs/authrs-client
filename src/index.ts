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

/**
 * A per-tenant membership of a global identity. `id` is the membership id; `identityId` is
 * the shared identity. Profile fields (name, email, mobile) and `mfaEnabled` are sourced
 * from that identity; `username`, `status`, and `accessValidUntil` are per-tenant.
 */
export interface AuthrsUser {
  id: string;
  /** The global identity behind this membership (same human across tenants). */
  identityId?: string;
  email?: string;
  username?: string;
  mobile?: string;
  countryCode?: string;
  firstName?: string;
  lastName?: string;
  status?: string;
  mfaEnabled?: boolean;
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

/** Successful login: a session token and its expiry. */
export interface AuthrsLoginSuccess {
  sessionToken: string;
  /** Session expiry (RFC 3339). */
  expiresAt: string;
}

/**
 * MFA challenge: the credentials were valid but the account has MFA enabled. Exchange the
 * `mfaToken` (with the user's TOTP code) to complete the login.
 */
export interface AuthrsMfaRequired {
  mfaRequired: true;
  mfaToken: string;
}

/**
 * Forced password change: the credentials were valid but the account must set a new password
 * before a session is issued. Pass the `changeToken` to `forceChangePassword`.
 */
export interface AuthrsPasswordChangeRequired {
  passwordChangeRequired: true;
  changeToken: string;
}

/**
 * The three shapes a login-style endpoint can return. Narrow with the `isLoginSuccess` /
 * `isMfaRequired` / `isPasswordChangeRequired` guards (or check for the discriminant fields).
 */
export type AuthrsLoginResult =
  | AuthrsLoginSuccess
  | AuthrsMfaRequired
  | AuthrsPasswordChangeRequired;

export function isLoginSuccess(r: AuthrsLoginResult): r is AuthrsLoginSuccess {
  return "sessionToken" in r;
}
export function isMfaRequired(r: AuthrsLoginResult): r is AuthrsMfaRequired {
  return "mfaRequired" in r && r.mfaRequired === true;
}
export function isPasswordChangeRequired(r: AuthrsLoginResult): r is AuthrsPasswordChangeRequired {
  return "passwordChangeRequired" in r && r.passwordChangeRequired === true;
}

/** OAuth / OpenID Connect providers supported by Authrs. */
export type AuthrsOAuthProvider = "google" | "microsoft";

/**
 * Returned by `startOAuth`: navigate the browser to `authorizationUrl` and keep `state`
 * (e.g. in sessionStorage) to compare against the `state` the provider sends back.
 */
export interface AuthrsOAuthStart {
  authorizationUrl: string;
  state: string;
}

/** Whether MFA is on for the session's identity (MFA is global across tenants). */
export interface AuthrsMfaStatus {
  enabled: boolean;
  backupCodesRemaining: number;
}

/**
 * Returned by `enableMfa`: add the account to an authenticator app by rendering
 * `otpauthUrl` as a QR code, or by typing `secret` manually.
 */
export interface AuthrsMfaEnrollment {
  /** Base32 TOTP secret for manual entry. */
  secret: string;
  /** `otpauth://totp/...` URI — render as a QR code. */
  otpauthUrl: string;
}

/** Returned by `verifyMfa`: MFA is now on. Show the backup codes once — they are not retrievable later. */
export interface AuthrsMfaEnabled {
  enabled: true;
  backupCodes: string[];
}

/** Common list query for RSQL-capable admin list endpoints. */
export interface AuthrsListQuery {
  /** RSQL filter expression, e.g. `status==active;email==*@acme.com`. */
  q?: string;
  /** Sort spec, e.g. `createdAt,desc` or `email`. */
  sort?: string;
  /** Page size (server clamps to a max, default page 50). */
  limit?: number;
  /** Row offset for pagination. */
  offset?: number;
}

/** A tenant record, returned by the builder-only `GET /tenants` listing. */
export interface AuthrsTenant {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

/** A registered package with its synced tables and derived actions. */
export interface AuthrsPackageInfo {
  packageId: string;
  tables: string[];
  actions: string[];
}

/**
 * An action authrs declares for every tenant without any package sync, scoped to one resource
 * type — e.g. `{ action: "run", resourceType: "query" }` for architect-sdk saved queries.
 */
export interface AuthrsBuiltinAction {
  action: string;
  resourceType: string;
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
  sid: string;
  effect: "allow" | "deny";
  principals: string[];
  actions: string[];
  /**
   * Resource paths, e.g. `service:core/package:pkg/table:tbl` or `service:core/package:pkg/query:q`.
   * A `*` matches any characters (including `/`): `service:core/package:pkg/query:*` covers every
   * query in the package, `service:core/*` everything in the service, `*` any resource.
   */
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
  /**
   * When true, an existing permission with the same (tenant, name) is overwritten in place
   * (its Cedar document is replaced) instead of failing on the unique constraint. Used by
   * RBAC sync flows so re-syncing is idempotent.
   */
  overwrite?: boolean;
}

export interface AuthrsPackageSyncParams {
  packageId: string;
  tables: string[];
  /**
   * Subset of `tables` that expose extensible-fields routes (>= 1 `extensible` JSON column).
   * Authrs derives get/put/deleteExtensibleFields<Table> actions for these.
   */
  extensibleTables?: string[];
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

/** Partial update. Omitted fields are unchanged; `description: null` clears it. */
export interface AuthrsUpdateGroupParams {
  name?: string;
  description?: string | null;
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

/** Build the `q`/`sort`/`limit`/`offset` query fragment for a list request, omitting empties. */
function listQuery(options: AuthrsListQuery): Record<string, string | number | undefined> {
  const query: Record<string, string | number | undefined> = {};
  if (options.q !== undefined) query.q = options.q;
  if (options.sort !== undefined) query.sort = options.sort;
  if (options.limit !== undefined) query.limit = options.limit;
  if (options.offset !== undefined) query.offset = options.offset;
  return query;
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
      query?: Record<string, string | number | boolean | undefined>;
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
  signup(
    firstName: string,
    lastName: string,
    email: string,
    password: string,
    retypePassword: string,
    opts: { mobile?: string; countryCode?: string } = {},
  ) {
    return this.request<AuthrsUser | AuthrsVerificationPending>("POST", "/signup", {
      body: {
        firstName,
        lastName,
        email,
        password,
        retypePassword,
        ...(opts.mobile !== undefined ? { mobile: opts.mobile } : {}),
        ...(opts.countryCode !== undefined ? { countryCode: opts.countryCode } : {}),
      },
    });
  }
  /** Accept a verify-to-join invite (token from the signup email). The tenant is encoded in the token — no X-Tenant-ID needed. */
  verifyMembership(token: string) {
    return this.request<AuthrsMembership>("POST", "/signup/verify", { tenantId: null, body: { token } });
  }
  /**
   * Log in with email + password within the current tenant. Returns one of three shapes:
   * a session (`sessionToken`), an MFA challenge (`mfaRequired`), or a forced password change
   * (`passwordChangeRequired`). Narrow with `isLoginSuccess` / `isMfaRequired` /
   * `isPasswordChangeRequired`.
   */
  loginEmailPassword(email: string, password: string) {
    return this.request<AuthrsLoginResult>("POST", "/login/email-password", { body: { email, password } });
  }
  /** Log in with username + password. Returns an `AuthrsLoginResult` (see `loginEmailPassword`). */
  loginUsernamePassword(username: string, password: string) {
    return this.request<AuthrsLoginResult>("POST", "/login/username-password", { body: { username, password } });
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
    return this.request<AuthrsLoginResult>("POST", "/login/otp/verify", { body: { identifier, code, channel } });
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
  /**
   * Exchange an identity token for a tenant-scoped session. Bearer = identity token. Returns an
   * `AuthrsLoginResult` — the target tenant may still require MFA or a forced password change.
   */
  selectTenant(identityToken: string, tenantId: string) {
    return this.request<AuthrsLoginResult>("POST", "/login/select-tenant", { token: identityToken, tenantId: null, body: { tenantId } });
  }
  // OAuth / OpenID Connect (Google, Microsoft)
  /**
   * Start an OAuth sign-in for the current tenant. Returns the provider authorization URL to
   * navigate to, plus a `state` to keep and compare when the provider redirects back to the
   * tenant's configured `redirectUrl` (a page in your app).
   */
  startOAuth(provider: AuthrsOAuthProvider) {
    return this.request<AuthrsOAuthStart>("GET", `/oauth/${encodeURIComponent(provider)}`);
  }
  /**
   * Complete an OAuth sign-in from your `redirectUrl` page with the `code` and `state` the
   * provider appended. The tenant is taken from `state`, so no X-Tenant-ID is sent. Returns an
   * `AuthrsLoginResult` — the account may still require MFA.
   */
  oauthCallback(provider: AuthrsOAuthProvider, code: string, state: string) {
    return this.request<AuthrsLoginResult>("GET", `/oauth/${encodeURIComponent(provider)}/callback`, {
      tenantId: null,
      query: { code, state },
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
  /** List the tenants the current session's identity belongs to (for a tenant switcher or
   *  logging). Uses the session token — no re-authentication. */
  sessionTenants(token: string) {
    return this.request<{ currentTenantId: string; tenants: AuthrsTenantMembership[] }>(
      "GET", "/session/tenants", { token, tenantId: null },
    );
  }
  /** Switch to another tenant the same identity belongs to, without re-authenticating.
   *  Pass an active session token; returns a new session for the target tenant. */
  switchTenant(sessionToken: string, tenantId: string) {
    return this.request<AuthrsLoginResult>("POST", "/session/switch", { token: sessionToken, tenantId: null, body: { tenantId } });
  }
  /** Global logout: revoke every session of this identity across all of its tenants. */
  logoutGlobal(token: string) { return this.request<unknown>("POST", "/session/logout/global", { token, tenantId: null }); }
  /**
   * Complete a forced password change. Use the changeToken returned by login when
   * passwordChangeRequired is true. Returns a session, or an MFA challenge when the account
   * has MFA enabled (complete it with `validateMfa`).
   */
  forceChangePassword(changeToken: string, newPassword: string, retypePassword: string) {
    return this.request<AuthrsLoginSuccess | AuthrsMfaRequired>("POST", "/session/force-change-password", { body: { changeToken, newPassword, retypePassword } });
  }

  // MFA — authenticator app (TOTP) + backup codes. MFA belongs to the global identity, so it
  // applies in every tenant; no X-Tenant-ID is sent.
  /** Whether MFA is on for the session's identity, and how many backup codes remain. */
  mfaStatus(token: string) { return this.request<AuthrsMfaStatus>("GET", "/mfa/status", { token, tenantId: null }); }
  /** Start authenticator enrollment (session token). MFA is not active until `verifyMfa` succeeds. */
  enableMfa(token: string) { return this.request<AuthrsMfaEnrollment>("POST", "/mfa/enable", { token, tenantId: null }); }
  /** Confirm enrollment with the first 6-digit code from the app. Returns one-time backup codes. */
  verifyMfa(token: string, code: string) {
    return this.request<AuthrsMfaEnabled>("POST", "/mfa/verify", { token, tenantId: null, body: { code } });
  }
  /**
   * Complete a login that returned `{ mfaRequired, mfaToken }`. `code` is a 6-digit TOTP code
   * or a backup code. The mfaToken is valid for 5 minutes / 5 attempts.
   */
  validateMfa(mfaToken: string, code: string) {
    return this.request<AuthrsLoginSuccess>("POST", "/mfa/validate", { tenantId: null, body: { mfaToken, code } });
  }
  /** Turn MFA off (session token + a current TOTP or backup code). */
  disableMfa(token: string, code: string) {
    return this.request<{ enabled: false }>("POST", "/mfa/disable", { token, tenantId: null, body: { code } });
  }
  /** Replace all backup codes (session token + a current TOTP or backup code). */
  regenerateBackupCodes(token: string, code: string) {
    return this.request<{ backupCodes: string[] }>("POST", "/mfa/backup-codes", { token, tenantId: null, body: { code } });
  }

  // Admin — Users
  createUser(token: string, params: AuthrsCreateUserParams) {
    return this.request<AuthrsUser>("POST", "/admin/users", { token, body: params });
  }
  listUsers(token: string, options: AuthrsListQuery & { includeArchived?: boolean } = {}) {
    return this.request<{ users: AuthrsUser[] }>("GET", "/admin/users", {
      token,
      query: {
        ...(options.includeArchived ? { includeArchived: "true" } : {}),
        ...listQuery(options),
      },
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
  listRoles(token: string, options: AuthrsListQuery = {}) {
    return this.request<{ roles: AuthrsRole[] }>("GET", "/admin/roles", { token, query: listQuery(options) });
  }
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
  listPermissions(token: string, options: AuthrsListQuery = {}) {
    return this.request<{ permissions: AuthrsPermission[] }>("GET", "/admin/permissions", { token, query: listQuery(options) });
  }
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
  listGroups(token: string, options: AuthrsListQuery = {}) {
    return this.request<{ groups: AuthrsGroup[] }>("GET", "/admin/groups", { token, query: listQuery(options) });
  }
  getGroup(token: string, groupId: string) {
    return this.request<AuthrsGroup>("GET", `/admin/groups/${encodeURIComponent(groupId)}`, { token });
  }
  /** Partially update a group. Renaming does not change the group's `uid`. */
  updateGroup(token: string, groupId: string, params: AuthrsUpdateGroupParams) {
    return this.request<AuthrsGroup>("PATCH", `/admin/groups/${encodeURIComponent(groupId)}`, { token, body: params });
  }
  deleteGroup(token: string, groupId: string) {
    return this.request<unknown>("DELETE", `/admin/groups/${encodeURIComponent(groupId)}`, { token });
  }
  addUserToGroup(token: string, groupId: string, userId: string) {
    return this.request<unknown>("POST", `/admin/groups/${encodeURIComponent(groupId)}/users`, { token, body: { userId } });
  }
  /** List the members of a group. Returns full user objects (supports RSQL `q`/`sort`/pagination). */
  listGroupMembers(token: string, groupId: string, options: AuthrsListQuery = {}) {
    return this.request<{ users: AuthrsUser[] }>("GET", `/admin/groups/${encodeURIComponent(groupId)}/users`, { token, query: listQuery(options) });
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
  /**
   * List every registered package with its synced tables and derived actions, plus the built-in
   * actions declared for every tenant (absent on servers that predate built-in actions).
   */
  listPackageActions(token: string) {
    return this.request<{ packages: AuthrsPackageInfo[]; builtinActions?: AuthrsBuiltinAction[] }>(
      "GET",
      "/admin/packages/actions",
      { token },
    );
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

  // Platform (builder-only)
  /**
   * List every tenant on the server. Restricted to a session in the builder tenant holding an
   * allowed builder role — other callers get a 403 (`AuthrsError`). Uses the session token and
   * the client's configured tenant (which must be the builder tenant).
   */
  listTenants(token: string) {
    return this.request<{ tenants: AuthrsTenant[] }>("GET", "/tenants", { token });
  }
}

// Singleton for Next.js / server use
let _client: AuthrsClient | undefined;
export function getAuthrsClient(config?: AuthrsConfig): AuthrsClient {
  if (!_client || config) _client = new AuthrsClient(config);
  return _client;
}

export default AuthrsClient;
