import { create } from 'zustand';
import { AppState, SensorReading, HealthData, DisasterClassification, EmergencyReport, AppMode } from '../types';

export const useStore = create<AppState>((set) => ({
  mode: 'victim',
  isMonitoring: false,
  currentSensorData: null,
  currentHealthData: null,
  lastClassification: null,
  activeEmergency: null,
  backendUrl: 'http://localhost:8000',
  operatorTelegramId: '',
  geminiApiKey: '',
  detectionSensitivity: 0.7,
  setMode: (mode: AppMode) => set({ mode }),
  setMonitoring: (isMonitoring: boolean) => set({ isMonitoring }),
  setSensorData: (currentSensorData: SensorReading) => set({ currentSensorData }),
  setHealthData: (currentHealthData: HealthData) => set({ currentHealthData }),
  setClassification: (lastClassification: DisasterClassification) => set({ lastClassification }),
  setActiveEmergency: (activeEmergency: EmergencyReport | null) => set({ activeEmergency }),
  updateSettings: (settings) => set((state) => ({ ...state, ...settings })),
}));
