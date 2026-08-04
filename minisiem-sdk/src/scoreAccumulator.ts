/**
 * Mini-SIEM Score Accumulator v2.0
 *
 * Mengakumulasi skor deteksi per IP dalam jendela waktu (time window).
 * Inspirasi dari Wazuh Event Correlation — menggabungkan kejadian kecil
 * menjadi satu kesimpulan besar.
 *
 * Contoh:
 *   IP 192.168.1.1 dalam 5 menit terakhir:
 *     - /wp-admin (Level 4)
 *     - /phpmyadmin (Level 4)
 *     - User-Agent kosong (Level 3)
 *     → Total akumulasi: 11 → Melampaui threshold 10 → BLOCK + ALERT
 */

export interface ScoreEvent {
  ruleId: string;
  ruleName: string;
  level: number;
  timestamp: number;
}

interface IPScoreRecord {
  events: ScoreEvent[];
  windowStart: number;
}

export type ActionDecision = "LOG" | "ALERT" | "BLOCK";

export interface AccumulationResult {
  currentScore: number;
  eventCount: number;
  action: ActionDecision;
  events: ScoreEvent[];
}

// In-memory store: IP → score record
const scoreStore = new Map<string, IPScoreRecord>();

// Default configuration
const DEFAULT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_ALERT_THRESHOLD = 7;
const DEFAULT_BLOCK_THRESHOLD = 10;

export interface AccumulatorConfig {
  windowMs?: number;
  alertThreshold?: number;
  blockThreshold?: number;
}

let config: Required<AccumulatorConfig> = {
  windowMs: DEFAULT_WINDOW_MS,
  alertThreshold: DEFAULT_ALERT_THRESHOLD,
  blockThreshold: DEFAULT_BLOCK_THRESHOLD,
};

/**
 * Update accumulator configuration.
 * Called once during SDK initialization with values from the dashboard.
 */
export function configureAccumulator(newConfig: AccumulatorConfig) {
  config = {
    windowMs: newConfig.windowMs ?? DEFAULT_WINDOW_MS,
    alertThreshold: newConfig.alertThreshold ?? DEFAULT_ALERT_THRESHOLD,
    blockThreshold: newConfig.blockThreshold ?? DEFAULT_BLOCK_THRESHOLD,
  };
}

/**
 * Add detection events to an IP's score accumulator.
 * Returns the accumulated result with the decision (LOG/ALERT/BLOCK).
 */
export function accumulateScore(
  ip: string,
  newEvents: ScoreEvent[]
): AccumulationResult {
  const now = Date.now();
  let record = scoreStore.get(ip);

  // If no record or window expired, start fresh
  if (!record || now - record.windowStart > config.windowMs) {
    record = {
      events: [],
      windowStart: now,
    };
    scoreStore.set(ip, record);
  }

  // Prune events that fell outside the window
  record.events = record.events.filter(
    (e) => now - e.timestamp <= config.windowMs
  );

  // Add new events
  for (const event of newEvents) {
    record.events.push({
      ...event,
      timestamp: now,
    });
  }

  // Calculate total score
  const currentScore = record.events.reduce((sum, e) => sum + e.level, 0);

  // Determine action based on thresholds
  let action: ActionDecision;
  if (currentScore >= config.blockThreshold) {
    action = "BLOCK";
  } else if (currentScore >= config.alertThreshold) {
    action = "ALERT";
  } else {
    action = "LOG";
  }

  return {
    currentScore,
    eventCount: record.events.length,
    action,
    events: [...record.events],
  };
}

/**
 * Get the current accumulated score for an IP without adding events.
 */
export function getAccumulatedScore(ip: string): number {
  const now = Date.now();
  const record = scoreStore.get(ip);

  if (!record || now - record.windowStart > config.windowMs) {
    return 0;
  }

  // Prune expired events
  const activeEvents = record.events.filter(
    (e) => now - e.timestamp <= config.windowMs
  );

  return activeEvents.reduce((sum, e) => sum + e.level, 0);
}

/**
 * Clean up expired entries to prevent memory leaks.
 * Should be called periodically (e.g., every 60 seconds).
 */
export function cleanupScoreStore() {
  const now = Date.now();
  for (const [ip, record] of scoreStore.entries()) {
    if (now - record.windowStart > config.windowMs) {
      scoreStore.delete(ip);
    }
  }
}

/**
 * Get current thresholds (for logging/debugging).
 */
export function getThresholds() {
  return {
    alertThreshold: config.alertThreshold,
    blockThreshold: config.blockThreshold,
    windowMs: config.windowMs,
  };
}
