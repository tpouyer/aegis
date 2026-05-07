use serde_json::json;
use thiserror::Error;

use crate::auth_filter::filter_by_auth;
use crate::types::{AuthLevel, Manifest};

/// Errors that can occur during MCP tool handling.
#[derive(Error, Debug)]
pub enum EngineError {
    #[error("unknown tool: {0}")]
    UnknownTool(String),

    #[error("content not found: {0}")]
    ContentNotFound(String),

    #[error("invalid arguments: {0}")]
    InvalidArguments(String),
}

/// Handle an MCP `tools/list` request.
///
/// Returns a JSON value containing an array of tools, each with `name`,
/// `description`, and `inputSchema` fields. Only tools visible at the given
/// auth level are included (content tools are generated from visible scopes).
pub fn handle_tools_list(manifest: &Manifest, auth_level: AuthLevel) -> serde_json::Value {
    let filtered = filter_by_auth(manifest, auth_level);

    let mut tools_json: Vec<serde_json::Value> = Vec::new();

    // Content tools — one per unique content name
    let mut seen_content: std::collections::HashSet<String> = std::collections::HashSet::new();
    for content in &filtered.contents {
        if seen_content.insert(content.name.clone()) {
            tools_json.push(json!({
                "name": content.name,
                "description": format!("Retrieve {} content", content.name),
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "repo": {
                            "type": "string",
                            "description": "Target repository for context resolution"
                        }
                    }
                }
            }));
        }
    }

    // Catalog tools from the manifest
    for tool in &filtered.tools {
        tools_json.push(json!({
            "name": tool.name,
            "description": tool.description,
            "inputSchema": tool.input_schema,
        }));
    }

    json!({ "tools": tools_json })
}

/// Handle an MCP `tools/call` request.
///
/// - Content tools: resolve the named content from the manifest and return
///   its body.
/// - "search" / "execute" tools: return a routing indicator for the Service
///   Worker to forward to upstream MCP servers.
/// - Unknown tools: return an error.
pub fn handle_tools_call(
    manifest: &Manifest,
    tool_name: &str,
    args: &serde_json::Value,
    auth_level: AuthLevel,
) -> Result<serde_json::Value, EngineError> {
    let filtered = filter_by_auth(manifest, auth_level);

    // Check if it's a routing tool (search/execute)
    match tool_name {
        "search" | "execute" => {
            return Ok(json!({
                "route_to_upstream": true,
                "tool": tool_name,
                "args": args,
            }));
        }
        _ => {}
    }

    // Extract repo for future use in content resolution
    let _repo = args
        .get("repo")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    // Check if it's a content tool
    for content in &filtered.contents {
        if content.name == tool_name {
            return Ok(json!({
                "content": [{
                    "type": "text",
                    "text": content.body,
                }]
            }));
        }
    }

    // Check if it's a catalog tool
    for tool in &filtered.tools {
        if tool.name == tool_name {
            return Ok(json!({
                "route_to_upstream": true,
                "tool": tool_name,
                "args": args,
            }));
        }
    }

    Err(EngineError::UnknownTool(tool_name.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Content, Scope, Tool};
    use std::collections::HashMap;

    fn make_test_manifest() -> Manifest {
        Manifest {
            scopes: vec![Scope {
                name: "global".into(),
                visibility: AuthLevel::Public,
                repos: vec![],
                sources: vec![],
            }],
            contents: vec![Content {
                name: "coding_standards".into(),
                scope: "global".into(),
                body: "Follow the style guide".into(),
                metadata: HashMap::new(),
            }],
            tools: vec![Tool {
                name: "search".into(),
                description: "Search upstream tools".into(),
                input_schema: json!({"type": "object"}),
            }],
        }
    }

    #[test]
    fn test_tools_list_returns_correct_json_structure() {
        let manifest = make_test_manifest();
        let result = handle_tools_list(&manifest, AuthLevel::Public);

        let tools = result["tools"].as_array().unwrap();
        assert_eq!(tools.len(), 2); // 1 content tool + 1 catalog tool

        // Check content tool
        let content_tool = &tools[0];
        assert_eq!(content_tool["name"], "coding_standards");
        assert!(content_tool["description"].as_str().unwrap().contains("coding_standards"));
        assert!(content_tool["inputSchema"].is_object());

        // Check catalog tool
        let catalog_tool = &tools[1];
        assert_eq!(catalog_tool["name"], "search");
        assert_eq!(catalog_tool["description"], "Search upstream tools");
    }

    #[test]
    fn test_tools_call_content_tool_returns_body() {
        let manifest = make_test_manifest();
        let args = json!({"repo": "awx"});
        let result = handle_tools_call(&manifest, "coding_standards", &args, AuthLevel::Public);

        assert!(result.is_ok());
        let value = result.unwrap();
        let content = value["content"].as_array().unwrap();
        assert_eq!(content.len(), 1);
        assert_eq!(content[0]["type"], "text");
        assert_eq!(content[0]["text"], "Follow the style guide");
    }

    #[test]
    fn test_tools_call_search_routes_upstream() {
        let manifest = make_test_manifest();
        let args = json!({"code": "list_issues()"});
        let result = handle_tools_call(&manifest, "search", &args, AuthLevel::Public);

        assert!(result.is_ok());
        let value = result.unwrap();
        assert_eq!(value["route_to_upstream"], true);
        assert_eq!(value["tool"], "search");
    }

    #[test]
    fn test_tools_call_unknown_tool_errors() {
        let manifest = make_test_manifest();
        let args = json!({});
        let result = handle_tools_call(&manifest, "nonexistent", &args, AuthLevel::Public);

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.to_string().contains("nonexistent"));
    }
}
