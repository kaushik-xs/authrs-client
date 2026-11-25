//! Typed async Rust client for the Authrs multi-tenant authentication service.
//!
//! Mirrors the TypeScript client (`@kaushik91/authrs-client`) method-for-method, with
//! snake_case names (`loginEmailPassword` → [`AuthrsClient::login_email_password`]).
//!
//! Configuration (env vars or [`AuthrsConfig`]):
//!
//! - `AUTHRS_BASE_URL`  — Authrs server base URL (default: `http://localhost:3000`)
//! - `AUTHRS_TENANT_ID` — Tenant identifier (default: `""`)
//!
//! ```no_run
//! use authrs_client::{AuthrsClient, AuthrsConfig, LoginResult};
//!
//! # async fn run() -> authrs_client::Result<()> {
//! let client = AuthrsClient::new(AuthrsConfig {
//!     base_url: Some("https://auth.example.com".into()),
//!     tenant_id: Some("acme".into()),
//!     ..Default::default()
//! });
//!
//! match client.login_email_password("jane@acme.com", "s3cret").await? {
//!     LoginResult::Success(s) => println!("session: {}", s.session_token),
//!     LoginResult::MfaRequired(m) => { /* client.validate_mfa(&m.mfa_token, code) */ }
//!     LoginResult::PasswordChangeRequired(p) => { /* client.force_change_password(&p.change_token, ..) */ }
//! }
//! # Ok(())
//! # }
//! ```

mod api;
mod client;
mod error;
pub mod types;

pub use client::{AuthrsClient, AuthrsConfig};
pub use error::{Error, Result};
pub use types::*;
