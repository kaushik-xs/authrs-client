use serde_json::{Value, json};

use crate::types::{LoginResult, Membership, OtpChannel, SignupOptions, SignupResult};
use crate::{AuthrsClient, Result};

/// Auth (tenant-scoped, no auth token).
impl AuthrsClient {
    /// Sign up within the current tenant. If the email/mobile already belongs to a global
    /// identity (e.g. the user exists in another tenant), no account is created — a
    /// verify-to-join email is sent to the owner and [`SignupResult::VerificationPending`]
    /// is returned instead of the user.
    pub async fn signup(
        &self,
        first_name: &str,
        last_name: &str,
        email: &str,
        password: &str,
        retype_password: &str,
        opts: SignupOptions,
    ) -> Result<SignupResult> {
        let mut body = json!({
            "firstName": first_name,
            "lastName": last_name,
            "email": email,
            "password": password,
            "retypePassword": retype_password,
        });
        if let Some(mobile) = opts.mobile {
            body["mobile"] = json!(mobile);
        }
        if let Some(country_code) = opts.country_code {
            body["countryCode"] = json!(country_code);
        }
        self.post("/signup").json(body).send().await
    }

    /// Accept a verify-to-join invite (token from the signup email). The tenant is encoded in
    /// the token — no X-Tenant-ID needed.
    pub async fn verify_membership(&self, token: &str) -> Result<Membership> {
        self.post("/signup/verify")
            .no_tenant()
            .json(json!({ "token": token }))
            .send()
            .await
    }

    /// Log in with email + password within the current tenant. Returns a session, an MFA
    /// challenge, or a forced password change — see [`LoginResult`].
    pub async fn login_email_password(&self, email: &str, password: &str) -> Result<LoginResult> {
        self.post("/login/email-password")
            .json(json!({ "email": email, "password": password }))
            .send()
            .await
    }

    /// Log in with username + password. Returns a [`LoginResult`].
    pub async fn login_username_password(
        &self,
        username: &str,
        password: &str,
    ) -> Result<LoginResult> {
        self.post("/login/username-password")
            .json(json!({ "username": username, "password": password }))
            .send()
            .await
    }

    pub async fn login_email_otp_request(&self, email: &str) -> Result<Value> {
        self.post("/login/email-otp/request")
            .json(json!({ "email": email }))
            .send()
            .await
    }

    pub async fn login_mobile_otp_request(
        &self,
        mobile: &str,
        country_code: &str,
    ) -> Result<Value> {
        self.post("/login/mobile-otp/request")
            .json(json!({ "mobile": mobile, "countryCode": country_code }))
            .send()
            .await
    }

    pub async fn login_whatsapp_otp_request(
        &self,
        mobile: &str,
        country_code: &str,
    ) -> Result<Value> {
        self.post("/login/mobile-whatsapp-otp/request")
            .json(json!({ "mobile": mobile, "countryCode": country_code }))
            .send()
            .await
    }

    pub async fn login_otp_verify(
        &self,
        identifier: &str,
        code: &str,
        channel: OtpChannel,
    ) -> Result<LoginResult> {
        self.post("/login/otp/verify")
            .json(json!({ "identifier": identifier, "code": code, "channel": channel }))
            .send()
            .await
    }

    /// Start a password reset. Operates on the GLOBAL identity — the reset (and the resulting
    /// password) applies across every tenant the identity belongs to.
    pub async fn forgot_password(&self, email: &str) -> Result<Value> {
        self.post("/forgot-password")
            .json(json!({ "email": email }))
            .send()
            .await
    }

    pub async fn reset_password(
        &self,
        token: &str,
        new_password: &str,
        retype_password: &str,
    ) -> Result<Value> {
        self.post("/reset-password")
            .json(json!({
                "token": token,
                "newPassword": new_password,
                "retypePassword": retype_password,
            }))
            .send()
            .await
    }
}
