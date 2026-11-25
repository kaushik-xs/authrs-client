use std::borrow::Cow;

use reqwest::{Method, StatusCode, header};
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::Value;

use crate::error::{Error, Result};
use crate::types::ListQuery;

const DEFAULT_BASE_URL: &str = "http://localhost:3000";

/// Client configuration. Unset fields fall back to environment variables, then defaults:
///
/// - `base_url`  — `AUTHRS_BASE_URL`  (default `http://localhost:3000`)
/// - `tenant_id` — `AUTHRS_TENANT_ID` (default `""`, i.e. no `X-Tenant-ID` header)
#[derive(Debug, Clone, Default)]
pub struct AuthrsConfig {
    pub base_url: Option<String>,
    pub tenant_id: Option<String>,
    /// Bring your own `reqwest::Client` (timeouts, proxies, connection pool sharing).
    pub http_client: Option<reqwest::Client>,
}

/// Async client for the Authrs multi-tenant auth service.
///
/// Cheap to clone — clones share the underlying connection pool.
#[derive(Debug, Clone)]
pub struct AuthrsClient {
    base_url: String,
    tenant_id: String,
    http: reqwest::Client,
}

impl Default for AuthrsClient {
    fn default() -> Self {
        Self::new(AuthrsConfig::default())
    }
}

impl AuthrsClient {
    pub fn new(config: AuthrsConfig) -> Self {
        let base_url = config
            .base_url
            .or_else(|| std::env::var("AUTHRS_BASE_URL").ok())
            .unwrap_or_else(|| DEFAULT_BASE_URL.to_string())
            .trim_end_matches('/')
            .to_string();
        let tenant_id = config
            .tenant_id
            .or_else(|| std::env::var("AUTHRS_TENANT_ID").ok())
            .unwrap_or_default();
        Self {
            base_url,
            tenant_id,
            http: config.http_client.unwrap_or_default(),
        }
    }

    /// Build a client purely from `AUTHRS_BASE_URL` / `AUTHRS_TENANT_ID`.
    pub fn from_env() -> Self {
        Self::default()
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    pub fn tenant_id(&self) -> &str {
        &self.tenant_id
    }

    pub(crate) fn request(&self, method: Method, path: impl Into<String>) -> Request<'_> {
        Request {
            client: self,
            method,
            path: path.into(),
            token: None,
            send_tenant: true,
            body: None,
            query: Vec::new(),
        }
    }

    pub(crate) fn get(&self, path: impl Into<String>) -> Request<'_> {
        self.request(Method::GET, path)
    }
    pub(crate) fn post(&self, path: impl Into<String>) -> Request<'_> {
        self.request(Method::POST, path)
    }
    pub(crate) fn put(&self, path: impl Into<String>) -> Request<'_> {
        self.request(Method::PUT, path)
    }
    pub(crate) fn patch(&self, path: impl Into<String>) -> Request<'_> {
        self.request(Method::PATCH, path)
    }
    pub(crate) fn delete(&self, path: impl Into<String>) -> Request<'_> {
        self.request(Method::DELETE, path)
    }
}

/// Percent-encode a single path segment (equivalent to JS `encodeURIComponent`).
pub(crate) fn seg(s: &str) -> Cow<'_, str> {
    urlencoding::encode(s)
}

pub(crate) struct Request<'a> {
    client: &'a AuthrsClient,
    method: Method,
    path: String,
    token: Option<&'a str>,
    send_tenant: bool,
    body: Option<Result<Value>>,
    query: Vec<(&'static str, String)>,
}

impl<'a> Request<'a> {
    /// Send `Authorization: Bearer <token>`.
    pub(crate) fn token(mut self, token: &'a str) -> Self {
        self.token = Some(token);
        self
    }

    /// Do not send the client's `X-Tenant-ID` header (tenant-less / identity-scoped endpoints).
    pub(crate) fn no_tenant(mut self) -> Self {
        self.send_tenant = false;
        self
    }

    pub(crate) fn json(mut self, body: impl Serialize) -> Self {
        self.body = Some(serde_json::to_value(body).map_err(Error::Serialize));
        self
    }

    pub(crate) fn query(mut self, key: &'static str, value: impl ToString) -> Self {
        self.query.push((key, value.to_string()));
        self
    }

    pub(crate) fn list_query(mut self, q: &ListQuery) -> Self {
        if let Some(v) = &q.q {
            self = self.query("q", v);
        }
        if let Some(v) = &q.sort {
            self = self.query("sort", v);
        }
        if let Some(v) = q.limit {
            self = self.query("limit", v);
        }
        if let Some(v) = q.offset {
            self = self.query("offset", v);
        }
        self
    }

    pub(crate) async fn send<T: DeserializeOwned>(self) -> Result<T> {
        let client = self.client;
        let url = format!("{}{}", client.base_url, self.path);
        let mut req = client.http.request(self.method.clone(), url);
        if !self.query.is_empty() {
            req = req.query(&self.query);
        }
        if let Some(body) = self.body {
            req = req.json(&body?);
        }
        if let Some(token) = self.token.filter(|t| !t.is_empty()) {
            req = req.bearer_auth(token);
        }
        if self.send_tenant && !client.tenant_id.is_empty() {
            req = req.header("X-Tenant-ID", &client.tenant_id);
        }

        let res = req.send().await?;
        let status = res.status();

        if !status.is_success() {
            let text = res.text().await.unwrap_or_default();
            let body = if text.is_empty() {
                Value::Null
            } else {
                serde_json::from_str(&text).unwrap_or(Value::String(text))
            };
            return Err(Error::Api {
                method: self.method.to_string(),
                path: self.path,
                status: status.as_u16(),
                body,
            });
        }

        if status == StatusCode::NO_CONTENT {
            return serde_json::from_value(Value::Object(Default::default()))
                .map_err(Error::Decode);
        }
        let is_json = res
            .headers()
            .get(header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .is_some_and(|ct| ct.contains("application/json"));
        let text = res.text().await?;
        if is_json {
            serde_json::from_str(&text).map_err(Error::Decode)
        } else {
            serde_json::from_value(Value::String(text)).map_err(Error::Decode)
        }
    }
}
