use serde_json::Value;

use crate::types::HealthStatus;
use crate::{AuthrsClient, Result};

impl AuthrsClient {
    pub async fn health_check(&self) -> Result<HealthStatus> {
        self.get("/health").no_tenant().send().await
    }

    pub async fn get_metrics(&self) -> Result<Value> {
        self.get("/metrics").no_tenant().send().await
    }

    pub async fn get_spec(&self) -> Result<Value> {
        self.get("/spec").no_tenant().send().await
    }
}
