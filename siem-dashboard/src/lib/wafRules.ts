/**
 * WAF Rules Dictionary — Static data for the Dashboard UI
 *
 * Sourced from minisiem-sdk/src/waf.ts (WAF_RULES).
 * Stored as plain data (no RegExp objects) to avoid SSR issues.
 * Update this file whenever waf.ts rules are updated.
 */

export type RuleCategory = 'Critical' | 'High' | 'Medium' | 'Low';

export interface DashboardWAFRule {
  id: string;
  name: string;
  category: RuleCategory;
  level: number;
  description: string;
  regexStr: string;
  targets: string[];
  owasp: string;
  /** Human-readable keyword/pattern tokens extracted from the regex */
  patternTokens: string[];
}

export const DASHBOARD_WAF_RULES: DashboardWAFRule[] = [
  // ── Critical (Level 12-15) ──────────────────────────────────────────
  {
    id: 'SQLI_001',
    name: 'SQL Injection (SQLi)',
    category: 'Critical',
    level: 12,
    description: 'SQL injection attempt detected in request parameters.',
    regexStr: String.raw`(?:%27)|(?:\x27)|(--)|(%23)|(#)|(\bUNION\s+SELECT|\bDROP\s+TABLE|\bDELETE\s+FROM\b)`,
    targets: ['url', 'body'],
    owasp: 'A03:2021 – Injection',
    patternTokens: [
      '%27', "'", '--', '%23', '#', '%3B', ';',
      'UNION SELECT', 'INSERT INTO', 'UPDATE SET',
      'DELETE FROM', 'DROP TABLE', 'ALTER TABLE',
    ],
  },
  {
    id: 'CMDI_001',
    name: 'OS Command Injection',
    category: 'Critical',
    level: 13,
    description: 'OS command injection attempt via shell metacharacters.',
    regexStr: String.raw`(?:;|\||\`|\$|\n|\r)(?:\s*)(?:cat|ls|pwd|whoami|wget|curl|nc|bash|sh)\b`,
    targets: ['url', 'body'],
    owasp: 'A03:2021 – Injection',
    patternTokens: [
      ';cmd', '|cmd', '`cmd`', '$(...)',
      'cat', 'ls', 'pwd', 'whoami', 'id',
      'wget', 'curl', 'nc', 'bash', 'sh', 'ping',
    ],
  },
  {
    id: 'CODE_001',
    name: 'Code Injection (PHP/Node)',
    category: 'Critical',
    level: 13,
    description: 'Server-side code injection attempt (PHP eval, shell_exec, etc.).',
    regexStr: String.raw`(?:<\?php|eval\(|base64_decode\(|system\(|exec\(|shell_exec\(|passthru\()`,
    targets: ['url', 'body'],
    owasp: 'A03:2021 – Injection',
    patternTokens: [
      '<?php', 'eval(', 'base64_decode(',
      'system(', 'exec(', 'shell_exec(', 'passthru(',
    ],
  },
  {
    id: 'JNDI_001',
    name: 'JNDI / Log4Shell Injection',
    category: 'Critical',
    level: 14,
    description: 'Log4Shell/JNDI lookup injection targeting Java applications.',
    regexStr: String.raw`(?:\$\{jndi:(?:ldap|rmi|dns|iiop|http|https|corba)://)`,
    targets: ['url', 'body', 'headers', 'user-agent'],
    owasp: 'A06:2021 – Vulnerable Components',
    patternTokens: [
      '${jndi:ldap://', '${jndi:rmi://',
      '${jndi:dns://', '${jndi:iiop://',
      '${jndi:http://', '${jndi:corba://',
    ],
  },
  {
    id: 'SHELLSHOCK_001',
    name: 'Shellshock Vulnerability',
    category: 'Critical',
    level: 14,
    description: 'Shellshock remote command execution via malformed bash function in headers.',
    regexStr: String.raw`\(\)\s*\{\s*:\s*;\s*\}\s*;`,
    targets: ['headers', 'user-agent'],
    owasp: 'A06:2021 – Vulnerable Components',
    patternTokens: ['() { :; };', '() {', ': ;'],
  },
  {
    id: 'DESERIAL_001',
    name: 'Insecure Deserialization',
    category: 'Critical',
    level: 12,
    description: 'Insecure deserialization payload detected (PHP/Java object serialization).',
    regexStr: String.raw`(?:O:[0-9]+:"[a-z0-9_]+":| rO0ABXNy|Tzo[0-9]+:)`,
    targets: ['body', 'headers', 'url'],
    owasp: 'A08:2021 – Software & Data Integrity Failures',
    patternTokens: ['O:<n>:"class":', 'rO0ABXNy', 'Tzo<n>:', 'a:<n>:{'],
  },

  // ── High (Level 8-11) ───────────────────────────────────────────────
  {
    id: 'AUTH_001',
    name: 'Failed Login Attempt (Brute Force)',
    category: 'High',
    level: 2,
    description: 'Multiple failed credential attempts detected on authentication endpoints.',
    regexStr: String.raw`(?:invalid_credentials|failed_login|AUTH_001|invalid_password)`,
    targets: ['auth', 'body'],
    owasp: 'A07:2021 – Identification and Authentication Failures',
    patternTokens: [
      'Failed Login', 'AUTH_001', 'invalid_credentials',
      '401 Unauthorized', 'Brute Force',
    ],
  },
  {
    id: 'XSS_001',
    name: 'Cross-Site Scripting (XSS)',
    category: 'High',
    level: 8,
    description: 'XSS attempt via HTML/JS injection in request parameters.',
    regexStr: String.raw`(?:%3C|<)(?:%2F|/)*[a-z0-9%]+(?:%3E|>)|(?:javascript:|vbscript:|onerror=|onload=|alert\()`,
    targets: ['url', 'body'],
    owasp: 'A03:2021 – Injection',
    patternTokens: [
      '%3C', '<script>', '</script>', 'javascript:',
      'vbscript:', 'expression(', 'onerror=',
      'onload=', 'onmouseover=', 'alert(', 'prompt(',
    ],
  },
  {
    id: 'LFI_001',
    name: 'Path Traversal (LFI/RFI)',
    category: 'High',
    level: 9,
    description: 'Local/Remote File Inclusion via directory traversal sequences.',
    regexStr: String.raw`(?:\.\./|\.\.\\|%2e%2e%2f|%2e%2e%5c|etc/passwd|boot\.ini|windows\\win\.ini)`,
    targets: ['url', 'body'],
    owasp: 'A01:2021 – Broken Access Control',
    patternTokens: [
      '../', '..\\', '%2e%2e%2f', '%2e%2e%5c',
      'etc/passwd', 'boot.ini', 'win.ini',
    ],
  },
  {
    id: 'NOSQL_001',
    name: 'NoSQL Injection',
    category: 'High',
    level: 9,
    description: 'NoSQL injection targeting MongoDB operators.',
    regexStr: String.raw`(?:\$where|\$ne|\$gt|\$lt|\$gte|\$lte|\$in|\$nin|\$regex)`,
    targets: ['url', 'body'],
    owasp: 'A03:2021 – Injection',
    patternTokens: [
      '$where', '$ne', '$gt', '$lt',
      '$gte', '$lte', '$in', '$nin', '$regex',
    ],
  },
  {
    id: 'LDAP_001',
    name: 'LDAP Injection',
    category: 'High',
    level: 8,
    description: 'LDAP injection attempt via malformed filter expressions.',
    regexStr: String.raw`(?:\(\w+=[^\)]+\)|\(&|\(\|)`,
    targets: ['url', 'body'],
    owasp: 'A03:2021 – Injection',
    patternTokens: ['(uid=*)', '(cn=*)', '(&(', '(|(', ')(uid=*)('],
  },
  {
    id: 'XXE_001',
    name: 'XML External Entity (XXE)',
    category: 'High',
    level: 10,
    description: 'XXE attack attempting to read server files via malicious XML DOCTYPE.',
    regexStr: String.raw`(?:<!ENTITY\s+[\w\s]+\s+SYSTEM|<!DOCTYPE\s+[\w\s]+\s+\[\s*<!ENTITY)`,
    targets: ['body'],
    owasp: 'A05:2021 – Security Misconfiguration',
    patternTokens: ['<!ENTITY', 'SYSTEM "', '<!DOCTYPE', 'PUBLIC "', 'file:///'],
  },
  {
    id: 'DATA_LEAK_001',
    name: 'Sensitive Data Exposure',
    category: 'High',
    level: 10,
    description: 'Private key, API secret, or sensitive credential detected in request.',
    regexStr: String.raw`(?:BEGIN RSA PRIVATE KEY|BEGIN DSA PRIVATE KEY|BEGIN EC PRIVATE KEY|BEGIN OPENSSH PRIVATE KEY|sk_live_[a-zA-Z0-9]{24,})`,
    targets: ['body', 'url', 'headers'],
    owasp: 'A02:2021 – Cryptographic Failures',
    patternTokens: [
      'BEGIN RSA PRIVATE KEY', 'BEGIN DSA PRIVATE KEY',
      'BEGIN EC PRIVATE KEY', 'BEGIN OPENSSH PRIVATE KEY',
      'sk_live_', 'pk_live_',
    ],
  },

  // ── Medium (Level 4-7) ──────────────────────────────────────────────
  {
    id: 'SSRF_001',
    name: 'Server-Side Request Forgery (SSRF)',
    category: 'Medium',
    level: 7,
    description: 'SSRF attempt targeting internal services or cloud metadata endpoints.',
    regexStr: String.raw`(?:metadata\.google\.internal|169\.254\.169\.254|localhost|127\.0\.0\.1|::1|file://|dict://|gopher://)`,
    targets: ['url', 'body'],
    owasp: 'A10:2021 – Server-Side Request Forgery',
    patternTokens: [
      '169.254.169.254', 'metadata.google.internal',
      'localhost', '127.0.0.1', '::1',
      'file://', 'dict://', 'gopher://',
    ],
  },
  {
    id: 'SCANNER_001',
    name: 'Malicious Bot / Scanner',
    category: 'Medium',
    level: 6,
    description: 'Known malicious scanner or security tool User-Agent detected.',
    regexStr: String.raw`(?:sqlmap|nikto|nmap|dirbuster|burpcollaborator|zgrab|masscan|shodan|censys|acunetix|nessus)`,
    targets: ['user-agent'],
    owasp: 'A05:2021 – Security Misconfiguration',
    patternTokens: [
      'sqlmap', 'nikto', 'nmap', 'dirbuster',
      'burpcollaborator', 'zgrab', 'masscan',
      'shodan', 'censys', 'acunetix', 'nessus',
    ],
  },
  {
    id: 'PROBE_001',
    name: 'Suspicious Path Probe',
    category: 'Medium',
    level: 4,
    description: 'Probing for common admin panels or sensitive files.',
    regexStr: String.raw`(?:/wp-admin|/wp-login|/administrator|/phpmyadmin|/\.env|/\.git|/config\.php|/xmlrpc\.php|/\.ssh)`,
    targets: ['url'],
    owasp: 'A01:2021 / A05:2021',
    patternTokens: [
      '/wp-admin', '/wp-login', '/administrator',
      '/phpmyadmin', '/.env', '/.git',
      '/config.php', '/xmlrpc.php', '/.ssh',
    ],
  },
  {
    id: 'AUTH_001',
    name: 'Authentication Bypass Attempt',
    category: 'Medium',
    level: 7,
    description: 'Attempted authentication bypass via basic SQLi logic injection.',
    regexStr: String.raw`(?:admin'|' OR 1=1|' OR '1'='1|1' OR '1'='1)`,
    targets: ['url', 'body'],
    owasp: "A07:2021 – Identification & Authentication Failures",
    patternTokens: ["admin'", "' OR 1=1", "' OR '1'='1", "1' OR '1'='1", "' OR ''='"],
  },

  // ── Low / Noise (Level 1-3) ─────────────────────────────────────────
  {
    id: 'UA_001',
    name: 'Empty User-Agent',
    category: 'Low',
    level: 3,
    description: 'Request with empty User-Agent header (potential automated bot).',
    regexStr: '^$',
    targets: ['user-agent'],
    owasp: 'Informational',
    patternTokens: ['[Empty String]', '[No User-Agent]'],
  },
  {
    id: 'PROTO_001',
    name: 'Protocol Anomaly',
    category: 'Low',
    level: 3,
    description: 'Unusual HTTP method detected (CONNECT, TRACE, TRACK, DEBUG).',
    regexStr: String.raw`(?:CONNECT|TRACE|TRACK|DEBUG)\s`,
    targets: ['url'],
    owasp: 'Informational',
    patternTokens: ['CONNECT', 'TRACE', 'TRACK', 'DEBUG'],
  },
];

/** Flat ordered list: Critical → High → Medium → Low */
export const CATEGORY_ORDER: RuleCategory[] = ['Critical', 'High', 'Medium', 'Low'];

export const RULES_BY_CATEGORY: Record<RuleCategory, DashboardWAFRule[]> = {
  Critical: DASHBOARD_WAF_RULES.filter(r => r.category === 'Critical'),
  High:     DASHBOARD_WAF_RULES.filter(r => r.category === 'High'),
  Medium:   DASHBOARD_WAF_RULES.filter(r => r.category === 'Medium'),
  Low:      DASHBOARD_WAF_RULES.filter(r => r.category === 'Low'),
};

export const CATEGORY_STYLES: Record<RuleCategory, { badge: string; header: string; border: string }> = {
  Critical: {
    badge:  'bg-rose-500/15 text-rose-400 border-rose-500/25',
    header: 'text-rose-400',
    border: 'border-rose-500/20',
  },
  High: {
    badge:  'bg-red-500/15 text-red-400 border-red-500/25',
    header: 'text-red-400',
    border: 'border-red-500/20',
  },
  Medium: {
    badge:  'bg-amber-500/15 text-amber-400 border-amber-500/25',
    header: 'text-amber-400',
    border: 'border-amber-500/20',
  },
  Low: {
    badge:  'bg-sky-500/15 text-sky-400 border-sky-500/25',
    header: 'text-sky-400',
    border: 'border-sky-500/20',
  },
};
