use serde::Deserialize;
use serde_json::{Value, json};

use crate::client::seg;
use crate::types::{CreateGroupParams, Group, ListQuery, Role, UpdateGroupParams, User};
use crate::{AuthrsClient, Result};

/// Admin — Groups.
impl AuthrsClient {
    pub async fn create_group(&self, token: &str, params: &CreateGroupParams) -> Result<Group> {
        self.post("/admin/groups")
            .token(token)
            .json(params)
            .send()
            .await
    }

    pub async fn list_groups(&self, token: &str, query: &ListQuery) -> Result<Vec<Group>> {
        #[derive(Deserialize)]
        struct Res {
            groups: Vec<Group>,
        }
        let res: Res = self
            .get("/admin/groups")
            .token(token)
            .list_query(query)
            .send()
            .await?;
        Ok(res.groups)
    }

    pub async fn get_group(&self, token: &str, group_id: &str) -> Result<Group> {
        self.get(format!("/admin/groups/{}", seg(group_id)))
            .token(token)
            .send()
            .await
    }

    /// Partially update a group. Renaming does not change the group's `uid`.
    pub async fn update_group(
        &self,
        token: &str,
        group_id: &str,
        params: &UpdateGroupParams,
    ) -> Result<Group> {
        self.patch(format!("/admin/groups/{}", seg(group_id)))
            .token(token)
            .json(params)
            .send()
            .await
    }

    pub async fn delete_group(&self, token: &str, group_id: &str) -> Result<Value> {
        self.delete(format!("/admin/groups/{}", seg(group_id)))
            .token(token)
            .send()
            .await
    }

    pub async fn add_user_to_group(
        &self,
        token: &str,
        group_id: &str,
        user_id: &str,
    ) -> Result<Value> {
        self.post(format!("/admin/groups/{}/users", seg(group_id)))
            .token(token)
            .json(json!({ "userId": user_id }))
            .send()
            .await
    }

    /// List the members of a group (supports RSQL `q`/`sort`/pagination).
    pub async fn list_group_members(
        &self,
        token: &str,
        group_id: &str,
        query: &ListQuery,
    ) -> Result<Vec<User>> {
        #[derive(Deserialize)]
        struct Res {
            users: Vec<User>,
        }
        let res: Res = self
            .get(format!("/admin/groups/{}/users", seg(group_id)))
            .token(token)
            .list_query(query)
            .send()
            .await?;
        Ok(res.users)
    }

    pub async fn remove_user_from_group(
        &self,
        token: &str,
        group_id: &str,
        user_id: &str,
    ) -> Result<Value> {
        self.delete(format!(
            "/admin/groups/{}/users/{}",
            seg(group_id),
            seg(user_id)
        ))
        .token(token)
        .send()
        .await
    }

    pub async fn assign_role_to_group(
        &self,
        token: &str,
        group_id: &str,
        role_id: &str,
    ) -> Result<Value> {
        self.post(format!("/admin/groups/{}/roles", seg(group_id)))
            .token(token)
            .json(json!({ "roleId": role_id }))
            .send()
            .await
    }

    pub async fn list_group_roles(&self, token: &str, group_id: &str) -> Result<Vec<Role>> {
        #[derive(Deserialize)]
        struct Res {
            roles: Vec<Role>,
        }
        let res: Res = self
            .get(format!("/admin/groups/{}/roles", seg(group_id)))
            .token(token)
            .send()
            .await?;
        Ok(res.roles)
    }

    pub async fn remove_role_from_group(
        &self,
        token: &str,
        group_id: &str,
        role_id: &str,
    ) -> Result<Value> {
        self.delete(format!(
            "/admin/groups/{}/roles/{}",
            seg(group_id),
            seg(role_id)
        ))
        .token(token)
        .send()
        .await
    }
}
