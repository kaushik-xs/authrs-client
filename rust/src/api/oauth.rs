use crate::client::seg;
use crate::types::{LoginResult, OAuthProvider, OAuthStart};
use crate::{AuthrsClient, Result};

/// OAuth / OpenID Connect (Google, Microsoft).
impl AuthrsClient {
    /// Start an OAuth sign-in for the current tenant. Returns the provider authorization URL to
    /// navigate to, plus a `state` to keep and compare when the provider redirects back to the
    /// tenant's configured `redirectUrl` (a page in your app).
    pub async fn start_oauth(&self, provider: OAuthProvider) -> Result<OAuthStart> {
        self.get(format!("/oauth/{}", seg(provider.as_str())))
            .send()
            .await
    }

    /// Complete an OAuth sign-in with the `code` and `state` the provider appended. The tenant
    /// is taken from `state`, so no X-Tenant-ID is sent. The account may still require MFA.
    pub async fn oauth_callback(
        &self,
        provider: OAuthProvider,
        code: &str,
        state: &str,
    ) -> Result<LoginResult> {
        self.get(format!("/oauth/{}/callback", seg(provider.as_str())))
            .no_tenant()
            .query("code", code)
            .query("state", state)
            .send()
            .await
    }
}
