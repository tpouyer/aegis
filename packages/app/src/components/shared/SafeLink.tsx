const SAFE_SCHEMES = /^(https?:|mailto:|#|\/)/i

export function SafeLink({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const isSafe = href && SAFE_SCHEMES.test(href)

  if (!isSafe) {
    return <span>{children}</span>
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  )
}
