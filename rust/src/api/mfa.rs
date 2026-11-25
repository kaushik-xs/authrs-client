use serde_json::json;

use crate::types::{BackupCodes, LoginSuccess, MfaDisabled, MfaEnabled, MfaEnrollment, MfaStatus};
use crate::{AuthrsClient, Result};

/// MFA — authenticator app (TOTP) + backup codes. MFA belongs to the global identity, so it
/// applies in every tenant; no X-Tenant-ID is sent.
impl AuthrsClient {
    /// Whether MFA is on for the session's identity, and how many backup codes remain.
    pub async fn mfa_status(&self, token: &str) -> Result<MfaStatus> {
        self.get("/mfa/status")
            .token(token)
            .no_tenant()
            .send()
            .await
    }

    /// Start authenticator enrollment (session token). MFA is not active until
    /// [`verify_mfa`](Self::verify_mfa) succeeds.
    pub async fn enable_mfa(&self, token: &str) -> Result<MfaEnrollment> {
        self.post("/mfa/enable")
            .token(token)
            .no_tenant()
            .send()
            .await
    }

    /// Confirm enrollment with the first 6-digit code from the app. Returns one-time backup codes.
    pub async fn verify_mfa(&self, token: &str, code: &str) -> Result<MfaEnabled> {
        self.post("/mfa/verify")
            .token(token)
            .no_tenant()
            .json(json!({ "code": code }))
            .send()
            .await
    }

    /// Complete a login that returned an MFA challenge. `code` is a 6-digit TOTP code or a
    /// backup code. The mfa token is valid for 5 minutes / 5 attempts.
    pub async fn validate_mfa(&self, mfa_token: &str, code: &str) -> Result<LoginSuccess> {
        self.post("/mfa/validate")
            .no_tenant()
            .json(json!({ "mfaToken": mfa_token, "code": code }))
            .send()
            .await
    }

    /// Turn MFA off (session token + a current TOTP or backup code).
    pub async fn disable_mfa(&self, token: &str, code: &str) -> Result<MfaDisabled> {
        self.post("/mfa/disable")
            .token(token)
            .no_tenant()
            .json(json!({ "code": code }))
            .send()
            .await
    }

    /// Replace all backup codes (session token + a current TOTP or backup code).
    pub async fn regenerate_backup_codes(&self, token: &str, code: &str) -> Result<BackupCodes> {
        self.post("/mfa/backup-codes")
            .token(token)
            .no_tenant()
            .json(json!({ "code": code }))
            .send()
            .await
    }
}
