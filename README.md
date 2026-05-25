# @kaushik91/authrs-client

Typed TypeScript client for the [Authrs](https://github.com/kaushik-xs/authrs-client) multi-tenant authentication service.

- Zero external dependencies — uses native `fetch` (Node 18+, Next.js, Bun, Deno, browser)
- Full TypeScript types for all requests and responses
- Works in CJS and ESM projects

---

## Installation

```bash
npm install @kaushik91/authrs-client
# or
pnpm add @kaushik91/authrs-client
# or
yarn add @kaushik91/authrs-client
```

---

## Quick Start

```ts
import AuthrsClient from "@kaushik91/authrs-client";

const client = new AuthrsClient({
  baseUrl: "https://auth.example.com",
  tenantId: "my-tenant",
});

const session = await client.loginEmailPassword("user@example.com", "password");
console.log(session.sessionToken);
```

---

## Configuration

The client can be configured via the constructor or environment variables.

| Option | Env var | Default |
|--------|---------|---------|
| `baseUrl` | `AUTHRS_BASE_URL` | `http://localhost:3000` |
| `tenantId` | `AUTHRS_TENANT_ID` | `""` |

Constructor options take precedence over environment variables.

```ts
// From constructor
const client = new AuthrsClient({ baseUrl: "https://auth.example.com", tenantId: "acme" });

// From env vars (AUTHRS_BASE_URL, AUTHRS_TENANT_ID)
const client = new AuthrsClient();
```

### Singleton helper (Next.js / server)

```ts
import { getAuthrsClient } from "@kaushik91/authrs-client";

const client = getAuthrsClient(); // returns cached instance
const client2 = getAuthrsClient({ baseUrl: "..." }); // creates new instance and caches it
```

---

## Error Handling

All methods throw `AuthrsError` on non-2xx responses.

```ts
import { AuthrsError } from "@kaushik91/authrs-client";

try {
  await client.loginEmailPassword("user@example.com", "wrong-password");
} catch (err) {
  if (err instanceof AuthrsError) {
    console.error(err.message); // "Authrs POST /login/email-password → 401"
    console.error(err.status);  // 401
    console.error(err.body);    // parsed response body
  }
}
```

---

## Types

```ts
interface AuthrsConfig {
  baseUrl?: string;
  tenantId?: string;
}

interface AuthrsUser {
  id: string;
  email?: string;
  username?: string;
  mobile?: string;
  countryCode?: string;
  firstName?: string;
  lastName?: string;
  status?: string;
  isArchived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthrsSession {
  sessionToken: string;
  user?: AuthrsUser;
}

interface AuthrsRole {
  id: string;
  name: string;
  uid?: string;
  tenantId?: string;
  createdAt?: string;
}

interface AuthrsPermissionStatement {
  sid?: string;
  effect: "Allow" | "Deny";
  principals: string[];
  actions: string[];
  resources: string[];
  conditions?: unknown[];
}

interface AuthrsPermissionDocument {
  version: string;
  statements: AuthrsPermissionStatement[];
}

interface AuthrsPermission {
  id: string;
  name: string;
  description?: string;
  document?: AuthrsPermissionDocument;
  tenantId?: string;
}

interface AuthrsPermissionCheckResult {
  resource: string;
  action?: string;
  allowed?: boolean;           // present when a single action is checked
  decisions?: Record<string, boolean>; // present when all actions are checked
}

interface AuthrsCreatePermissionParams {
  name: string;
  description?: string;
  document: AuthrsPermissionDocument;
}

interface AuthrsPackageSyncParams {
  packageId: string;
  tables: string[];
  customActions?: string[];
}

interface AuthrsKvEntry {
  groupKey: string;
  key: string;
  value: string;
}

interface AuthrsCreateUserParams {
  firstName?: string;
  lastName?: string;
  email?: string;
  username?: string;
  mobile?: string;
  countryCode?: string;
  password?: string;
  retypePassword?: string;
}
```

---

## Methods

### Health

#### `healthCheck()`

Checks if the Authrs server is up. Does not require a tenant ID or auth token.

```ts
const { status } = await client.healthCheck();
// { status: "ok" }
```

#### `getMetrics()`

Returns Prometheus-style metrics for the Authrs server. Does not require a tenant ID or auth token.

```ts
const metrics = await client.getMetrics();
```

#### `getSpec()`

Returns the OpenAPI/Swagger spec for the Authrs server.

```ts
const spec = await client.getSpec();
```

---

### Authentication

All auth methods are tenant-scoped (the configured `tenantId` is sent automatically).

#### `signup(firstName, lastName, email, password, retypePassword)`

Register a new user in the tenant.

```ts
const user = await client.signup("Jane", "Doe", "jane@example.com", "s3cr3t!", "s3cr3t!");
// returns AuthrsUser
```

#### `loginEmailPassword(email, password)`

Log in with email and password. Returns a session token.

```ts
const session = await client.loginEmailPassword("jane@example.com", "s3cr3t!");
// { sessionToken: "...", user: { ... } }
```

#### `loginUsernamePassword(username, password)`

Log in with a username and password.

```ts
const session = await client.loginUsernamePassword("jdoe", "s3cr3t!");
```

#### `loginEmailOtpRequest(email)`

Request an OTP sent to the user's email.

```ts
await client.loginEmailOtpRequest("jane@example.com");
```

#### `loginMobileOtpRequest(mobile, countryCode)`

Request an OTP sent via SMS to the user's mobile number.

```ts
await client.loginMobileOtpRequest("9876543210", "+91");
```

#### `loginWhatsAppOtpRequest(mobile, countryCode)`

Request an OTP sent via WhatsApp.

```ts
await client.loginWhatsAppOtpRequest("9876543210", "+91");
```

#### `loginOtpVerify(identifier, code, channel)`

Verify an OTP and receive a session token. `channel` is `"email"`, `"sms"`, or `"whatsapp"`.

```ts
const session = await client.loginOtpVerify("jane@example.com", "123456", "email");
// returns AuthrsSession
```

#### `oauthAuthorizeUrl(provider)`

Returns the OAuth authorization URL for the given provider (e.g. `"google"`, `"github"`). Redirect the user to this URL to start the OAuth flow.

```ts
const url = client.oauthAuthorizeUrl("google");
// "https://auth.example.com/oauth/google"
window.location.href = url;
```

> This is a synchronous method — it does not make a network request.

#### `oauthCallback(provider, code, state?, token?)`

Completes the OAuth flow by exchanging the authorization code returned by the provider. Call this from your OAuth callback route.

```ts
const session = await client.oauthCallback("google", req.query.code, req.query.state);
// returns AuthrsSession
```

#### `forgotPassword(email)`

Sends a password reset email.

```ts
await client.forgotPassword("jane@example.com");
```

#### `resetPassword(token, newPassword, retypePassword)`

Resets the password using the token from the reset email.

```ts
await client.resetPassword("reset-token-from-email", "newPass!", "newPass!");
```

---

### Session

Session methods use a bearer token. Most do not send a `X-Tenant-ID` header (the session is global).

#### `validateSession(token)`

Checks whether a session token is still valid.

```ts
const { valid } = await client.validateSession("session-token");
```

#### `me(token)`

Returns the currently authenticated user's profile.

```ts
const user = await client.me("session-token");
// returns AuthrsUser
```

#### `changePassword(token, currentPassword, newPassword, retypePassword)`

Changes the authenticated user's password.

```ts
await client.changePassword("session-token", "oldPass!", "newPass!", "newPass!");
```

#### `logout(token)`

Invalidates the current session.

```ts
await client.logout("session-token");
```

#### `logoutAll(token)`

Invalidates all sessions for the current user across all devices. This call is tenant-scoped.

```ts
await client.logoutAll("session-token");
```

#### `forceChangePassword(changeToken, newPassword, retypePassword)`

Completes a forced password change. When a login response includes `passwordChangeRequired: true`, the server returns a `changeToken` instead of a full session token. Pass that token here to set a new password and receive a valid session.

```ts
const login = await client.loginEmailPassword("user@example.com", "temp-password");
// login.passwordChangeRequired === true
const session = await client.forceChangePassword(login.changeToken, "newPass!", "newPass!");
// session.sessionToken is now a valid full session token
```

---

### MFA (Multi-Factor Authentication)

MFA methods require a session token and are tenant-scoped.

#### `enableMfa(token)`

Initiates MFA setup for the authenticated user (e.g. returns a TOTP QR code URI).

```ts
const result = await client.enableMfa("session-token");
```

#### `verifyMfa(token, code)`

Confirms and activates MFA using the setup code.

```ts
await client.verifyMfa("session-token", "123456");
```

#### `validateMfa(token, code)`

Validates an MFA code during login (second factor step).

```ts
await client.validateMfa("session-token", "123456");
```

---

### Admin — Users

All admin methods require an admin session token.

#### `createUser(token, params)`

Creates a new user. Fields are all optional so you can create users with any combination of identifier (email, username, or mobile).

```ts
const user = await client.createUser("admin-token", {
  firstName: "John",
  lastName: "Smith",
  email: "john@example.com",
  password: "tempPass!",
  retypePassword: "tempPass!",
});
```

#### `listUsers(token, options?)`

Lists all users in the tenant. Pass `{ includeArchived: true }` to include soft-deleted users.

```ts
const { users } = await client.listUsers("admin-token");
const { users: all } = await client.listUsers("admin-token", { includeArchived: true });
```

#### `archiveUser(token, userId)`

Soft-deletes a user (sets `isArchived: true`).

```ts
await client.archiveUser("admin-token", "user-id");
```

#### `resetUserPassword(token, userId, newPassword, retypePassword, forcePasswordChange?)`

Resets a user's password as an admin (no current password required). Set `forcePasswordChange: true` to require the user to change their password on next login.

```ts
await client.resetUserPassword("admin-token", "user-id", "newPass!", "newPass!");
// Force user to change password on next login:
await client.resetUserPassword("admin-token", "user-id", "tempPass!", "tempPass!", true);
```

---

### Admin — Roles

#### `createRole(token, name)`

Creates a new role.

```ts
const role = await client.createRole("admin-token", "editor");
// returns AuthrsRole
```

#### `listRoles(token)`

Lists all roles in the tenant.

```ts
const { roles } = await client.listRoles("admin-token");
```

#### `listUserRoles(token, userId)`

Lists roles assigned to a specific user.

```ts
const { roles } = await client.listUserRoles("admin-token", "user-id");
```

#### `assignRole(token, userId, roleId)`

Assigns a role to a user.

```ts
await client.assignRole("admin-token", "user-id", "role-id");
```

#### `removeRole(token, userId, roleId)`

Removes a role from a user.

```ts
await client.removeRole("admin-token", "user-id", "role-id");
```

#### `listRolePermissions(token, roleId)`

Lists all permissions attached to a role.

```ts
const { permissions } = await client.listRolePermissions("admin-token", "role-id");
```

#### `attachPermissionToRole(token, roleId, permissionId)`

Attaches a permission to a role. The policy takes effect on the next request (cache evicted).

```ts
await client.attachPermissionToRole("admin-token", "role-id", "permission-id");
```

#### `detachPermissionFromRole(token, roleId, permissionId)`

Removes a permission from a role.

```ts
await client.detachPermissionFromRole("admin-token", "role-id", "permission-id");
```

---

### Admin — Permissions

Permissions are Cedar policy documents that control what actions users (via their roles) can perform on resources.

#### `createPermission(token, params)`

Creates a new Cedar permission policy. The `document` field is validated before saving.

Principals accept: `role:<uid>`, `role:<name>`, `user:<uuid>`, `user:<email>`, `user:<username>`, or `*`.

```ts
const permission = await client.createPermission("admin-token", {
  name: "allow-editor-read-materials",
  description: "Allow editors to read materials",
  document: {
    version: "1.0",
    statements: [
      {
        sid: "AllowEditorReadMaterials",
        effect: "Allow",
        principals: ["role:editor"],
        actions: ["getMaterials"],
        resources: ["service:core/package:manufacturing_core/table:materials"],
        conditions: [],
      },
    ],
  },
});
// returns AuthrsPermission
```

#### `listPermissions(token)`

Lists all permissions in the tenant.

```ts
const { permissions } = await client.listPermissions("admin-token");
```

#### `getPermission(token, permissionId)`

Gets a single permission by ID.

```ts
const permission = await client.getPermission("admin-token", "permission-id");
```

#### `deletePermission(token, permissionId)`

Deletes a permission and evicts the tenant's policy cache.

```ts
await client.deletePermission("admin-token", "permission-id");
```

#### `checkPermission(token, userId, resource, action?, context?)`

Evaluates Cedar policy for a user against a resource.

- Pass `action` to check a **single action** → returns `{ resource, action, allowed: boolean }`.
- Omit `action` to check **all actions** for the resource scope → returns `{ resource, decisions: { actionName: boolean, ... } }`.

Resource scopes: `service:core/package:pkg/table:tbl` (table), `service:core/package:pkg` (package), `service:core` (service).

```ts
// Single action
const result = await client.checkPermission(
  "admin-token",
  "user-id",
  "service:core/package:manufacturing_core/table:materials",
  "getMaterials",
);
// { resource: "...", action: "getMaterials", allowed: true }

// All actions for a table
const result = await client.checkPermission(
  "admin-token",
  "user-id",
  "service:core/package:manufacturing_core/table:materials",
);
// { resource: "...", decisions: { getMaterials: true, postMaterials: false, ... } }
```

---

### Admin — Packages

#### `syncPackage(token, params)`

Registers or updates a package's tables and custom actions. Rebuilds the Cedar schema and evicts all policy caches. Standard CRUD actions (`getMaterials`, `postMaterials`, etc.) are auto-generated from table names. Called automatically by `architect-sdk` after a package install.

```ts
await client.syncPackage("admin-token", {
  packageId: "manufacturing_core",
  tables: ["materials", "bom_headers", "bom_lines"],
  customActions: ["approveBom", "rejectBom"],
});
```

---

### Admin — KV Store

A key-value store scoped to the tenant, useful for storing per-tenant configuration.

#### `listKvKeys(token)`

Lists all KV entries for the tenant.

```ts
const entries = await client.listKvKeys("admin-token");
// returns AuthrsKvEntry[]
```

#### `getKvValue(token, groupKey, key)`

Gets a single KV entry by group and key.

```ts
const entry = await client.getKvValue("admin-token", "config", "theme");
// { groupKey: "config", key: "theme", value: "dark" }
```

#### `setKvValue(token, groupKey, key, value)`

Creates or updates a KV entry.

```ts
await client.setKvValue("admin-token", "config", "theme", "dark");
```

#### `deleteKvValue(token, groupKey, key)`

Deletes a KV entry.

```ts
await client.deleteKvValue("admin-token", "config", "theme");
```

---

## Common Patterns

### Store the session token after login

```ts
const session = await client.loginEmailPassword(email, password);
localStorage.setItem("token", session.sessionToken);
```

### Middleware / route guard (Next.js)

```ts
import { getAuthrsClient } from "@kaushik91/authrs-client";

export async function middleware(request: Request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return new Response("Unauthorized", { status: 401 });

  const { valid } = await getAuthrsClient().validateSession(token);
  if (!valid) return new Response("Unauthorized", { status: 401 });
}
```

### OTP login flow

```ts
// Step 1: request OTP
await client.loginEmailOtpRequest("user@example.com");

// Step 2: user enters code from email
const session = await client.loginOtpVerify("user@example.com", userEnteredCode, "email");
```

### MFA login flow

```ts
// Initial login returns a partial/pre-MFA session token
const session = await client.loginEmailPassword(email, password);

// Validate MFA to fully authenticate
await client.validateMfa(session.sessionToken, totpCode);
```

### Forced password change flow

```ts
const login = await client.loginEmailPassword(email, temporaryPassword);

if (login.passwordChangeRequired) {
  // Redirect user to a change-password screen, then:
  const session = await client.forceChangePassword(login.changeToken, newPassword, newPassword);
  // session.sessionToken is now a valid full session
}
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AUTHRS_BASE_URL` | Base URL of the Authrs server |
| `AUTHRS_TENANT_ID` | Tenant identifier sent as `X-Tenant-ID` header |
