import { create } from 'zustand';
import { AppState, SensorReading, HealthData, DisasterClassification, EmergencyReport, AppMode, UserProfile } from '../types';

export const useStore = create<AppState>((set) => ({
  mode: 'victim',
  isMonitoring: false,
  currentSensorData: null,
  currentHealthData: null,
  lastClassification: null,
  activeEmergency: null,
  backendUrl: 'https://dreamful-amiya-mostly.ngrok-free.dev',
  operatorTelegramId: 'Bayryamcho',
  detectionSensitivity: 0.7,
  garminConnected: false,
  garminDisplayName: null,
  collapseMonitoring: false,
  userProfile: {
    name: '',
    age: '',
    bloodType: '',
    conditions: [],
    allergies: [],
    medications: [],
    emergencyContact: '',
    notes: '',
  },
  setMode: (mode: AppMode) => set({ mode }),
  setMonitoring: (isMonitoring: boolean) => set({ isMonitoring }),
  setSensorData: (currentSensorData: SensorReading) => set({ currentSensorData }),
  setHealthData: (currentHealthData: HealthData) => set({ currentHealthData }),
  setClassification: (lastClassification: DisasterClassification) => set({ lastClassification }),
  setActiveEmergency: (activeEmergency: EmergencyReport | null) => set({ activeEmergency }),
  setGarminConnected: (connected: boolean, displayName?: string | null) =>
    set({ garminConnected: connected, garminDisplayName: displayName ?? null }),
  setCollapseMonitoring: (collapseMonitoring: boolean) => set({ collapseMonitoring }),
  setUserProfile: (partial: Partial<UserProfile>) =>
    set((state) => ({ userProfile: { ...state.userProfile, ...partial } })),
  updateSettings: (settings) => set((state) => ({ ...state, ...settings })),
}));
