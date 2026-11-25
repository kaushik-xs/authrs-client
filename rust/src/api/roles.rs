use serde::Deserialize;
use serde_json::{Value, json};

use crate::client::seg;
use crate::types::{ListQuery, Permission, Role, RoleAncestor};
use crate::{AuthrsClient, Result};

/// Admin — Roles.
impl AuthrsClient {
    /// Create a role. Pass `parent_role_id` to make it inherit permissions from a parent role.
    pub async fn create_role(
        &self,
        token: &str,
        name: &str,
        parent_role_id: Option<&str>,
    ) -> Result<Role> {
        let mut body = json!({ "name": name });
        if let Some(parent) = parent_role_id {
            body["parentRoleId"] = json!(parent);
        }
        self.post("/admin/roles")
            .token(token)
            .json(body)
            .send()
            .await
    }

    pub async fn list_roles(&self, token: &str, query: &ListQuery) -> Result<Vec<Role>> {
        #[derive(Deserialize)]
        struct Res {
            roles: Vec<Role>,
        }
        let res: Res = self
            .get("/admin/roles")
            .token(token)
            .list_query(query)
            .send()
            .await?;
        Ok(res.roles)
    }

    /// Set or clear a role's parent. Pass `None` to make the role a root (no parent).
    pub async fn set_role_parent(
        &self,
        token: &str,
        role_id: &str,
        parent_role_id: Option<&str>,
    ) -> Result<Value> {
        self.put(format!("/admin/roles/{}/parent", seg(role_id)))
            .token(token)
            .json(json!({ "parentRoleId": parent_role_id }))
            .send()
            .await
    }

    /// Get the ancestor chain (root-first) for a role.
    pub async fn get_role_hierarchy(
        &self,
        token: &str,
        role_id: &str,
    ) -> Result<Vec<RoleAncestor>> {
        #[derive(Deserialize)]
        struct Res {
            ancestors: Vec<RoleAncestor>,
        }
        let res: Res = self
            .get(format!("/admin/roles/{}/hierarchy", seg(role_id)))
            .token(token)
            .send()
            .await?;
        Ok(res.ancestors)
    }

    pub async fn list_role_permissions(
        &self,
        token: &str,
        role_id: &str,
    ) -> Result<Vec<Permission>> {
        #[derive(Deserialize)]
        struct Res {
            permissions: Vec<Permission>,
        }
        let res: Res = self
            .get(format!("/admin/roles/{}/permissions", seg(role_id)))
            .token(token)
            .send()
            .await?;
        Ok(res.permissions)
    }

    pub async fn attach_permission_to_role(
        &self,
        token: &str,
        role_id: &str,
        permission_id: &str,
    ) -> Result<Value> {
        self.post(format!("/admin/roles/{}/permissions", seg(role_id)))
            .token(token)
            .json(json!({ "permissionId": permission_id }))
            .send()
            .await
    }

    pub async fn detach_permission_from_role(
        &self,
        token: &str,
        role_id: &str,
        permission_id: &str,
    ) -> Result<Value> {
        self.delete(format!(
            "/admin/roles/{}/permissions/{}",
            seg(role_id),
            seg(permission_id)
        ))
        .token(token)
        .send()
        .await
    }
}
