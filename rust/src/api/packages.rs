use serde_json::Value;

use crate::types::{PackageActions, PackageSyncParams};
use crate::{AuthrsClient, Result};

/// Admin — Packages.
impl AuthrsClient {
    pub async fn sync_package(&self, token: &str, params: &PackageSyncParams) -> Result<Value> {
        self.post("/admin/packages/sync")
            .token(token)
            .json(params)
            .send()
            .await
    }

    /// List every registered package with its synced tables and derived actions, plus the
    /// built-in actions declared for every tenant (`None` on servers that predate them).
    pub async fn list_package_actions(&self, token: &str) -> Result<PackageActions> {
        self.get("/admin/packages/actions")
            .token(token)
            .send()
            .await
    }
}
