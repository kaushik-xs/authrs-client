//! Request and response types. Field names are snake_case in Rust and camelCase on the wire.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

// ---------------------------------------------------------------------------
// Users & sessions
// ---------------------------------------------------------------------------

/// A per-tenant membership of a global identity. `id` is the membership id; `identity_id` is
/// the shared identity. Profile fields (name, email, mobile) and `mfa_enabled` are sourced
/// from that identity; `username`, `status`, and `access_valid_until` are per-tenant.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: String,
    /// The global identity behind this membership (same human across tenants).
    pub identity_id: Option<String>,
    pub email: Option<String>,
    pub username: Option<String>,
    pub mobile: Option<String>,
    pub country_code: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub status: Option<String>,
    pub mfa_enabled: Option<bool>,
    pub is_archived: Option<bool>,
    pub access_valid_until: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub session_token: String,
    /// Session expiry (RFC 3339). Present on successful logins and tenant selection.
    pub expires_at: Option<String>,
    pub user: Option<User>,
}

/// Successful login: a session token and its expiry.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginSuccess {
    pub session_token: String,
    /// Session expiry (RFC 3339).
    #[serde(default)]
    pub expires_at: String,
}

/// MFA challenge: the credentials were valid but the account has MFA enabled. Exchange the
/// `mfa_token` (with the user's TOTP code) via [`validate_mfa`](crate::AuthrsClient::validate_mfa).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MfaRequired {
    pub mfa_required: bool,
    pub mfa_token: String,
}

/// Forced password change: the credentials were valid but the account must set a new password
/// before a session is issued. Pass the `change_token` to
/// [`force_change_password`](crate::AuthrsClient::force_change_password).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasswordChangeRequired {
    pub password_change_required: bool,
    pub change_token: String,
}

/// The three shapes a login-style endpoint can return.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum LoginResult {
    Success(LoginSuccess),
    MfaRequired(MfaRequired),
    PasswordChangeRequired(PasswordChangeRequired),
}

impl LoginResult {
    pub fn is_success(&self) -> bool {
        matches!(self, LoginResult::Success(_))
    }
    pub fn is_mfa_required(&self) -> bool {
        matches!(self, LoginResult::MfaRequired(_))
    }
    pub fn is_password_change_required(&self) -> bool {
        matches!(self, LoginResult::PasswordChangeRequired(_))
    }
    /// The session token, when the login succeeded outright.
    pub fn session_token(&self) -> Option<&str> {
        match self {
            LoginResult::Success(s) => Some(&s.session_token),
            _ => None,
        }
    }
}

/// OAuth / OpenID Connect providers supported by Authrs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OAuthProvider {
    Google,
    Microsoft,
}

impl OAuthProvider {
    pub fn as_str(&self) -> &'static str {
        match self {
            OAuthProvider::Google => "google",
            OAuthProvider::Microsoft => "microsoft",
        }
    }
}

/// Returned by `start_oauth`: navigate the browser to `authorization_url` and keep `state`
/// to compare against the `state` the provider sends back.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthStart {
    pub authorization_url: String,
    pub state: String,
}

/// Delivery channel for a one-time login code.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OtpChannel {
    Email,
    Sms,
    #[serde(rename = "whatsapp")]
    WhatsApp,
}

// ---------------------------------------------------------------------------
// MFA
// ---------------------------------------------------------------------------

/// Whether MFA is on for the session's identity (MFA is global across tenants).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MfaStatus {
    pub enabled: bool,
    pub backup_codes_remaining: u32,
}

/// Returned by `enable_mfa`: add the account to an authenticator app by rendering
/// `otpauth_url` as a QR code, or by typing `secret` manually.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MfaEnrollment {
    /// Base32 TOTP secret for manual entry.
    pub secret: String,
    /// `otpauth://totp/...` URI — render as a QR code.
    pub otpauth_url: String,
}

/// Returned by `verify_mfa`: MFA is now on. Show the backup codes once — they are not
/// retrievable later.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MfaEnabled {
    pub enabled: bool,
    pub backup_codes: Vec<String>,
}

/// Returned by `disable_mfa`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MfaDisabled {
    pub enabled: bool,
}

/// Returned by `regenerate_backup_codes`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupCodes {
    pub backup_codes: Vec<String>,
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

/// Common list query for RSQL-capable admin list endpoints.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ListQuery {
    /// RSQL filter expression, e.g. `status==active;email==*@acme.com`.
    pub q: Option<String>,
    /// Sort spec, e.g. `createdAt,desc` or `email`.
    pub sort: Option<String>,
    /// Page size (server clamps to a max, default page 50).
    pub limit: Option<u32>,
    /// Row offset for pagination.
    pub offset: Option<u32>,
}

// ---------------------------------------------------------------------------
// Tenants & SSO
// ---------------------------------------------------------------------------

/// A tenant record, returned by the builder-only `GET /tenants` listing.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tenant {
    pub id: String,
    pub name: String,
    pub status: String,
    pub created_at: String,
}

/// A tenant an identity belongs to.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TenantMembership {
    pub tenant_id: String,
    pub status: String,
}

/// Result of a tenant-less SSO login: a short-lived identity token plus the tenants this
/// identity belongs to. Exchange the token via `select_tenant` for a tenant-scoped session.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentityLogin {
    pub identity_token: String,
    pub tenants: Vec<TenantMembership>,
}

/// Returned by `session_tenants`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionTenants {
    pub current_tenant_id: String,
    pub tenants: Vec<TenantMembership>,
}

/// Session metadata returned by `GET /session/validate`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub tenant_id: String,
    pub user_id: String,
    /// The global identity behind this membership (same human across tenants).
    pub identity_id: String,
    pub roles: Vec<String>,
    pub permissions: Vec<String>,
    pub expires_at: String,
}

/// Current-session info returned by `GET /session/me`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Me {
    pub user_id: String,
    pub identity_id: String,
    pub roles: Vec<String>,
    pub permissions: Vec<String>,
    pub expires_at: String,
    pub user: User,
}

// ---------------------------------------------------------------------------
// Signup
// ---------------------------------------------------------------------------

/// Optional fields for `signup`.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SignupOptions {
    pub mobile: Option<String>,
    pub country_code: Option<String>,
}

/// Returned by `signup` when the email/mobile already maps to an existing global identity:
/// a verify-to-join email is sent to the owner and no account is created synchronously.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerificationPending {
    pub message: String,
}

/// Result of `signup`: either the created user or a pending verify-to-join.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum SignupResult {
    User(Box<User>),
    VerificationPending(VerificationPending),
}

/// Membership created by accepting a verify-to-join invite (`POST /signup/verify`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Membership {
    pub id: String,
    pub tenant_id: String,
    pub status: String,
}

// ---------------------------------------------------------------------------
// Roles & permissions
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Role {
    pub id: String,
    pub name: String,
    pub uid: Option<String>,
    /// Parent role id when this role inherits from another role. `None` for root roles.
    pub parent_role_id: Option<String>,
    pub tenant_id: Option<String>,
    pub created_at: Option<String>,
}

/// A single ancestor in a role's hierarchy chain.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoleAncestor {
    pub id: String,
    pub name: String,
    pub uid: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Effect {
    Allow,
    Deny,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionStatement {
    pub sid: String,
    pub effect: Effect,
    pub principals: Vec<String>,
    pub actions: Vec<String>,
    /// Resource paths, e.g. `service:core/package:pkg/table:tbl`,
    /// `service:core/package:pkg/query:q` or `service:core/package:pkg/view:v`.
    /// A `*` matches any characters (including `/`): `service:core/package:pkg/query:*` covers
    /// every query in the package, `service:core/*` everything in the service, `*` any resource.
    pub resources: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub conditions: Option<Vec<Value>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionDocument {
    pub version: String,
    pub statements: Vec<PermissionStatement>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Permission {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub document: Option<PermissionDocument>,
    pub tenant_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionCheckResult {
    pub resource: String,
    pub action: Option<String>,
    pub allowed: Option<bool>,
    pub decisions: Option<HashMap<String, bool>>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePermissionParams {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub document: PermissionDocument,
    /// When true, an existing permission with the same (tenant, name) is overwritten in place
    /// (its Cedar document is replaced) instead of failing on the unique constraint. Used by
    /// RBAC sync flows so re-syncing is idempotent.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub overwrite: Option<bool>,
}

// ---------------------------------------------------------------------------
// Packages
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageSyncParams {
    pub package_id: String,
    pub tables: Vec<String>,
    /// Subset of `tables` that expose extensible-fields routes (>= 1 `extensible` JSON column).
    /// Authrs derives get/put/deleteExtensibleFields<Table> actions for these.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extensible_tables: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_actions: Option<Vec<String>>,
}

/// A registered package with its synced tables and derived actions.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageInfo {
    pub package_id: String,
    pub tables: Vec<String>,
    pub actions: Vec<String>,
}

/// An action authrs declares for every tenant without any package sync, scoped to one resource
/// type — e.g. `{ action: "run", resource_type: "query" }` for architect-sdk saved queries, or
/// `{ action: "get", resource_type: "view" }` / `{ action: "refresh", resource_type: "view" }`
/// for architect-sdk package views.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuiltinAction {
    pub action: String,
    pub resource_type: String,
}

/// Returned by `list_package_actions`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageActions {
    pub packages: Vec<PackageInfo>,
    /// Absent on servers that predate built-in actions.
    pub builtin_actions: Option<Vec<BuiltinAction>>,
}

// ---------------------------------------------------------------------------
// KV store
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KvEntry {
    pub group_key: String,
    pub key: String,
    pub value: String,
}

// ---------------------------------------------------------------------------
// Admin params
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateUserParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mobile: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retype_password: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub id: String,
    pub name: String,
    pub uid: String,
    pub description: Option<String>,
    pub tenant_id: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGroupParams {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// Partial update. `None` fields are unchanged; `description: Some(None)` clears it.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGroupParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<Option<String>>,
}

/// Returned by `health_check`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthStatus {
    pub status: String,
}
