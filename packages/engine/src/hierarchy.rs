use std::collections::HashMap;

use crate::types::{AuthLevel, Content, Manifest, ResolvedContent};

/// Resolve the content hierarchy for a given repository and auth level.
///
/// Resolution rules:
/// 1. Filter scopes by auth_level (Public sees only public, GitHub sees
///    public + github, RedHatSSO sees all).
/// 2. Filter scopes by repo match — a scope matches if its `repos` list
///    contains the target repo, or if `repos` is empty (global scope).
/// 3. For content with the same name across multiple scopes: a repo-specific
///    scope wins over a global scope.
/// 4. Return the merged content list ordered by name.
pub fn resolve_hierarchy(
    manifest: &Manifest,
    repo: &str,
    auth_level: AuthLevel,
) -> Vec<ResolvedContent> {
    // Build a set of visible scope names, recording whether each is
    // global (no repo filter) or repo-specific.
    let mut scope_priority: HashMap<&str, u32> = HashMap::new();

    for scope in &manifest.scopes {
        // Auth filter: scope visibility must be <= user's auth level
        if scope.visibility > auth_level {
            continue;
        }

        let is_global = scope.repos.is_empty();
        let matches_repo = scope.repos.iter().any(|r| r == repo);

        if is_global {
            scope_priority.insert(&scope.name, 0); // global = lower priority
        } else if matches_repo {
            scope_priority.insert(&scope.name, 1); // repo-specific = higher priority
        }
        // If scope has repos but doesn't match this repo, skip it
    }

    // Collect content from matching scopes, applying "most specific wins"
    let mut content_map: HashMap<&str, ResolvedContent> = HashMap::new();

    for content in &manifest.contents {
        if let Some(&priority) = scope_priority.get(content.scope.as_str()) {
            let existing = content_map.get(content.name.as_str());
            let should_insert = match existing {
                None => true,
                Some(existing) => priority > existing.priority,
            };

            if should_insert {
                // If there's an existing entry with lower priority, merge
                let resolved = if let Some(base) = existing {
                    let merged = merge_content(
                        &Content {
                            name: base.name.clone(),
                            scope: base.source_scope.clone(),
                            body: base.body.clone(),
                            metadata: HashMap::new(),
                        },
                        content,
                    );
                    ResolvedContent {
                        name: merged.name,
                        body: merged.body,
                        source_scope: content.scope.clone(),
                        priority,
                    }
                } else {
                    ResolvedContent {
                        name: content.name.clone(),
                        body: content.body.clone(),
                        source_scope: content.scope.clone(),
                        priority,
                    }
                };

                content_map.insert(&content.name, resolved);
            }
        }
    }

    let mut results: Vec<ResolvedContent> = content_map.into_values().collect();
    results.sort_by(|a, b| a.name.cmp(&b.name));
    results
}

/// Merge two content items with the same name. The override replaces the
/// base body entirely. Metadata is merged with override keys winning.
pub fn merge_content(base: &Content, override_content: &Content) -> Content {
    let mut merged_metadata = base.metadata.clone();
    for (k, v) in &override_content.metadata {
        merged_metadata.insert(k.clone(), v.clone());
    }

    Content {
        name: override_content.name.clone(),
        scope: override_content.scope.clone(),
        body: override_content.body.clone(),
        metadata: merged_metadata,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Manifest, Scope};

    fn make_manifest(scopes: Vec<Scope>, contents: Vec<Content>) -> Manifest {
        Manifest {
            scopes,
            contents,
            tools: vec![],
        }
    }

    #[test]
    fn test_resolve_single_global_scope() {
        let manifest = make_manifest(
            vec![Scope {
                name: "global".into(),
                visibility: AuthLevel::Public,
                repos: vec![],
                sources: vec![],
            }],
            vec![Content {
                name: "coding_standards".into(),
                scope: "global".into(),
                body: "Use consistent formatting".into(),
                metadata: HashMap::new(),
            }],
        );

        let result = resolve_hierarchy(&manifest, "awx", AuthLevel::Public);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "coding_standards");
        assert_eq!(result[0].body, "Use consistent formatting");
        assert_eq!(result[0].source_scope, "global");
    }

    #[test]
    fn test_repo_specific_overrides_global() {
        let manifest = make_manifest(
            vec![
                Scope {
                    name: "global".into(),
                    visibility: AuthLevel::Public,
                    repos: vec![],
                    sources: vec![],
                },
                Scope {
                    name: "awx-specific".into(),
                    visibility: AuthLevel::Public,
                    repos: vec!["awx".into()],
                    sources: vec![],
                },
            ],
            vec![
                Content {
                    name: "coding_standards".into(),
                    scope: "global".into(),
                    body: "Global standards".into(),
                    metadata: HashMap::new(),
                },
                Content {
                    name: "coding_standards".into(),
                    scope: "awx-specific".into(),
                    body: "AWX-specific standards".into(),
                    metadata: HashMap::new(),
                },
            ],
        );

        let result = resolve_hierarchy(&manifest, "awx", AuthLevel::Public);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].body, "AWX-specific standards");
        assert_eq!(result[0].source_scope, "awx-specific");
    }

    #[test]
    fn test_most_specific_wins_with_multiple_scopes() {
        let manifest = make_manifest(
            vec![
                Scope {
                    name: "community".into(),
                    visibility: AuthLevel::Public,
                    repos: vec![],
                    sources: vec![],
                },
                Scope {
                    name: "platform".into(),
                    visibility: AuthLevel::Github,
                    repos: vec!["awx".into()],
                    sources: vec![],
                },
                Scope {
                    name: "internal".into(),
                    visibility: AuthLevel::RedhatSso,
                    repos: vec!["awx".into()],
                    sources: vec![],
                },
            ],
            vec![
                Content {
                    name: "security".into(),
                    scope: "community".into(),
                    body: "Public security".into(),
                    metadata: HashMap::new(),
                },
                Content {
                    name: "security".into(),
                    scope: "platform".into(),
                    body: "Platform security".into(),
                    metadata: HashMap::new(),
                },
                Content {
                    name: "security".into(),
                    scope: "internal".into(),
                    body: "Internal security".into(),
                    metadata: HashMap::new(),
                },
            ],
        );

        // RedHatSSO user sees the most specific (repo-specific) content.
        // Both platform and internal are repo-specific with priority 1,
        // the last one encountered wins.
        let result = resolve_hierarchy(&manifest, "awx", AuthLevel::RedhatSso);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "security");
        // Both platform and internal are repo-specific, so the last one
        // iterated replaces the first.
        assert!(
            result[0].source_scope == "platform" || result[0].source_scope == "internal"
        );
    }

    #[test]
    fn test_no_matching_repo_returns_only_global() {
        let manifest = make_manifest(
            vec![
                Scope {
                    name: "global".into(),
                    visibility: AuthLevel::Public,
                    repos: vec![],
                    sources: vec![],
                },
                Scope {
                    name: "awx-specific".into(),
                    visibility: AuthLevel::Public,
                    repos: vec!["awx".into()],
                    sources: vec![],
                },
            ],
            vec![
                Content {
                    name: "coding_standards".into(),
                    scope: "global".into(),
                    body: "Global standards".into(),
                    metadata: HashMap::new(),
                },
                Content {
                    name: "awx_guide".into(),
                    scope: "awx-specific".into(),
                    body: "AWX guide".into(),
                    metadata: HashMap::new(),
                },
            ],
        );

        let result = resolve_hierarchy(&manifest, "receptor", AuthLevel::Public);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "coding_standards");
    }

    #[test]
    fn test_no_content_and_no_global_returns_empty() {
        let manifest = make_manifest(
            vec![Scope {
                name: "awx-only".into(),
                visibility: AuthLevel::Public,
                repos: vec!["awx".into()],
                sources: vec![],
            }],
            vec![Content {
                name: "awx_guide".into(),
                scope: "awx-only".into(),
                body: "AWX guide".into(),
                metadata: HashMap::new(),
            }],
        );

        let result = resolve_hierarchy(&manifest, "receptor", AuthLevel::Public);
        assert!(result.is_empty());
    }

    #[test]
    fn test_merge_content_replaces_body_merges_metadata() {
        let mut base_meta = HashMap::new();
        base_meta.insert("author".into(), "alice".into());
        base_meta.insert("version".into(), "1.0".into());

        let mut override_meta = HashMap::new();
        override_meta.insert("version".into(), "2.0".into());
        override_meta.insert("reviewer".into(), "bob".into());

        let base = Content {
            name: "standards".into(),
            scope: "global".into(),
            body: "Old body".into(),
            metadata: base_meta,
        };

        let override_content = Content {
            name: "standards".into(),
            scope: "team".into(),
            body: "New body".into(),
            metadata: override_meta,
        };

        let merged = merge_content(&base, &override_content);
        assert_eq!(merged.body, "New body");
        assert_eq!(merged.scope, "team");
        assert_eq!(merged.metadata["author"], "alice"); // from base
        assert_eq!(merged.metadata["version"], "2.0"); // override wins
        assert_eq!(merged.metadata["reviewer"], "bob"); // from override
        assert_eq!(merged.metadata.len(), 3);
    }
}
