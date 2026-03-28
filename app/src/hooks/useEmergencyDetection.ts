import { useEffect, useRef, useState, useCallback } from 'react';
import { useSensors } from './useSensors';
import { useHealthData } from './useHealthData';
import { useStore } from '../store/useStore';
import { GeminiService } from '../services/ai/GeminiService';
import { DisasterDetector } from '../services/ai/DisasterDetector';
import { ReportGenerator } from '../services/emergency/ReportGenerator';
import { EmergencyManager } from '../services/emergency/EmergencyManager';
import type { EmergencyReport, DisasterClassification } from '../types';

export function useEmergencyDetection() {
  const sensors = useSensors();
  const health = useHealthData();

  const backendUrl = useStore((s) => s.backendUrl);
  const activeEmergency = useStore((s) => s.activeEmergency);
  const setActiveEmergency = useStore((s) => s.setActiveEmergency);
  const setClassification = useStore((s) => s.setClassification);

  const [isMonitoring, setIsMonitoring] = useState(false);

  const geminiRef = useRef<GeminiService | null>(null);
  const detectorRef = useRef<DisasterDetector | null>(null);
  const reportGenRef = useRef<ReportGenerator | null>(null);
  const managerRef = useRef<EmergencyManager | null>(null);
  const processingRef = useRef(false);

  // Rebuild services when config changes
  useEffect(() => {
    if (!backendUrl) {
      geminiRef.current = null;
      detectorRef.current = null;
      reportGenRef.current = null;
      managerRef.current = null;
      return;
    }

    const gemini = new GeminiService(backendUrl);
    geminiRef.current = gemini;
    detectorRef.current = new DisasterDetector(gemini);
    reportGenRef.current = new ReportGenerator(gemini);
    managerRef.current = new EmergencyManager({
      reportGenerator: reportGenRef.current,
      backendUrl,
    });
  }, [backendUrl]);

  const handleEmergencyDetected = useCallback(
    async (classification: DisasterClassification) => {
      if (processingRef.current || activeEmergency) return;
      processingRef.current = true;

      try {
        setClassification(classification);

        const reportGen = reportGenRef.current;
        const manager = managerRef.current;
        if (!reportGen) return;

        const report = await reportGen.generateReport({
          sensorData: sensors.sensorHistory,
          healthData: health.healthData ?? undefined,
          classification,
          rawObservations: [classification.description],
        });

        setActiveEmergency(report);

        if (manager) {
          try {
            await manager.triggerEmergency(report);
          } catch (err) {
            console.warn('[useEmergencyDetection] Backend send failed:', err);
          }
        }
      } catch (error) {
        console.error('[useEmergencyDetection] Emergency handling failed:', error);
      } finally {
        processingRef.current = false;
      }
    },
    [activeEmergency, sensors.sensorHistory, health.healthData, setActiveEmergency, setClassification],
  );

  // Monitor fall detection
  useEffect(() => {
    if (!isMonitoring || !sensors.fallDetected) return;

    const fallClassification: DisasterClassification = {
      type: 'fall',
      severity: 'high',
      confidence: 0.8,
      description: 'Fall detected via accelerometer impact followed by stillness.',
      timestamp: Date.now(),
    };

    handleEmergencyDetected(fallClassification);
  }, [isMonitoring, sensors.fallDetected, handleEmergencyDetected]);

  // Wire up disaster detector emergency callbacks
  useEffect(() => {
    const detector = detectorRef.current;
    if (!detector || !isMonitoring) return;

    const unsubscribe = detector.onEmergencyConfirmed((classification) => {
      handleEmergencyDetected(classification);
    });

    return unsubscribe;
  }, [isMonitoring, handleEmergencyDetected]);

  const startMonitoring = useCallback(async () => {
    await sensors.startMonitoring();
    await health.startMonitoring();
    setIsMonitoring(true);
  }, [sensors, health]);

  const stopMonitoring = useCallback(() => {
    sensors.stopMonitoring();
    health.stopMonitoring();
    detectorRef.current?.stop();
    setIsMonitoring(false);
  }, [sensors, health]);

  const triggerManualEmergency = useCallback(async () => {
    const classification: DisasterClassification = {
      type: 'unknown',
      severity: 'critical',
      confidence: 1.0,
      description: 'Emergency manually triggered by user.',
      timestamp: Date.now(),
    };

    await handleEmergencyDetected(classification);
  }, [handleEmergencyDetected]);

  const cancelEmergency = useCallback(() => {
    managerRef.current?.cancelEmergency();
    setActiveEmergency(null);
    processingRef.current = false;
  }, [setActiveEmergency]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      detectorRef.current?.stop();
    };
  }, []);

  return {
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    triggerManualEmergency,
    activeEmergency,
    cancelEmergency,
  };
}
