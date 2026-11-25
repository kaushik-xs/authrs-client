use serde_json::Value;

/// Errors returned by [`AuthrsClient`](crate::AuthrsClient) methods.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// The server answered with a non-2xx status. `body` is the parsed JSON error body, the raw
    /// text as a JSON string when it was not JSON, or `null` when empty.
    #[error("Authrs {method} {path} → {status}")]
    Api {
        method: String,
        path: String,
        status: u16,
        body: Value,
    },

    /// The request could not be sent or the response could not be read (connection, TLS, timeout).
    #[error("Authrs request failed: {0}")]
    Http(#[from] reqwest::Error),

    /// The request body could not be serialized.
    #[error("failed to serialize Authrs request body: {0}")]
    Serialize(#[source] serde_json::Error),

    /// The response body did not match the expected shape.
    #[error("failed to decode Authrs response: {0}")]
    Decode(#[source] serde_json::Error),
}

impl Error {
    /// HTTP status for [`Error::Api`] (or a transport error that carries one).
    pub fn status(&self) -> Option<u16> {
        match self {
            Error::Api { status, .. } => Some(*status),
            Error::Http(e) => e.status().map(|s| s.as_u16()),
            _ => None,
        }
    }

    /// Error body returned by the server, for [`Error::Api`].
    pub fn body(&self) -> Option<&Value> {
        match self {
            Error::Api { body, .. } => Some(body),
            _ => None,
        }
    }
}

pub type Result<T> = std::result::Result<T, Error>;
