# authrs-client (Rust)

Typed async Rust client for the [Authrs](https://github.com/kaushik-xs/authrs-client) multi-tenant authentication service.

It mirrors the TypeScript client [`@kaushik91/authrs-client`](https://www.npmjs.com/package/@kaushik91/authrs-client) method-for-method, and both are released together under the same version number.

## Installation

```sh
cargo add authrs-client
```

TLS defaults to `rustls`. To use the platform TLS stack instead:

```toml
authrs-client = { version = "*", default-features = false, features = ["native-tls"] }
```

## Quick Start

```rust
use authrs_client::{AuthrsClient, AuthrsConfig, LoginResult};

#[tokio::main]
async fn main() -> authrs_client::Result<()> {
    let client = AuthrsClient::new(AuthrsConfig {
        base_url: Some("https://auth.example.com".into()),
        tenant_id: Some("acme".into()),
        ..Default::default()
    });

    let token = match client.login_email_password("jane@acme.com", "s3cret").await? {
        LoginResult::Success(s) => s.session_token,
        LoginResult::MfaRequired(m) => client.validate_mfa(&m.mfa_token, "123456").await?.session_token,
        LoginResult::PasswordChangeRequired(p) => {
            match client.force_change_password(&p.change_token, "n3w", "n3w").await? {
                LoginResult::Success(s) => s.session_token,
                other => panic!("unexpected: {other:?}"),
            }
        }
    };

    let me = client.me(&token).await?;
    println!("{} has roles {:?}", me.user_id, me.roles);
    Ok(())
}
```

## Configuration

| Field         | Env var            | Default                 |
| ------------- | ------------------ | ----------------------- |
| `base_url`    | `AUTHRS_BASE_URL`  | `http://localhost:3000` |
| `tenant_id`   | `AUTHRS_TENANT_ID` | `""` (no `X-Tenant-ID`) |
| `http_client` | —                  | `reqwest::Client::default()` |

`AuthrsClient::from_env()` builds a client purely from the environment. The client is cheap to `clone()` — clones share one connection pool, so keep one per process instead of the TS `getAuthrsClient()` singleton.

## Error Handling

Every method returns `authrs_client::Result<T>`. Non-2xx responses become `Error::Api { method, path, status, body }`:

```rust
use authrs_client::Error;

match client.list_tenants(&token).await {
    Err(Error::Api { status: 403, body, .. }) => eprintln!("not a builder: {body}"),
    Err(e) => return Err(e),
    Ok(tenants) => println!("{} tenants", tenants.len()),
}
```

`err.status()` and `err.body()` are also available as accessors.

## Mapping from the TypeScript client

- Method names are snake_case: `loginEmailPassword` → `login_email_password`, `loginWhatsAppOtpRequest` → `login_whatsapp_otp_request`.
- Types drop the `Authrs` prefix: `AuthrsUser` → `User`, `AuthrsLoginResult` → `LoginResult` (an enum — `match` on it instead of `isLoginSuccess`/`isMfaRequired`/`isPasswordChangeRequired`, or use the `is_*` helpers).
- Optional trailing arguments become `Option<_>` (`create_role(token, name, None)`); options objects become structs with `Default` (`ListQuery`, `SignupOptions`, `CreateUserParams`, …).
- `listUsers(token, { includeArchived, ...query })` → `list_users(token, &query, include_archived)`.
- Single-field list wrappers are unwrapped: `listRoles` returns `{ roles }` in TS and `Vec<Role>` here; availability checks return `bool`.
- `UpdateGroupParams.description` is `Option<Option<String>>`: `None` leaves it unchanged, `Some(None)` clears it.
- Endpoints the TS client types as `unknown` return `serde_json::Value`.

See the [TypeScript README](../typescript/README.md) for per-endpoint behaviour (tenant scoping, SSO, MFA, RSQL filters, permission documents) — it applies unchanged.
