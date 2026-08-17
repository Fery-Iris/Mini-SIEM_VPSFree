/**
 * prisma/seed.ts
 * Seed script untuk mengisi data contoh di database Mini-SIEM.
 * Run: npx tsx prisma/seed.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Threat Signatures (sample attack patterns) ───────────────────────────────

const SAMPLE_THREATS: Array<{
  sourceIp: string;
  countryCode: string;
  country: string;
  flag: string;
  lat: number;
  lng: number;
  severity: string;
  score: number;
  accumulatedScore: number;
  matchedRules: string[];
  decision: string;
  action: string;
}> = [
  {
    sourceIp: '185.234.219.78',
    countryCode: 'RU',
    country: 'Russia',
    flag: '🇷🇺',
    lat: 55.75,
    lng: 37.62,
    severity: 'Critical',
    score: 12,
    accumulatedScore: 15,
    matchedRules: ['SQL Injection', 'Auth Bypass', 'Data Exfiltration'],
    decision: 'BLOCK',
    action: 'THREAT_BLOCKED',
  },
  {
    sourceIp: '45.227.255.100',
    countryCode: 'CN',
    country: 'China',
    flag: '🇨🇳',
    lat: 39.91,
    lng: 116.39,
    severity: 'High',
    score: 8,
    accumulatedScore: 9,
    matchedRules: ['XSS Probe', 'Path Traversal'],
    decision: 'ALERT',
    action: 'THREAT_ALERTED',
  },
  {
    sourceIp: '91.108.4.56',
    countryCode: 'NL',
    country: 'Netherlands',
    flag: '🇳🇱',
    lat: 52.37,
    lng: 4.90,
    severity: 'High',
    score: 10,
    accumulatedScore: 14,
    matchedRules: ['Brute Force', 'Port Scan', 'SSH Exploit'],
    decision: 'BLOCK',
    action: 'THREAT_BLOCKED',
  },
  {
    sourceIp: '196.52.43.11',
    countryCode: 'NG',
    country: 'Nigeria',
    flag: '🇳🇬',
    lat: 9.08,
    lng: 8.68,
    severity: 'Medium',
    score: 6,
    accumulatedScore: 7,
    matchedRules: ['Phishing Probe', 'HTTP Flood'],
    decision: 'ALERT',
    action: 'THREAT_ALERTED',
  },
  {
    sourceIp: '103.75.190.23',
    countryCode: 'IN',
    country: 'India',
    flag: '🇮🇳',
    lat: 28.61,
    lng: 77.21,
    severity: 'Medium',
    score: 5,
    accumulatedScore: 5,
    matchedRules: ['Command Injection'],
    decision: 'LOG',
    action: 'THREAT_LOGGED',
  },
  {
    sourceIp: '31.13.72.36',
    countryCode: 'US',
    country: 'United States',
    flag: '🇺🇸',
    lat: 37.77,
    lng: -122.42,
    severity: 'Low',
    score: 2,
    accumulatedScore: 3,
    matchedRules: ['User Agent Anomaly'],
    decision: 'LOG',
    action: 'THREAT_LOGGED',
  },
  {
    sourceIp: '5.188.86.172',
    countryCode: 'DE',
    country: 'Germany',
    flag: '🇩🇪',
    lat: 52.52,
    lng: 13.41,
    severity: 'Critical',
    score: 14,
    accumulatedScore: 16,
    matchedRules: ['RCE Attempt', 'Zero-Day Exploit', 'Root Escalation', 'Backdoor Install'],
    decision: 'BLOCK',
    action: 'THREAT_BLOCKED',
  },
  {
    sourceIp: '221.194.44.238',
    countryCode: 'KR',
    country: 'South Korea',
    flag: '🇰🇷',
    lat: 37.57,
    lng: 126.98,
    severity: 'High',
    score: 9,
    accumulatedScore: 11,
    matchedRules: ['CSRF Probe', 'File Inclusion', 'Session Hijack'],
    decision: 'BLOCK',
    action: 'THREAT_BLOCKED',
  },
  {
    sourceIp: '193.32.162.89',
    countryCode: 'UA',
    country: 'Ukraine',
    flag: '🇺🇦',
    lat: 50.45,
    lng: 30.52,
    severity: 'Medium',
    score: 6,
    accumulatedScore: 6,
    matchedRules: ['Credential Stuffing'],
    decision: 'LOG',
    action: 'THREAT_LOGGED',
  },
  {
    sourceIp: '45.14.13.108',
    countryCode: 'BR',
    country: 'Brazil',
    flag: '🇧🇷',
    lat: -23.55,
    lng: -46.63,
    severity: 'Low',
    score: 3,
    accumulatedScore: 4,
    matchedRules: ['Slow HTTP Attack'],
    decision: 'LOG',
    action: 'THREAT_LOGGED',
  },
];

// ─── Seed Function ────────────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Starting Mini-SIEM database seed...\n');

  // 1. Upsert Organization
  console.log('📦 Seeding organization...');
  const org = await prisma.organization.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: 'XR Security Demo' },
  });
  console.log(`   ✓ Organization: ${org.name} (id: ${org.id})`);

  // 2. Upsert Demo Admin
  console.log('\n👤 Seeding demo admin...');
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@xrsecurity.com' },
    update: { isVerified: true },
    create: {
      email: 'admin@xrsecurity.com',
      password: hashedPassword,
      isVerified: true,
      organizationId: org.id,
    },
  });
  console.log(`   ✓ Admin: ${admin.email} (id: ${admin.id})`);

  // 3. Upsert AdminConfig
  console.log('\n⚙️  Seeding admin config...');
  await prisma.adminConfig.upsert({
    where: { adminId: admin.id },
    update: {},
    create: {
      adminId: admin.id,
      blockThreshold: 12,
      alertThreshold: 7,
      scoreWindowMinutes: 10,
      telegramEnabled: false,
    },
  });
  console.log(`   ✓ AdminConfig created (blockThreshold: 12, alertThreshold: 7)`);

  // 4. Seed SecurityLogs (spread over last 24 hours)
  console.log('\n📋 Seeding security logs...');
  const now = new Date();
  const createdLogs: number[] = [];

  for (let i = 0; i < SAMPLE_THREATS.length; i++) {
    const threat = SAMPLE_THREATS[i];
    const hoursAgo = i * 2.2; // spread over ~22 hours
    const timestamp = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

    // Generate a unique fingerprint
    const fingerprint = crypto
      .createHash('md5')
      .update(threat.sourceIp + threat.action + timestamp.toISOString())
      .digest('hex');

    const log = await prisma.securityLog.create({
      data: {
        timestamp,
        level: threat.decision === 'BLOCK' ? 'CRITICAL' : threat.decision === 'ALERT' ? 'HIGH' : 'INFO',
        sourceIp: threat.sourceIp,
        action: threat.action,
        badgeText: threat.decision,
        badgeColor: threat.decision === 'BLOCK' ? '#ef4444' : threat.decision === 'ALERT' ? '#f59e0b' : '#64748b',
        userIdentity: `attacker-${i + 1}`,
        fingerprint,
        countryCode: threat.countryCode,
        country: threat.country,
        flag: threat.flag,
        source: 'crowdsec',
        adminId: admin.id,
        isBlocked: threat.decision === 'BLOCK',
        severity: threat.severity,
        score: threat.score,
        accumulatedScore: threat.accumulatedScore,
        matchedRules: JSON.stringify(threat.matchedRules),
        decision: threat.decision,
      },
    });
    createdLogs.push(log.id);
    console.log(
      `   ✓ Log [${i + 1}/${SAMPLE_THREATS.length}] ${threat.sourceIp} (${threat.severity}) → ${threat.decision}`
    );
  }

  // 5. Seed API Key
  console.log('\n🔑 Seeding API key...');
  const existingKey = await prisma.apiKey.findFirst({ where: { adminId: admin.id, isActive: 1 } });
  if (!existingKey) {
    const keyValue = 'msiem_' + crypto.randomBytes(24).toString('hex');
    const apiKey = await prisma.apiKey.create({
      data: { adminId: admin.id, keyValue, isActive: 1 },
    });
    console.log(`   ✓ API Key created: msiem_...${keyValue.slice(-4)} (id: ${apiKey.id})`);
  } else {
    console.log(`   ⚠ API Key already exists — skipping (Single Key Policy enforced)`);
  }

  console.log('\n✅ Seed completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - Organization: ${org.name}`);
  console.log(`   - Admin: admin@xrsecurity.com / admin123`);
  console.log(`   - SecurityLogs created: ${createdLogs.length}`);
  console.log(`   - Config: blockThreshold=12, alertThreshold=7`);

  await prisma.$disconnect();
  await pool.end();
}

seed().catch((e) => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});
