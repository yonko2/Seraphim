import { Accelerometer, Gyroscope, Barometer } from 'expo-sensors';
import { SensorReading } from '../../types';
import { SensorConfig, SensorEventCallback, SensorSubscription } from './types';
import { SENSOR_UPDATE_INTERVAL, MAX_SENSOR_HISTORY } from '../../utils/constants';

type ProviderFn = (callback: (data: Partial<SensorReading>) => void) => SensorSubscription;

const DEFAULT_CONFIG: SensorConfig = {
  updateInterval: SENSOR_UPDATE_INTERVAL,
  enableAccelerometer: true,
  enableGyroscope: true,
  enableBarometer: true,
};

export class SensorManager {
  private config: SensorConfig;
  private subscriptions: SensorSubscription[] = [];
  private callbacks: SensorEventCallback[] = [];
  private history: SensorReading[] = [];
  private running = false;

  private latestAccel: { x: number; y: number; z: number } | undefined;
  private latestGyro: { x: number; y: number; z: number } | undefined;
  private latestBaro: { pressure: number } | undefined;

  private providers: Map<string, ProviderFn> = new Map();
  private providerSubscriptions: SensorSubscription[] = [];

  constructor(config?: Partial<SensorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  addProvider(name: string, providerFn: ProviderFn): void {
    this.providers.set(name, providerFn);

    // If already running, subscribe to the new provider immediately
    if (this.running) {
      const sub = providerFn((data) => this.handleProviderData(data));
      this.providerSubscriptions.push(sub);
    }
  }

  onReading(callback: SensorEventCallback): SensorSubscription {
    this.callbacks.push(callback);
    return {
      remove: () => {
        const idx = this.callbacks.indexOf(callback);
        if (idx !== -1) this.callbacks.splice(idx, 1);
      },
    };
  }

  getHistory(): SensorReading[] {
    return [...this.history];
  }

  getLatestReading(): SensorReading | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  isRunning(): boolean {
    return this.running;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    if (this.config.enableAccelerometer) {
      await this.startAccelerometer();
    }
    if (this.config.enableGyroscope) {
      await this.startGyroscope();
    }
    if (this.config.enableBarometer) {
      await this.startBarometer();
    }

    // Start external providers
    for (const providerFn of this.providers.values()) {
      try {
        const sub = providerFn((data) => this.handleProviderData(data));
        this.providerSubscriptions.push(sub);
      } catch {
        // Provider unavailable — skip silently
      }
    }
  }

  stop(): void {
    this.running = false;

    for (const sub of this.subscriptions) {
      sub.remove();
    }
    this.subscriptions = [];

    for (const sub of this.providerSubscriptions) {
      sub.remove();
    }
    this.providerSubscriptions = [];

    this.latestAccel = undefined;
    this.latestGyro = undefined;
    this.latestBaro = undefined;
  }

  private async startAccelerometer(): Promise<void> {
    try {
      const available = await Accelerometer.isAvailableAsync();
      if (!available) return;

      Accelerometer.setUpdateInterval(this.config.updateInterval);

      const sub = Accelerometer.addListener((data) => {
        this.latestAccel = data;
        this.emitReading();
      });
      this.subscriptions.push(sub);
    } catch {
      // Sensor not available on this device
    }
  }

  private async startGyroscope(): Promise<void> {
    try {
      const available = await Gyroscope.isAvailableAsync();
      if (!available) return;

      Gyroscope.setUpdateInterval(this.config.updateInterval);

      const sub = Gyroscope.addListener((data) => {
        this.latestGyro = data;
      });
      this.subscriptions.push(sub);
    } catch {
      // Sensor not available on this device
    }
  }

  private async startBarometer(): Promise<void> {
    try {
      const available = await Barometer.isAvailableAsync();
      if (!available) return;

      Barometer.setUpdateInterval(this.config.updateInterval);

      const sub = Barometer.addListener((data) => {
        this.latestBaro = { pressure: data.pressure };
      });
      this.subscriptions.push(sub);
    } catch {
      // Sensor not available on this device
    }
  }

  private emitReading(): void {
    const reading: SensorReading = {
      timestamp: Date.now(),
      accelerometer: this.latestAccel,
      gyroscope: this.latestGyro,
      barometer: this.latestBaro,
    };

    this.pushToHistory(reading);
    this.notifyCallbacks(reading);
  }

  private handleProviderData(data: Partial<SensorReading>): void {
    const reading: SensorReading = {
      timestamp: Date.now(),
      accelerometer: data.accelerometer ?? this.latestAccel,
      gyroscope: data.gyroscope ?? this.latestGyro,
      barometer: data.barometer ?? this.latestBaro,
    };

    if (data.accelerometer) this.latestAccel = data.accelerometer;
    if (data.gyroscope) this.latestGyro = data.gyroscope;
    if (data.barometer) this.latestBaro = data.barometer;

    this.pushToHistory(reading);
    this.notifyCallbacks(reading);
  }

  private pushToHistory(reading: SensorReading): void {
    this.history.push(reading);
    if (this.history.length > MAX_SENSOR_HISTORY) {
      this.history = this.history.slice(-MAX_SENSOR_HISTORY);
    }
  }

  private notifyCallbacks(reading: SensorReading): void {
    for (const cb of this.callbacks) {
      try {
        cb(reading);
      } catch {
        // Don't let a bad callback crash the sensor pipeline
      }
    }
  }
}
