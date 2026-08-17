/**
 * Mini-SIEM WAF Engine v2.0 — Wazuh-Inspired Scoring
 *
 * Setiap rule memiliki `level` (0-16) yang menentukan severity skor.
 * detectThreats() mengembalikan SEMUA rule yang cocok (bukan hanya satu),
 * sehingga skor bisa diakumulasi oleh scoreAccumulator.
 *
 * Level Reference (Wazuh-style):
 *   0-3   Noise / Informasi
 *   4-7   Low-Medium
 *   8-11  High
 *   12-15 Critical
 *   16    Fatal (reserved, never auto-assigned)
 */

export interface WAFRule {
  id: string;
  name: string;
  regex: RegExp;
  level: number;
  category: "Noise" | "Low" | "Medium" | "High" | "Critical";
  target: ("url" | "body" | "user-agent" | "headers")[];
  description: string;
}

export interface WAFMatch {
  ruleId: string;
  ruleName: string;
  level: number;
  category: string;
  matchedPayload: string;
  matchedIn: string; // which target matched (url, body, user-agent)
}

export interface DetectionResult {
  detected: boolean;
  totalScore: number;
  highestLevel: number;
  matches: WAFMatch[];
}

// ─────────────── WAF Rules with Scoring Levels ─────────────── //

export const WAF_RULES: WAFRule[] = [
  // ── Critical (Level 12-15): Immediate high-risk attacks ──
  {
    id: "SQLI_001",
    name: "SQL Injection (SQLi)",
    regex: /(?:%27)|(?:\x27)|(?:--)|(?:%23)|(?:#)|(?:%3B)|(?:;)|(?:\b(?:UNION\s+SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|DROP\s+TABLE|ALTER\s+TABLE)\b)/i,
    level: 12,
    category: "Critical",
    target: ["url", "body"],
    description: "SQL injection attempt detected in request parameters (OWASP A03:2021 - Injection)",
  },
  {
    id: "CMDI_001",
    name: "OS Command Injection",
    regex: /(?:;|\||\`|\$|\n|\r)(?:\s*)(?:cat|ls|pwd|whoami|id|wget|curl|nc|bash|sh|ping)\b/i,
    level: 13,
    category: "Critical",
    target: ["url", "body"],
    description: "OS command injection attempt via shell metacharacters (OWASP A03:2021 - Injection)",
  },
  {
    id: "CODE_001",
    name: "Code Injection (PHP/Node)",
    regex: /(?:<\?php|eval\(|base64_decode\(|system\(|exec\(|shell_exec\(|passthru\()/i,
    level: 13,
    category: "Critical",
    target: ["url", "body"],
    description: "Server-side code injection attempt (OWASP A03:2021 - Injection)",
  },
  {
    id: "JNDI_001",
    name: "JNDI / Log4Shell Injection",
    regex: /(?:\$\{jndi:(?:ldap|rmi|dns|iiop|http|https|corba):\/\/)/i,
    level: 14,
    category: "Critical",
    target: ["url", "body", "headers", "user-agent"],
    description: "Log4Shell/JNDI lookup injection attempt (OWASP A06:2021 - Vulnerable Components)",
  },
  {
    id: "SHELLSHOCK_001",
    name: "Shellshock Vulnerability",
    regex: /\(\)\s*\{\s*:\s*;\s*\}\s*;/i,
    level: 14,
    category: "Critical",
    target: ["headers", "user-agent"],
    description: "Shellshock remote command execution attempt (OWASP A06:2021 - Vulnerable Components)",
  },
  {
    id: "DESERIAL_001",
    name: "Insecure Deserialization",
    regex: /(?:O:[0-9]+:"[a-z0-9_]+":|rO0ABXNy|Tzo[0-9]+:)/i,
    level: 12,
    category: "Critical",
    target: ["body", "headers", "url"],
    description: "Insecure Deserialization payload detected (PHP/Java) (OWASP A08:2021 - Software and Data Integrity Failures)",
  },

  // ── High (Level 8-11): Serious but not always instant-block ──
  {
    id: "XSS_001",
    name: "Cross-Site Scripting (XSS)",
    regex: /(?:%3C|<)(?:%2F|\/)*[a-z0-9%]+(?:%3E|>)|(?:\b(?:javascript|vbscript|expression|onload|onerror|onmouseover|prompt|alert)\b)/i,
    level: 8,
    category: "High",
    target: ["url", "body"],
    description: "Cross-site scripting attempt via HTML/JS injection (OWASP A03:2021 - Injection)",
  },
  {
    id: "LFI_001",
    name: "Path Traversal (LFI/RFI)",
    regex: /(?:\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c|etc\/passwd|boot\.ini|windows\\win\.ini)/i,
    level: 9,
    category: "High",
    target: ["url", "body"],
    description: "Local/remote file inclusion via path traversal (OWASP A01:2021 - Broken Access Control)",
  },
  {
    id: "NOSQL_001",
    name: "NoSQL Injection",
    regex: /(?:\$where|\$ne|\$gt|\$lt|\$gte|\$lte|\$in|\$nin|\$regex)/i,
    level: 9,
    category: "High",
    target: ["url", "body"],
    description: "NoSQL injection attempt targeting MongoDB operators (OWASP A03:2021 - Injection)",
  },
  {
    id: "LDAP_001",
    name: "LDAP Injection",
    regex: /(?:\(\w+=[^\)]+\)|\(&|\(\|)/i,
    level: 8,
    category: "High",
    target: ["url", "body"],
    description: "LDAP injection attempt (OWASP A03:2021 - Injection)",
  },
  {
    id: "XXE_001",
    name: "XML External Entity (XXE)",
    regex: /(?:<!ENTITY\s+[\w\s]+\s+SYSTEM|<!DOCTYPE\s+[\w\s]+\s+\[\s*<!ENTITY)/i,
    level: 10,
    category: "High",
    target: ["body"],
    description: "XXE attack attempting to read server files via XML (OWASP A05:2021 - Security Misconfiguration)",
  },
  {
    id: "DATA_LEAK_001",
    name: "Sensitive Data Exposure",
    regex: /(?:BEGIN RSA PRIVATE KEY|BEGIN DSA PRIVATE KEY|BEGIN EC PRIVATE KEY|BEGIN OPENSSH PRIVATE KEY|sk_live_[a-zA-Z0-9]{24,})/i,
    level: 10,
    category: "High",
    target: ["body", "url", "headers"],
    description: "Sensitive data exposure like Private Keys or API secrets (OWASP A02:2021 - Cryptographic Failures)",
  },

  // ── Medium (Level 4-7): Suspicious but common in legitimate traffic ──
  {
    id: "SSRF_001",
    name: "Server-Side Request Forgery (SSRF)",
    regex: /(?:metadata\.google\.internal|169\.254\.169\.254|localhost|127\.0\.0\.1|::1|file:\/\/|dict:\/\/|gopher:\/\/)/i,
    level: 7,
    category: "Medium",
    target: ["url", "body"],
    description: "SSRF attempt targeting internal services or cloud metadata (OWASP A10:2021 - Server-Side Request Forgery)",
  },
  {
    id: "SCANNER_001",
    name: "Malicious Bot / Scanner",
    regex: /(?:sqlmap|nikto|nmap|dirbuster|burpcollaborator|zgrab|masscan|shodan|censys|acunetix|nessus)/i,
    level: 6,
    category: "Medium",
    target: ["user-agent"],
    description: "Known malicious scanner or security tool detected (OWASP A05:2021 - Security Misconfiguration)",
  },
  {
    id: "PROBE_001",
    name: "Suspicious Path Probe",
    regex: /(?:\/wp-admin|\/wp-login|\/administrator|\/phpmyadmin|\/\.env|\/\.git|\/config\.php|\/xmlrpc\.php|\/\.ssh)/i,
    level: 4,
    category: "Medium",
    target: ["url"],
    description: "Probing for common admin panels or sensitive files (OWASP A01:2021 / A05:2021)",
  },
  {
    id: "AUTH_001",
    name: "Authentication Bypass Attempt",
    regex: /(?:admin'|' OR 1=1|' OR '1'='1|1' OR '1'='1)/i,
    level: 7,
    category: "Medium",
    target: ["url", "body"],
    description: "Attempted authentication bypass via basic SQLi logic (OWASP A07:2021 - Identification and Authentication Failures)",
  },

  // ── Low / Noise (Level 1-3): Informational, usually not a threat ──
  {
    id: "UA_001",
    name: "Empty User-Agent",
    regex: /^$/,
    level: 3,
    category: "Low",
    target: ["user-agent"],
    description: "Request with empty User-Agent header (potential bot)",
  },
  {
    id: "PROTO_001",
    name: "Protocol Anomaly",
    regex: /(?:CONNECT|TRACE|TRACK|DEBUG)\s/i,
    level: 3,
    category: "Low",
    target: ["url"],
    description: "Unusual HTTP method detected in URL",
  },
];

// ─────────────── Detection Function ─────────────── //

/**
 * Scans request against ALL rules and returns every match with its score.
 * Unlike v1 which stopped at the first match, v2 accumulates all detections.
 */
export function detectThreats(
  url: string,
  headers: Headers,
  bodyStr?: string
): DetectionResult {
  const matches: WAFMatch[] = [];

  // Prepare payloads by target type
  const payloadMap: Record<string, string> = {
    url: url || "",
    body: bodyStr || "",
    "user-agent": headers.get("user-agent") || "",
    headers: Array.from(headers.entries())
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n"),
  };

  for (const rule of WAF_RULES) {
    for (const target of rule.target) {
      const payload = payloadMap[target];
      if (!payload && target !== "user-agent") continue;

      // Special handling for empty User-Agent rule
      if (rule.id === "UA_001" && target === "user-agent") {
        if (payload === "") {
          matches.push({
            ruleId: rule.id,
            ruleName: rule.name,
            level: rule.level,
            category: rule.category,
            matchedPayload: "(empty)",
            matchedIn: target,
          });
        }
        continue;
      }

      if (payload && rule.regex.test(payload)) {
        matches.push({
          ruleId: rule.id,
          ruleName: rule.name,
          level: rule.level,
          category: rule.category,
          matchedPayload: payload.substring(0, 200), // truncate
          matchedIn: target,
        });
        break; // Don't match same rule multiple times on different targets
      }
    }
  }

  const totalScore = matches.reduce((sum, m) => sum + m.level, 0);
  const highestLevel = matches.length > 0
    ? Math.max(...matches.map((m) => m.level))
    : 0;

  return {
    detected: matches.length > 0,
    totalScore,
    highestLevel,
    matches,
  };
}

/**
 * Derive severity string from a numeric level (for backward compatibility).
 */
export function levelToSeverity(level: number): string {
  if (level >= 12) return "Critical";
  if (level >= 8) return "High";
  if (level >= 4) return "Medium";
  return "Low";
}
