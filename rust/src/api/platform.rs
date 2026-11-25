use serde::Deserialize;

use crate::types::Tenant;
use crate::{AuthrsClient, Result};

/// Platform (builder-only).
impl AuthrsClient {
    /// List every tenant on the server. Restricted to a session in the builder tenant holding an
    /// allowed builder role — other callers get a 403 ([`Error::Api`](crate::Error::Api)). Uses
    /// the session token and the client's configured tenant (which must be the builder tenant).
    pub async fn list_tenants(&self, token: &str) -> Result<Vec<Tenant>> {
        #[derive(Deserialize)]
        struct Res {
            tenants: Vec<Tenant>,
        }
        let res: Res = self.get("/tenants").token(token).send().await?;
        Ok(res.tenants)
    }
}
