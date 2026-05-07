use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Authentication level determining content visibility.
/// Ordered so that Public < GitHub < RedHatSSO, meaning a user at a higher
/// level can see everything at or below their level.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AuthLevel {
    Public,
    Github,
    RedhatSso,
}

impl AuthLevel {
    /// Parse an auth level from a string identifier.
    pub fn from_str_label(s: &str) -> Option<AuthLevel> {
        match s.to_lowercase().as_str() {
            "public" => Some(AuthLevel::Public),
            "github" => Some(AuthLevel::Github),
            "redhat-sso" | "redhatsso" => Some(AuthLevel::RedhatSso),
            _ => None,
        }
    }

    fn ordinal(&self) -> u8 {
        match self {
            AuthLevel::Public => 0,
            AuthLevel::Github => 1,
            AuthLevel::RedhatSso => 2,
        }
    }
}

impl PartialOrd for AuthLevel {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for AuthLevel {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.ordinal().cmp(&other.ordinal())
    }
}

/// A content source within a scope (e.g., a git repository path).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Source {
    #[serde(rename = "type")]
    pub source_type: String,
    pub url: String,
    pub path: String,
}

/// A scope defines a named collection of content with a visibility level.
/// If `repos` is empty, the scope applies globally to all repositories.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scope {
    pub name: String,
    pub visibility: AuthLevel,
    #[serde(default)]
    pub repos: Vec<String>,
    #[serde(default)]
    pub sources: Vec<Source>,
}

/// A piece of content associated with a scope.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Content {
    pub name: String,
    pub scope: String,
    pub body: String,
    #[serde(default)]
    pub metadata: HashMap<String, String>,
}

/// An MCP tool definition with its JSON Schema input specification.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub name: String,
    pub description: String,
    #[serde(rename = "inputSchema")]
    pub input_schema: serde_json::Value,
}

/// The full manifest loaded into the WASM engine at initialization.
/// Contains all scopes, content artifacts, and tool definitions.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub scopes: Vec<Scope>,
    #[serde(default)]
    pub contents: Vec<Content>,
    #[serde(default)]
    pub tools: Vec<Tool>,
}

/// Content after hierarchy resolution — carries the source scope and a
/// priority value for ordering (higher = more specific).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedContent {
    pub name: String,
    pub body: String,
    pub source_scope: String,
    pub priority: u32,
}
