export interface SensorSubscription {
  remove: () => void;
}

export interface SensorConfig {
  updateInterval: number; // ms
  enableAccelerometer: boolean;
  enableGyroscope: boolean;
  enableBarometer: boolean;
}

export type SensorEventCallback = (reading: import('../../types').SensorReading) => void;
export type FallDetectedCallback = (reading: import('../../types').SensorReading) => void;
