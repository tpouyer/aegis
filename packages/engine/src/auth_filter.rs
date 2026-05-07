use crate::types::{AuthLevel, Manifest};

/// Filter a manifest to only include scopes whose visibility level is at or
/// below the given auth level. Contents and tools associated with filtered-out
/// scopes are also removed.
pub fn filter_by_auth(manifest: &Manifest, auth_level: AuthLevel) -> Manifest {
    // Keep only scopes that the user can see
    let visible_scopes: Vec<_> = manifest
        .scopes
        .iter()
        .filter(|s| s.visibility <= auth_level)
        .cloned()
        .collect();

    // Build a set of visible scope names for filtering contents
    let visible_scope_names: std::collections::HashSet<&str> = visible_scopes
        .iter()
        .map(|s| s.name.as_str())
        .collect();

    // Keep only contents belonging to visible scopes
    let visible_contents: Vec<_> = manifest
        .contents
        .iter()
        .filter(|c| visible_scope_names.contains(c.scope.as_str()))
        .cloned()
        .collect();

    Manifest {
        scopes: visible_scopes,
        contents: visible_contents,
        // Tools are not scope-gated — they are always available if the user
        // has the auth level to load the manifest. The tool catalog itself
        // is determined by which manifest file (public/github/internal) is
        // loaded, which is handled at the Service Worker layer.
        tools: manifest.tools.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Content, Scope};
    use std::collections::HashMap;

    fn make_test_manifest() -> Manifest {
        Manifest {
            scopes: vec![
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
                    repos: vec![],
                    sources: vec![],
                },
            ],
            contents: vec![
                Content {
                    name: "public_guide".into(),
                    scope: "community".into(),
                    body: "Public content".into(),
                    metadata: HashMap::new(),
                },
                Content {
                    name: "dev_guide".into(),
                    scope: "platform".into(),
                    body: "GitHub-gated content".into(),
                    metadata: HashMap::new(),
                },
                Content {
                    name: "secret_doc".into(),
                    scope: "internal".into(),
                    body: "Internal content".into(),
                    metadata: HashMap::new(),
                },
            ],
            tools: vec![],
        }
    }

    #[test]
    fn test_public_sees_only_public_scopes() {
        let manifest = make_test_manifest();
        let filtered = filter_by_auth(&manifest, AuthLevel::Public);
        assert_eq!(filtered.scopes.len(), 1);
        assert_eq!(filtered.scopes[0].name, "community");
        assert_eq!(filtered.contents.len(), 1);
        assert_eq!(filtered.contents[0].name, "public_guide");
    }

    #[test]
    fn test_github_sees_public_and_github_scopes() {
        let manifest = make_test_manifest();
        let filtered = filter_by_auth(&manifest, AuthLevel::Github);
        assert_eq!(filtered.scopes.len(), 2);

        let names: Vec<&str> = filtered.scopes.iter().map(|s| s.name.as_str()).collect();
        assert!(names.contains(&"community"));
        assert!(names.contains(&"platform"));

        assert_eq!(filtered.contents.len(), 2);
        let content_names: Vec<&str> = filtered.contents.iter().map(|c| c.name.as_str()).collect();
        assert!(content_names.contains(&"public_guide"));
        assert!(content_names.contains(&"dev_guide"));
    }

    #[test]
    fn test_redhat_sso_sees_all_scopes() {
        let manifest = make_test_manifest();
        let filtered = filter_by_auth(&manifest, AuthLevel::RedhatSso);
        assert_eq!(filtered.scopes.len(), 3);
        assert_eq!(filtered.contents.len(), 3);
    }

    #[test]
    fn test_filter_preserves_only_visible_scope_contents() {
        let manifest = make_test_manifest();
        let filtered = filter_by_auth(&manifest, AuthLevel::Public);

        // Verify no contents from non-visible scopes leak through
        for content in &filtered.contents {
            assert_eq!(content.scope, "community");
        }
    }
}
