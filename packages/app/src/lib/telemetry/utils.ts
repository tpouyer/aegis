const DYNAMIC_PATTERNS = [
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  /^[A-Z]+-\d+$/,
  /^\d+$/,
  /^[0-9a-f]{40}$/i,
];

export function extractUrlTemplate(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const sanitized = segments.map((seg) =>
      DYNAMIC_PATTERNS.some((p) => p.test(seg)) ? '{id}' : seg,
    );
    return `${parsed.hostname}/${sanitized.join('/')}`;
  } catch {
    return 'unknown';
  }
}
