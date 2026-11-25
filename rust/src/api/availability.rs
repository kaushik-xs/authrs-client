use serde::Deserialize;
use serde_json::{Value, json};

use crate::{AuthrsClient, Result};

#[derive(Deserialize)]
struct Availability {
    available: bool,
}

/// Availability checks (auth token required). Email and mobile are checked GLOBALLY (an
/// identity handle is unique across all tenants); username remains per-tenant.
impl AuthrsClient {
    async fn check_availability(&self, token: &str, kind: &str, body: Value) -> Result<bool> {
        let res: Availability = self
            .post(format!("/check-availability/{kind}"))
            .token(token)
            .json(body)
            .send()
            .await?;
        Ok(res.available)
    }

    pub async fn check_email_availability(&self, token: &str, email: &str) -> Result<bool> {
        self.check_availability(token, "email", json!({ "email": email }))
            .await
    }

    pub async fn check_username_availability(&self, token: &str, username: &str) -> Result<bool> {
        self.check_availability(token, "username", json!({ "username": username }))
            .await
    }

    pub async fn check_mobile_availability(
        &self,
        token: &str,
        mobile: &str,
        country_code: &str,
    ) -> Result<bool> {
        self.check_availability(
            token,
            "mobile",
            json!({ "mobile": mobile, "countryCode": country_code }),
        )
        .await
    }
}
