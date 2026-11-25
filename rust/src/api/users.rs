use serde::Deserialize;
use serde_json::{Value, json};

use crate::client::seg;
use crate::types::{CreateUserParams, Group, ListQuery, Role, User};
use crate::{AuthrsClient, Result};

/// Admin — Users.
impl AuthrsClient {
    pub async fn create_user(&self, token: &str, params: &CreateUserParams) -> Result<User> {
        self.post("/admin/users")
            .token(token)
            .json(params)
            .send()
            .await
    }

    pub async fn list_users(
        &self,
        token: &str,
        query: &ListQuery,
        include_archived: bool,
    ) -> Result<Vec<User>> {
        #[derive(Deserialize)]
        struct Res {
            users: Vec<User>,
        }
        let mut req = self.get("/admin/users").token(token);
        if include_archived {
            req = req.query("includeArchived", "true");
        }
        let res: Res = req.list_query(query).send().await?;
        Ok(res.users)
    }

    pub async fn archive_user(&self, token: &str, user_id: &str) -> Result<Value> {
        self.post(format!("/admin/users/{}/archive", seg(user_id)))
            .token(token)
            .send()
            .await
    }

    pub async fn list_user_roles(&self, token: &str, user_id: &str) -> Result<Vec<Role>> {
        #[derive(Deserialize)]
        struct Res {
            roles: Vec<Role>,
        }
        let res: Res = self
            .get(format!("/admin/users/{}/roles", seg(user_id)))
            .token(token)
            .send()
            .await?;
        Ok(res.roles)
    }

    pub async fn assign_role(&self, token: &str, user_id: &str, role_id: &str) -> Result<Value> {
        self.post(format!("/admin/users/{}/roles", seg(user_id)))
            .token(token)
            .json(json!({ "roleId": role_id }))
            .send()
            .await
    }

    pub async fn remove_role(&self, token: &str, user_id: &str, role_id: &str) -> Result<Value> {
        self.delete(format!(
            "/admin/users/{}/roles/{}",
            seg(user_id),
            seg(role_id)
        ))
        .token(token)
        .send()
        .await
    }

    pub async fn reset_user_password(
        &self,
        token: &str,
        user_id: &str,
        new_password: &str,
        retype_password: &str,
        force_password_change: bool,
    ) -> Result<Value> {
        self.post(format!("/admin/users/{}/reset-password", seg(user_id)))
            .token(token)
            .json(json!({
                "newPassword": new_password,
                "retypePassword": retype_password,
                "forcePasswordChange": force_password_change,
            }))
            .send()
            .await
    }

    /// Set or clear the access expiry (RFC 3339) for a user. Pass `None` to remove the expiry
    /// (access becomes indefinite).
    pub async fn set_access_validity(
        &self,
        token: &str,
        user_id: &str,
        access_valid_until: Option<&str>,
    ) -> Result<Value> {
        self.patch(format!("/admin/users/{}/access-validity", seg(user_id)))
            .token(token)
            .json(json!({ "accessValidUntil": access_valid_until }))
            .send()
            .await
    }

    pub async fn list_user_groups(&self, token: &str, user_id: &str) -> Result<Vec<Group>> {
        #[derive(Deserialize)]
        struct Res {
            groups: Vec<Group>,
        }
        let res: Res = self
            .get(format!("/admin/users/{}/groups", seg(user_id)))
            .token(token)
            .send()
            .await?;
        Ok(res.groups)
    }
}
