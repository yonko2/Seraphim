import type { DisasterClassification } from '../../types';
import type { GeminiService } from './GeminiService';
import { RateLimitError } from './GeminiService';

const CAMERA_CAPTURE_INTERVAL = 5000; // ms
const CONSECUTIVE_THRESHOLD = 2;

type DetectionCallback = (classification: DisasterClassification) => void;
type EmergencyConfirmedCallback = (classification: DisasterClassification) => void;

export class DisasterDetector {
  private gemini: GeminiService;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private previousClassification: DisasterClassification | null = null;
  private consecutiveCount = 0;
  private detectionListeners: DetectionCallback[] = [];
  private emergencyListeners: EmergencyConfirmedCallback[] = [];
  private running = false;

  // Rate limit: minimum milliseconds between calls to Gemini (default: 60s)
  private cooldownMs: number;
  private lastRequestTs: number = 0;

  constructor(geminiService: GeminiService, cooldownMs: number = 60_000) {
    this.gemini = geminiService;
    this.cooldownMs = cooldownMs;
  }

  // ── Public API ────────────────────────────────────────────────────────

  async analyzeFrame(base64Image: string): Promise<DisasterClassification> {
    const now = Date.now();
    if (now - this.lastRequestTs < this.cooldownMs) {
      // Within cooldown: return previous classification if available to avoid extra API calls
      if (this.previousClassification) {
        return this.previousClassification;
      }
      // If no previous classification exists, return a safe "none" result
      return {
        type: 'none',
        severity: 'none',
        confidence: 0,
        description: 'Analysis skipped due to rate limit',
        timestamp: now,
      } as DisasterClassification;
    }

    this.lastRequestTs = now;
    try {
      const result = await this.gemini.classifyImage(base64Image);
      // Update previousClassification so future cooldown returns a sensible value
      this.previousClassification = result;
      return result;
    } catch (error) {
      if (error instanceof RateLimitError) {
        // Extend the cooldown by the server-specified retry delay so we don't
        // hammer the API again before the quota window resets.
        this.lastRequestTs = now + error.retryAfterMs - this.cooldownMs;
        console.warn(
          `[DisasterDetector] Rate limited — pausing analysis for ${error.retryAfterMs / 1000}s`,
        );
      }
      throw error;
    }
  }

  isEmergency(classification: DisasterClassification): boolean {
    return (
      classification.type !== 'none' &&
      classification.confidence >= 0.5 &&
      classification.severity !== 'none'
    );
  }

  start(captureCallback: () => Promise<string | null>): void {
    if (this.running) return;
    this.running = true;

    this.intervalId = setInterval(async () => {
      try {
        const frame = await captureCallback();
        if (!frame) return;

        const classification = await this.analyzeFrame(frame);
        this.emitDetection(classification);

        if (this.isEmergency(classification)) {
          this.updateConsecutiveDetections(classification);
        } else {
          this.resetConsecutive();
        }
      } catch (error) {
        console.warn('[DisasterDetector] Frame analysis failed:', error);
      }
    }, CAMERA_CAPTURE_INTERVAL);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
    this.resetConsecutive();
  }

  onDetection(callback: DetectionCallback): () => void {
    this.detectionListeners.push(callback);
    return () => {
      this.detectionListeners = this.detectionListeners.filter(
        (cb) => cb !== callback,
      );
    };
  }

  onEmergencyConfirmed(callback: EmergencyConfirmedCallback): () => void {
    this.emergencyListeners.push(callback);
    return () => {
      this.emergencyListeners = this.emergencyListeners.filter(
        (cb) => cb !== callback,
      );
    };
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private updateConsecutiveDetections(
    classification: DisasterClassification,
  ): void {
    if (
      this.previousClassification &&
      this.previousClassification.type === classification.type
    ) {
      this.consecutiveCount++;
    } else {
      this.consecutiveCount = 1;
    }

    this.previousClassification = classification;

    if (this.consecutiveCount >= CONSECUTIVE_THRESHOLD) {
      this.emitEmergencyConfirmed(classification);
      // Reset so we don't keep firing for the same ongoing event
      this.consecutiveCount = 0;
    }
  }

  private resetConsecutive(): void {
    this.previousClassification = null;
    this.consecutiveCount = 0;
  }

  private emitDetection(classification: DisasterClassification): void {
    for (const cb of this.detectionListeners) {
      try {
        cb(classification);
      } catch (e) {
        console.warn('[DisasterDetector] Detection listener error:', e);
      }
    }
  }

  private emitEmergencyConfirmed(classification: DisasterClassification): void {
    for (const cb of this.emergencyListeners) {
      try {
        cb(classification);
      } catch (e) {
        console.warn('[DisasterDetector] Emergency listener error:', e);
      }
    }
  }
}
