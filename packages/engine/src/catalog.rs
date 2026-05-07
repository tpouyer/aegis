use crate::types::Tool;

/// A searchable catalog of MCP tool definitions.
pub struct ToolCatalog {
    tools: Vec<Tool>,
}

impl ToolCatalog {
    /// Create a new tool catalog from a list of tool definitions.
    pub fn new(tools: Vec<Tool>) -> Self {
        Self { tools }
    }

    /// Search for tools whose name or description contains the given
    /// substring (case-insensitive).
    pub fn query(&self, search: &str) -> Vec<&Tool> {
        let search_lower = search.to_lowercase();
        self.tools
            .iter()
            .filter(|t| {
                t.name.to_lowercase().contains(&search_lower)
                    || t.description.to_lowercase().contains(&search_lower)
            })
            .collect()
    }

    /// Look up a tool by exact name.
    pub fn get(&self, name: &str) -> Option<&Tool> {
        self.tools.iter().find(|t| t.name == name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn make_tools() -> Vec<Tool> {
        vec![
            Tool {
                name: "coding_standards".into(),
                description: "Team coding conventions and style guide".into(),
                input_schema: json!({"type": "object", "properties": {"repo": {"type": "string"}}}),
            },
            Tool {
                name: "testing_guidelines".into(),
                description: "Test requirements and patterns for the project".into(),
                input_schema: json!({"type": "object", "properties": {}}),
            },
            Tool {
                name: "search".into(),
                description: "Discover tools across upstream MCP servers".into(),
                input_schema: json!({"type": "object", "properties": {"code": {"type": "string"}}}),
            },
        ]
    }

    #[test]
    fn test_query_matches_by_name_case_insensitive() {
        let catalog = ToolCatalog::new(make_tools());
        let results = catalog.query("CODING");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "coding_standards");

        // Also matches description
        let results2 = catalog.query("conventions");
        assert_eq!(results2.len(), 1);
        assert_eq!(results2[0].name, "coding_standards");
    }

    #[test]
    fn test_query_returns_empty_for_no_match() {
        let catalog = ToolCatalog::new(make_tools());
        let results = catalog.query("nonexistent_tool");
        assert!(results.is_empty());
    }

    #[test]
    fn test_get_exact_match_and_miss() {
        let catalog = ToolCatalog::new(make_tools());

        let found = catalog.get("search");
        assert!(found.is_some());
        assert_eq!(found.unwrap().name, "search");

        let not_found = catalog.get("Search"); // case-sensitive
        assert!(not_found.is_none());

        let not_found2 = catalog.get("nonexistent");
        assert!(not_found2.is_none());
    }
}
