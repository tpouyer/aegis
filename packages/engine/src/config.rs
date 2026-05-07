use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

use crate::types::{AuthLevel, Scope, Source};

/// Errors that can occur during configuration parsing.
#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("YAML parse error: {0}")]
    YamlError(#[from] serde_yaml::Error),

    #[error("missing required field: {0}")]
    MissingField(String),
}

/// A mapping from a Jira component to a specific repository and optional path.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoMapping {
    pub org: String,
    pub repo: String,
    pub path: Option<String>,
}

/// Maps component names to their repository mappings.
pub type ComponentMap = HashMap<String, Vec<RepoMapping>>;

// ── Internal deserialization types ──

#[derive(Deserialize)]
struct ScopesFile {
    #[serde(default)]
    scopes: Vec<RawScope>,
}

#[derive(Deserialize)]
struct RawScope {
    name: String,
    visibility: String,
    #[serde(default)]
    repos: Vec<String>,
    #[serde(default)]
    sources: Vec<RawSource>,
}

#[derive(Deserialize)]
struct RawSource {
    #[serde(rename = "type")]
    source_type: String,
    url: String,
    path: String,
}

#[derive(Deserialize)]
struct ComponentsFile {
    #[serde(default)]
    component_repos: HashMap<String, Vec<RepoMapping>>,
}

/// Parse scope definitions from YAML.
///
/// Expects the YAML to contain a top-level `scopes` array. Each scope must
/// have a `name` and a `visibility` that maps to an `AuthLevel`.
pub fn parse_scopes(yaml: &str) -> Result<Vec<Scope>, ConfigError> {
    let file: ScopesFile = serde_yaml::from_str(yaml)?;
    let mut scopes = Vec::new();
    for raw in file.scopes {
        let visibility = AuthLevel::from_str_label(&raw.visibility).ok_or_else(|| {
            ConfigError::MissingField(format!(
                "unknown visibility '{}' in scope '{}'",
                raw.visibility, raw.name
            ))
        })?;
        let sources = raw
            .sources
            .into_iter()
            .map(|s| Source {
                source_type: s.source_type,
                url: s.url,
                path: s.path,
            })
            .collect();
        scopes.push(Scope {
            name: raw.name,
            visibility,
            repos: raw.repos,
            sources,
        });
    }
    Ok(scopes)
}

/// Parse component-to-repository mappings from YAML.
///
/// Expects a top-level `component_repos` map where keys are component names
/// and values are arrays of `{ org, repo, path? }` objects.
pub fn parse_components(yaml: &str) -> Result<ComponentMap, ConfigError> {
    let file: ComponentsFile = serde_yaml::from_str(yaml)?;
    Ok(file.component_repos)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_valid_scopes() {
        let yaml = r#"
scopes:
  - name: community
    visibility: public
    sources:
      - type: git
        url: https://github.com/ansible/community-docs
        path: standards/
  - name: platform
    visibility: github
    repos: [awx, receptor]
    sources:
      - type: git
        url: https://github.com/ansible/awx
        path: docs/dev/
  - name: internal
    visibility: redhat-sso
    sources:
      - type: git
        url: https://github.com/internal/docs
        path: arch/
"#;
        let scopes = parse_scopes(yaml).unwrap();
        assert_eq!(scopes.len(), 3);

        assert_eq!(scopes[0].name, "community");
        assert_eq!(scopes[0].visibility, AuthLevel::Public);
        assert!(scopes[0].repos.is_empty());
        assert_eq!(scopes[0].sources.len(), 1);
        assert_eq!(scopes[0].sources[0].source_type, "git");

        assert_eq!(scopes[1].name, "platform");
        assert_eq!(scopes[1].visibility, AuthLevel::Github);
        assert_eq!(scopes[1].repos, vec!["awx", "receptor"]);

        assert_eq!(scopes[2].name, "internal");
        assert_eq!(scopes[2].visibility, AuthLevel::RedhatSso);
    }

    #[test]
    fn test_parse_valid_components() {
        let yaml = r#"
component_repos:
  API:
    - org: ansible
      repo: awx
      path: awx/api/
  Receptor:
    - org: ansible
      repo: receptor
"#;
        let map = parse_components(yaml).unwrap();
        assert_eq!(map.len(), 2);

        let api = &map["API"];
        assert_eq!(api.len(), 1);
        assert_eq!(api[0].org, "ansible");
        assert_eq!(api[0].repo, "awx");
        assert_eq!(api[0].path, Some("awx/api/".to_string()));

        let receptor = &map["Receptor"];
        assert_eq!(receptor.len(), 1);
        assert_eq!(receptor[0].org, "ansible");
        assert_eq!(receptor[0].repo, "receptor");
        assert_eq!(receptor[0].path, None);
    }

    #[test]
    fn test_parse_empty_yaml() {
        let yaml = "scopes: []";
        let scopes = parse_scopes(yaml).unwrap();
        assert!(scopes.is_empty());

        let yaml2 = "component_repos: {}";
        let map = parse_components(yaml2).unwrap();
        assert!(map.is_empty());
    }

    #[test]
    fn test_parse_malformed_yaml_returns_error() {
        let bad_yaml = "scopes:\n  - name: [invalid\n    broken";
        let result = parse_scopes(bad_yaml);
        assert!(result.is_err());

        let bad_yaml2 = "component_repos:\n  - not_a_map";
        let result2 = parse_components(bad_yaml2);
        assert!(result2.is_err());
    }
}
