use serde::Deserialize;
use serde_json::json;

use crate::types::{IdentityLogin, LoginResult, TenantMembership};
use crate::{AuthrsClient, Result};

/// SSO — tenant-less identity login + tenant selection (no X-Tenant-ID).
impl AuthrsClient {
    /// Log in by email across all tenants (single sign-on). Returns a short-lived identity
    /// token plus every tenant this identity belongs to. Exchange it via [`select_tenant`](Self::select_tenant).
    pub async fn login_identity(&self, email: &str, password: &str) -> Result<IdentityLogin> {
        self.post("/login/identity")
            .no_tenant()
            .json(json!({ "email": email, "password": password }))
            .send()
            .await
    }

    /// List the tenants for an identity token (the SSO tenant picker). Bearer = identity token.
    pub async fn identity_tenants(&self, identity_token: &str) -> Result<Vec<TenantMembership>> {
        #[derive(Deserialize)]
        struct Res {
            tenants: Vec<TenantMembership>,
        }
        let res: Res = self
            .get("/identity/tenants")
            .token(identity_token)
            .no_tenant()
            .send()
            .await?;
        Ok(res.tenants)
    }

    /// Exchange an identity token for a tenant-scoped session. Bearer = identity token. The
    /// target tenant may still require MFA or a forced password change.
    pub async fn select_tenant(
        &self,
        identity_token: &str,
        tenant_id: &str,
    ) -> Result<LoginResult> {
        self.post("/login/select-tenant")
            .token(identity_token)
            .no_tenant()
            .json(json!({ "tenantId": tenant_id }))
            .send()
            .await
    }
}
