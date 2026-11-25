use authrs_client::{
    AuthrsClient, AuthrsConfig, Error, ListQuery, LoginResult, OtpChannel, SignupOptions,
    SignupResult, UpdateGroupParams,
};
use serde_json::json;
use wiremock::matchers::{body_json, header, header_exists, method, path, query_param};
use wiremock::{Mock, MockServer, Request, ResponseTemplate};

async fn setup() -> (MockServer, AuthrsClient) {
    let server = MockServer::start().await;
    let client = AuthrsClient::new(AuthrsConfig {
        base_url: Some(format!("{}/", server.uri())),
        tenant_id: Some("acme".into()),
        ..Default::default()
    });
    (server, client)
}

fn no_tenant_header(req: &Request) -> bool {
    !req.headers.contains_key("x-tenant-id")
}

#[tokio::test]
async fn login_success_sends_tenant_and_parses_session() {
    let (server, client) = setup().await;
    Mock::given(method("POST"))
        .and(path("/login/email-password"))
        .and(header("X-Tenant-ID", "acme"))
        .and(body_json(json!({ "email": "a@b.com", "password": "pw" })))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(
                json!({ "sessionToken": "tok", "expiresAt": "2030-01-01T00:00:00Z" }),
            ),
        )
        .expect(1)
        .mount(&server)
        .await;

    let res = client.login_email_password("a@b.com", "pw").await.unwrap();
    assert_eq!(res.session_token(), Some("tok"));
}

#[tokio::test]
async fn login_result_variants() {
    let (server, client) = setup().await;
    Mock::given(path("/login/username-password"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(json!({ "mfaRequired": true, "mfaToken": "m" })),
        )
        .mount(&server)
        .await;
    Mock::given(path("/login/otp/verify"))
        .and(body_json(
            json!({ "identifier": "+1", "code": "123", "channel": "whatsapp" }),
        ))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(json!({ "passwordChangeRequired": true, "changeToken": "c" })),
        )
        .mount(&server)
        .await;

    match client.login_username_password("u", "p").await.unwrap() {
        LoginResult::MfaRequired(m) => assert_eq!(m.mfa_token, "m"),
        other => panic!("unexpected {other:?}"),
    }
    match client
        .login_otp_verify("+1", "123", OtpChannel::WhatsApp)
        .await
        .unwrap()
    {
        LoginResult::PasswordChangeRequired(p) => assert_eq!(p.change_token, "c"),
        other => panic!("unexpected {other:?}"),
    }
}

#[tokio::test]
async fn session_endpoints_omit_tenant_and_send_bearer() {
    let (server, client) = setup().await;
    Mock::given(method("GET"))
        .and(path("/session/me"))
        .and(header("Authorization", "Bearer tok"))
        .and(no_tenant_header)
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "userId": "u1", "identityId": "i1", "roles": ["admin"], "permissions": [],
            "expiresAt": "2030-01-01T00:00:00Z", "user": { "id": "u1", "email": "a@b.com" }
        })))
        .expect(1)
        .mount(&server)
        .await;
    Mock::given(method("POST"))
        .and(path("/session/logout/all"))
        .and(header("X-Tenant-ID", "acme"))
        .respond_with(ResponseTemplate::new(204))
        .expect(1)
        .mount(&server)
        .await;

    let me = client.me("tok").await.unwrap();
    assert_eq!(me.user.email.as_deref(), Some("a@b.com"));
    assert_eq!(client.logout_all("tok").await.unwrap(), json!({}));
}

#[tokio::test]
async fn signup_distinguishes_user_and_pending() {
    let (server, client) = setup().await;
    Mock::given(path("/signup"))
        .and(body_json(json!({
            "firstName": "A", "lastName": "B", "email": "a@b.com",
            "password": "p", "retypePassword": "p", "countryCode": "+91"
        })))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({ "message": "check email" })))
        .mount(&server)
        .await;

    let res = client
        .signup(
            "A",
            "B",
            "a@b.com",
            "p",
            "p",
            SignupOptions {
                country_code: Some("+91".into()),
                ..Default::default()
            },
        )
        .await
        .unwrap();
    assert!(matches!(res, SignupResult::VerificationPending(p) if p.message == "check email"));
}

#[tokio::test]
async fn list_query_and_path_encoding() {
    let (server, client) = setup().await;
    Mock::given(method("GET"))
        .and(path("/admin/users"))
        .and(query_param("includeArchived", "true"))
        .and(query_param("q", "status==active"))
        .and(query_param("limit", "10"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(json!({ "users": [{ "id": "u1" }] })),
        )
        .mount(&server)
        .await;
    Mock::given(method("PUT"))
        .and(path("/admin/kv_store/a%2Fb/k%20y"))
        .and(body_json(json!({ "value": "v" })))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(json!({ "groupKey": "a/b", "key": "k y", "value": "v" })),
        )
        .mount(&server)
        .await;

    let users = client
        .list_users(
            "tok",
            &ListQuery {
                q: Some("status==active".into()),
                limit: Some(10),
                ..Default::default()
            },
            true,
        )
        .await
        .unwrap();
    assert_eq!(users.len(), 1);

    let entry = client.set_kv_value("tok", "a/b", "k y", "v").await.unwrap();
    assert_eq!(entry.key, "k y");
}

#[tokio::test]
async fn update_group_can_clear_description() {
    let (server, client) = setup().await;
    Mock::given(method("PATCH"))
        .and(path("/admin/groups/g1"))
        .and(body_json(json!({ "description": null })))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(json!({ "id": "g1", "name": "n", "uid": "n", "description": null })),
        )
        .expect(1)
        .mount(&server)
        .await;

    let params = UpdateGroupParams {
        description: Some(None),
        ..Default::default()
    };
    let group = client.update_group("tok", "g1", &params).await.unwrap();
    assert_eq!(group.description, None);
}

#[tokio::test]
async fn api_errors_carry_status_and_body() {
    let (server, client) = setup().await;
    Mock::given(path("/tenants"))
        .and(header_exists("authorization"))
        .respond_with(ResponseTemplate::new(403).set_body_json(json!({ "error": "forbidden" })))
        .mount(&server)
        .await;

    let err = client.list_tenants("tok").await.unwrap_err();
    assert!(matches!(err, Error::Api { status: 403, .. }));
    assert_eq!(err.status(), Some(403));
    assert_eq!(err.body(), Some(&json!({ "error": "forbidden" })));
    assert_eq!(err.to_string(), "Authrs GET /tenants → 403");
}
