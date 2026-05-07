use thiserror::Error;

#[derive(Error, Debug)]
pub enum SandboxError {
    #[error("sandbox not yet implemented")]
    NotImplemented,
}

pub fn execute_in_sandbox(_code: &str) -> Result<String, SandboxError> {
    Err(SandboxError::NotImplemented)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sandbox_returns_not_implemented() {
        let result = execute_in_sandbox("console.log('hello')");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("not yet implemented"));
    }
}
