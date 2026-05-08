use wasm_bindgen::prelude::*;

mod auth_filter;
mod config;
mod hierarchy;
mod types;

use types::{AuthLevel, Manifest};

/// The main WASM entry point. ProxyEngine holds the parsed manifest in WASM
/// linear memory, providing synchronous resolution of content hierarchy and
/// auth-level filtering.
#[wasm_bindgen]
pub struct ProxyEngine {
    manifest: Manifest,
}

#[wasm_bindgen]
impl ProxyEngine {
    /// Create a new ProxyEngine from a JSON-serialized manifest.
    ///
    /// The manifest is parsed once and held in WASM memory for the lifetime
    /// of the engine instance. All subsequent operations are synchronous
    /// lookups against this in-memory data.
    #[wasm_bindgen(constructor)]
    pub fn new(manifest_json: &str) -> Result<ProxyEngine, JsError> {
        let manifest: Manifest = serde_json::from_str(manifest_json)
            .map_err(|e| JsError::new(&format!("Failed to parse manifest: {}", e)))?;
        Ok(ProxyEngine { manifest })
    }

    /// Resolve content hierarchy for a given repo and auth level.
    ///
    /// Returns a JSON-serialized array of `ResolvedContent` items, ordered
    /// by name, with "most specific wins" merge applied.
    pub fn resolve_content(&self, repo: &str, auth_level: &str) -> Result<String, JsError> {
        let level = parse_auth_level(auth_level)?;
        let resolved = hierarchy::resolve_hierarchy(&self.manifest, repo, level);
        serde_json::to_string(&resolved)
            .map_err(|e| JsError::new(&format!("Serialization error: {}", e)))
    }

    /// Filter the manifest to only include scopes visible at the given auth level.
    ///
    /// Returns a JSON-serialized `Manifest` containing only the scopes,
    /// contents, and tools the user is authorized to see.
    pub fn filter_manifest(&self, auth_level: &str) -> Result<String, JsError> {
        let level = parse_auth_level(auth_level)?;
        let filtered = auth_filter::filter_by_auth(&self.manifest, level);
        serde_json::to_string(&filtered)
            .map_err(|e| JsError::new(&format!("Serialization error: {}", e)))
    }
}

/// Parse an auth level string into the AuthLevel enum.
fn parse_auth_level(s: &str) -> Result<AuthLevel, JsError> {
    AuthLevel::from_str_label(s)
        .ok_or_else(|| JsError::new(&format!(
            "Invalid auth level '{}'. Expected: public, github, or redhat-sso",
            s
        )))
}
