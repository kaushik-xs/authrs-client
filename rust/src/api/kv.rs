use serde_json::{Value, json};

use crate::client::seg;
use crate::types::KvEntry;
use crate::{AuthrsClient, Result};

/// Admin — KV Store.
impl AuthrsClient {
    pub async fn list_kv_keys(&self, token: &str) -> Result<Vec<KvEntry>> {
        self.get("/admin/kv_store").token(token).send().await
    }

    pub async fn get_kv_value(&self, token: &str, group_key: &str, key: &str) -> Result<KvEntry> {
        self.get(format!("/admin/kv_store/{}/{}", seg(group_key), seg(key)))
            .token(token)
            .send()
            .await
    }

    pub async fn set_kv_value(
        &self,
        token: &str,
        group_key: &str,
        key: &str,
        value: &str,
    ) -> Result<KvEntry> {
        self.put(format!("/admin/kv_store/{}/{}", seg(group_key), seg(key)))
            .token(token)
            .json(json!({ "value": value }))
            .send()
            .await
    }

    pub async fn delete_kv_value(&self, token: &str, group_key: &str, key: &str) -> Result<Value> {
        self.delete(format!("/admin/kv_store/{}/{}", seg(group_key), seg(key)))
            .token(token)
            .send()
            .await
    }
}
