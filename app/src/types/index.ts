// Core type definitions for Seraphim

export type EmergencyType = 'fall' | 'fire' | 'flood' | 'car_crash' | 'medical' | 'violence' | 'unknown' | 'none';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'none';
export type AppMode = 'victim' | 'helper';

export interface SensorReading {
  timestamp: number;
  accelerometer?: { x: number; y: number; z: number };
  gyroscope?: { x: number; y: number; z: number };
  barometer?: { pressure: number };
}

export interface HealthData {
  heartRate?: number;
  bloodOxygen?: number;
  bloodGlucose?: number;
  stepCount?: number;
  lastUpdated: number;
}

export interface DisasterClassification {
  type: EmergencyType;
  severity: Severity;
  confidence: number;
  description: string;
  timestamp: number;
  instructions?: string[];
}

export interface EmergencyReport {
  id: string;
  timestamp: number;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    address?: string;
  };
  emergencyType: EmergencyType;
  severity: Severity;
  sensorData: SensorReading[];
  healthData?: HealthData;
  disasterClassification?: DisasterClassification;
  objectiveDescription: string;
  recommendedActions: string[];
  rawObservations: string[];
}

export interface HealthProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;
  getHealthData(): Promise<HealthData>;
  startMonitoring(callback: (data: HealthData) => void): Promise<void>;
  stopMonitoring(): Promise<void>;
}

export interface AppState {
  mode: AppMode;
  isMonitoring: boolean;
  currentSensorData: SensorReading | null;
  currentHealthData: HealthData | null;
  lastClassification: DisasterClassification | null;
  activeEmergency: EmergencyReport | null;
  backendUrl: string;
  operatorTelegramId: string;
  detectionSensitivity: number; // 0-1
  setMode: (mode: AppMode) => void;
  setMonitoring: (monitoring: boolean) => void;
  setSensorData: (data: SensorReading) => void;
  setHealthData: (data: HealthData) => void;
  setClassification: (classification: DisasterClassification) => void;
  setActiveEmergency: (report: EmergencyReport | null) => void;
  updateSettings: (settings: Partial<Pick<AppState, 'backendUrl' | 'operatorTelegramId' | 'detectionSensitivity'>>) => void;
}
