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
  tenantId?: string;
  createdAt?: string;
}

interface AuthrsPermission {
  id: string;
  name: string;
  description?: string;
  tenantId?: string;
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

#### `resetUserPassword(token, userId, newPassword, retypePassword)`

Resets a user's password as an admin (no current password required).

```ts
await client.resetUserPassword("admin-token", "user-id", "newPass!", "newPass!");
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

---

### Admin — Permissions

#### `createPermission(token, name, description)`

Creates a new permission.

```ts
const permission = await client.createPermission("admin-token", "posts:write", "Can create and edit posts");
// returns AuthrsPermission
```

#### `listPermissions(token)`

Lists all permissions in the tenant.

```ts
const { permissions } = await client.listPermissions("admin-token");
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

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AUTHRS_BASE_URL` | Base URL of the Authrs server |
| `AUTHRS_TENANT_ID` | Tenant identifier sent as `X-Tenant-ID` header |
