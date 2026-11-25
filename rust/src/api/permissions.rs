use serde::Deserialize;
use serde_json::{Value, json};

use crate::client::seg;
use crate::types::{CreatePermissionParams, ListQuery, Permission, PermissionCheckResult};
use crate::{AuthrsClient, Result};

/// Admin — Permissions.
impl AuthrsClient {
    pub async fn create_permission(
        &self,
        token: &str,
        params: &CreatePermissionParams,
    ) -> Result<Permission> {
        self.post("/admin/permissions")
            .token(token)
            .json(params)
            .send()
            .await
    }

    pub async fn list_permissions(
        &self,
        token: &str,
        query: &ListQuery,
    ) -> Result<Vec<Permission>> {
        #[derive(Deserialize)]
        struct Res {
            permissions: Vec<Permission>,
        }
        let res: Res = self
            .get("/admin/permissions")
            .token(token)
            .list_query(query)
            .send()
            .await?;
        Ok(res.permissions)
    }

    pub async fn get_permission(&self, token: &str, permission_id: &str) -> Result<Permission> {
        self.get(format!("/admin/permissions/{}", seg(permission_id)))
            .token(token)
            .send()
            .await
    }

    pub async fn delete_permission(&self, token: &str, permission_id: &str) -> Result<Value> {
        self.delete(format!("/admin/permissions/{}", seg(permission_id)))
            .token(token)
            .send()
            .await
    }

    /// Check whether `user_id` may perform `action` on `resource`. Omit `action` to get
    /// per-action `decisions` for the resource. `context` defaults to `{}`.
    pub async fn check_permission(
        &self,
        token: &str,
        user_id: &str,
        resource: &str,
        action: Option<&str>,
        context: Option<Value>,
    ) -> Result<PermissionCheckResult> {
        let mut body = json!({
            "userId": user_id,
            "resource": resource,
            "context": context.unwrap_or_else(|| json!({})),
        });
        if let Some(action) = action {
            body["action"] = json!(action);
        }
        self.post("/admin/permissions/check")
            .token(token)
            .json(body)
            .send()
            .await
    }
}
