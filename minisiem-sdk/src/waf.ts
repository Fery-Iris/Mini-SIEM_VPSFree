export const WAF_RULES = [
  {
    name: "SQL Injection",
    regex: /(%27)|(\x27)|(--)|(%23)|(#)/i,
    severity: "Critical",
  },
  {
    name: "Cross-Site Scripting (XSS)",
    regex: /((%3C)|<)((%2F)|\/)*[a-z0-9%]+((%3E)|>)/i,
    severity: "High",
  },
  {
    name: "Path Traversal",
    regex: /\.\.\/|\.\.\\/i,
    severity: "High",
  }
];

export function detectThreats(url: string, headers: Headers, bodyStr?: string) {
  const payloads = [url, bodyStr].filter(Boolean) as string[];
  // Also check User-Agent
  payloads.push(headers.get("user-agent") || "");
  
  for (const payload of payloads) {
    for (const rule of WAF_RULES) {
      if (rule.regex.test(payload)) {
        return {
          detected: true,
          action: "WAF_BLOCK",
          severity: rule.severity,
          ruleName: rule.name,
          matchedPayload: payload.substring(0, 200) // trunc
        };
      }
    }
  }
  return { detected: false };
}
