use wasm_bindgen::prelude::*;

mod auth_filter;
mod catalog;
mod config;
mod hierarchy;
mod mcp;
mod sandbox;
mod types;

use catalog::ToolCatalog;
use types::{AuthLevel, Manifest};

/// The main WASM entry point. ProxyEngine holds the parsed manifest and tool
/// catalog in WASM linear memory, providing synchronous resolution of content
/// hierarchy, auth filtering, and MCP protocol handling.
#[wasm_bindgen]
pub struct ProxyEngine {
    manifest: Manifest,
    catalog: ToolCatalog,
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
        let catalog = ToolCatalog::new(manifest.tools.clone());
        Ok(ProxyEngine { manifest, catalog })
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

    /// Handle an MCP `tools/list` request.
    ///
    /// Returns a JSON string with a `tools` array containing all tools
    /// visible at the given auth level.
    pub fn tools_list(&self, auth_level: &str) -> Result<String, JsError> {
        let level = parse_auth_level(auth_level)?;
        let result = mcp::handle_tools_list(&self.manifest, level);
        serde_json::to_string(&result)
            .map_err(|e| JsError::new(&format!("Serialization error: {}", e)))
    }

    /// Handle an MCP `tools/call` request.
    ///
    /// `args` is a JSON string of tool arguments. Returns a JSON string
    /// with the tool result (content body for content tools, or a routing
    /// indicator for upstream tools).
    pub fn tools_call(
        &self,
        tool_name: &str,
        args: &str,
        auth_level: &str,
    ) -> Result<String, JsError> {
        let level = parse_auth_level(auth_level)?;
        let parsed_args: serde_json::Value = serde_json::from_str(args)
            .map_err(|e| JsError::new(&format!("Invalid args JSON: {}", e)))?;
        let result = mcp::handle_tools_call(&self.manifest, tool_name, &parsed_args, level)
            .map_err(|e| JsError::new(&format!("Tool call error: {}", e)))?;
        serde_json::to_string(&result)
            .map_err(|e| JsError::new(&format!("Serialization error: {}", e)))
    }

    /// Search the tool catalog by name or description substring.
    ///
    /// Returns a JSON-serialized array of matching `Tool` definitions.
    pub fn query_tools(&self, search: &str) -> Result<String, JsError> {
        let results = self.catalog.query(search);
        serde_json::to_string(&results)
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
