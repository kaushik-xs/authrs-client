use serde_json::{Value, json};

use crate::types::{LoginResult, Me, SessionInfo, SessionTenants};
use crate::{AuthrsClient, Result};

/// Session (no X-Tenant-ID except `logout_all`).
impl AuthrsClient {
    pub async fn validate_session(&self, token: &str) -> Result<SessionInfo> {
        self.get("/session/validate")
            .token(token)
            .no_tenant()
            .send()
            .await
    }

    pub async fn me(&self, token: &str) -> Result<Me> {
        self.get("/session/me")
            .token(token)
            .no_tenant()
            .send()
            .await
    }

    pub async fn change_password(
        &self,
        token: &str,
        current_password: &str,
        new_password: &str,
        retype_password: &str,
    ) -> Result<Value> {
        self.post("/session/change-password")
            .token(token)
            .no_tenant()
            .json(json!({
                "currentPassword": current_password,
                "newPassword": new_password,
                "retypePassword": retype_password,
            }))
            .send()
            .await
    }

    pub async fn logout(&self, token: &str) -> Result<Value> {
        self.post("/session/logout")
            .token(token)
            .no_tenant()
            .send()
            .await
    }

    /// Revoke all sessions for the user in the current tenant.
    pub async fn logout_all(&self, token: &str) -> Result<Value> {
        self.post("/session/logout/all").token(token).send().await
    }

    /// List the tenants the current session's identity belongs to (for a tenant switcher or
    /// logging). Uses the session token — no re-authentication.
    pub async fn session_tenants(&self, token: &str) -> Result<SessionTenants> {
        self.get("/session/tenants")
            .token(token)
            .no_tenant()
            .send()
            .await
    }

    /// Switch to another tenant the same identity belongs to, without re-authenticating.
    /// Pass an active session token; returns a new session for the target tenant.
    pub async fn switch_tenant(&self, session_token: &str, tenant_id: &str) -> Result<LoginResult> {
        self.post("/session/switch")
            .token(session_token)
            .no_tenant()
            .json(json!({ "tenantId": tenant_id }))
            .send()
            .await
    }

    /// Global logout: revoke every session of this identity across all of its tenants.
    pub async fn logout_global(&self, token: &str) -> Result<Value> {
        self.post("/session/logout/global")
            .token(token)
            .no_tenant()
            .send()
            .await
    }

    /// Complete a forced password change. Use the `change_token` returned by login when a
    /// password change is required. Returns a session, or an MFA challenge when the account has
    /// MFA enabled (complete it with [`validate_mfa`](Self::validate_mfa)).
    pub async fn force_change_password(
        &self,
        change_token: &str,
        new_password: &str,
        retype_password: &str,
    ) -> Result<LoginResult> {
        self.post("/session/force-change-password")
            .json(json!({
                "changeToken": change_token,
                "newPassword": new_password,
                "retypePassword": retype_password,
            }))
            .send()
            .await
    }
}
