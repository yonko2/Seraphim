import { SensorReading } from '../../types';
import { FallDetectedCallback, SensorSubscription } from './types';
import { SensorManager } from './SensorManager';
import {
  FALL_DETECTION_THRESHOLD,
  FALL_STILLNESS_THRESHOLD,
  FALL_STILLNESS_DURATION,
} from '../../utils/constants';

type DetectionState = 'idle' | 'impact_detected' | 'monitoring_stillness';

export class FallDetector {
  private sensorManager: SensorManager;
  private callbacks: FallDetectedCallback[] = [];
  private readingSub: SensorSubscription | null = null;
  private running = false;

  private state: DetectionState = 'idle';
  private impactReading: SensorReading | null = null;
  private stillnessStart: number | null = null;
  private sensitivityMultiplier: number;

  constructor(sensorManager: SensorManager, sensitivity = 1.0) {
    this.sensorManager = sensorManager;
    this.sensitivityMultiplier = sensitivity;
  }

  setSensitivity(multiplier: number): void {
    this.sensitivityMultiplier = multiplier;
  }

  onFallDetected(callback: FallDetectedCallback): SensorSubscription {
    this.callbacks.push(callback);
    return {
      remove: () => {
        const idx = this.callbacks.indexOf(callback);
        if (idx !== -1) this.callbacks.splice(idx, 1);
      },
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.resetState();

    this.readingSub = this.sensorManager.onReading((reading) => {
      this.processReading(reading);
    });
  }

  stop(): void {
    this.running = false;
    this.readingSub?.remove();
    this.readingSub = null;
    this.resetState();
  }

  isRunning(): boolean {
    return this.running;
  }

  private resetState(): void {
    this.state = 'idle';
    this.impactReading = null;
    this.stillnessStart = null;
  }

  private get effectiveThreshold(): number {
    // Lower multiplier = more sensitive (lower threshold)
    return FALL_DETECTION_THRESHOLD / this.sensitivityMultiplier;
  }

  private processReading(reading: SensorReading): void {
    if (!reading.accelerometer) return;

    const { x, y, z } = reading.accelerometer;
    const magnitude = Math.sqrt(x * x + y * y + z * z);

    switch (this.state) {
      case 'idle':
        if (magnitude > this.effectiveThreshold) {
          this.state = 'impact_detected';
          this.impactReading = reading;
          this.stillnessStart = null;
        }
        break;

      case 'impact_detected':
      case 'monitoring_stillness':
        if (magnitude < FALL_STILLNESS_THRESHOLD) {
          if (this.stillnessStart === null) {
            this.stillnessStart = reading.timestamp;
            this.state = 'monitoring_stillness';
          } else if (reading.timestamp - this.stillnessStart >= FALL_STILLNESS_DURATION) {
            this.triggerFallDetected();
          }
        } else if (magnitude > this.effectiveThreshold) {
          // New impact — restart detection with latest reading
          this.impactReading = reading;
          this.stillnessStart = null;
          this.state = 'impact_detected';
        } else {
          // Movement detected but not a new impact — reset stillness timer
          this.stillnessStart = null;
          this.state = 'impact_detected';
        }
        break;
    }
  }

  private triggerFallDetected(): void {
    const reading = this.impactReading!;
    this.resetState();

    for (const cb of this.callbacks) {
      try {
        cb(reading);
      } catch {
        // Don't let a bad callback crash the detector
      }
    }
  }
}
