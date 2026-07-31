export const WAF_RULES = [
  // 1. SQL Injection (SQLi)
  {
    name: "SQL Injection (SQLi)",
    regex: /(?:%27)|(?:\x27)|(?:--)|(?:%23)|(?:#)|(?:%3B)|(?:;)|(?:\b(?:UNION|SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)\b)/i,
    severity: "Critical",
  },
  // 2. Cross-Site Scripting (XSS)
  {
    name: "Cross-Site Scripting (XSS)",
    regex: /(?:%3C|<)(?:%2F|\/)*[a-z0-9%]+(?:%3E|>)|(?:\b(?:javascript|vbscript|expression|onload|onerror|onmouseover|prompt|alert)\b)/i,
    severity: "High",
  },
  // 3. Path Traversal / Local File Inclusion (LFI)
  {
    name: "Path Traversal (LFI/RFI)",
    regex: /(?:\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c|etc\/passwd|boot\.ini|windows\\win\.ini)/i,
    severity: "High",
  },
  // 4. Command Injection (OS)
  {
    name: "OS Command Injection",
    regex: /(?:;|\||`|\$|\n|\r)(?:\s*)(?:cat|ls|pwd|whoami|id|wget|curl|nc|bash|sh|ping)\b/i,
    severity: "Critical",
  },
  // 5. NoSQL Injection
  {
    name: "NoSQL Injection",
    regex: /(?:\$where|\$ne|\$gt|\$lt|\$gte|\$lte|\$in|\$nin|\$regex)/i,
    severity: "High",
  },
  // 6. Code Injection (PHP, Node.js)
  {
    name: "Code Injection",
    regex: /(?:<\?php|eval\(|base64_decode\(|system\(|exec\(|shell_exec\(|passthru\()/i,
    severity: "Critical",
  },
  // 7. Log4Shell / JNDI Injection
  {
    name: "JNDI / Log4Shell Injection",
    regex: /(?:\$\{jndi:(?:ldap|rmi|dns|iiop|http|https|corba)\:\/\/)/i,
    severity: "Critical",
  },
  // 8. Server-Side Request Forgery (SSRF)
  {
    name: "Server-Side Request Forgery (SSRF)",
    regex: /(?:metadata\.google\.internal|169\.254\.169\.254|localhost|127\.0\.0\.1|::1|file:\/\/|dict:\/\/|gopher:\/\/)/i,
    severity: "Medium",
  },
  // 9. XML External Entity (XXE)
  {
    name: "XML External Entity (XXE)",
    regex: /(?:<!ENTITY\s+[\w\s]+\s+SYSTEM|<!DOCTYPE\s+[\w\s]+\s+\[\s*<!ENTITY)/i,
    severity: "High",
  },
  // 10. Malicious Bots & Scrapers (via User-Agent or known bad signatures)
  {
    name: "Malicious Bot / Scanner",
    regex: /(?:sqlmap|nikto|nmap|dirbuster|burpcollaborator|zgrab|masscan|shodan|censys|acunetix|nessus)/i,
    severity: "Medium",
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
