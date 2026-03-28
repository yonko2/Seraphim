import { useEffect, useRef, useState, useCallback } from 'react';
import { SensorReading } from '../types';
import { SensorManager } from '../services/sensors/SensorManager';
import { FallDetector } from '../services/sensors/FallDetector';
import { useStore } from '../store/useStore';

export function useSensors() {
  const sensorManagerRef = useRef<SensorManager | null>(null);
  const fallDetectorRef = useRef<FallDetector | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [currentReading, setCurrentReading] = useState<SensorReading | null>(null);
  const [sensorHistory, setSensorHistory] = useState<SensorReading[]>([]);
  const [fallDetected, setFallDetected] = useState<SensorReading | null>(null);

  const setSensorData = useStore((s) => s.setSensorData);
  const detectionSensitivity = useStore((s) => s.detectionSensitivity);

  // Lazily create manager and detector once
  if (!sensorManagerRef.current) {
    sensorManagerRef.current = new SensorManager();
  }
  if (!fallDetectorRef.current) {
    fallDetectorRef.current = new FallDetector(
      sensorManagerRef.current,
      detectionSensitivity,
    );
  }

  // Keep sensitivity in sync with store
  useEffect(() => {
    fallDetectorRef.current?.setSensitivity(detectionSensitivity);
  }, [detectionSensitivity]);

  const startMonitoring = useCallback(async () => {
    const manager = sensorManagerRef.current!;
    const detector = fallDetectorRef.current!;

    if (manager.isRunning()) return;

    await manager.start();
    detector.start();
    setIsActive(true);
    setFallDetected(null);
  }, []);

  const stopMonitoring = useCallback(() => {
    const manager = sensorManagerRef.current!;
    const detector = fallDetectorRef.current!;

    detector.stop();
    manager.stop();
    setIsActive(false);
  }, []);

  // Wire up callbacks
  useEffect(() => {
    const manager = sensorManagerRef.current!;
    const detector = fallDetectorRef.current!;

    const readingSub = manager.onReading((reading) => {
      setCurrentReading(reading);
      setSensorData(reading);
      setSensorHistory(manager.getHistory());
    });

    const fallSub = detector.onFallDetected((reading) => {
      setFallDetected(reading);
    });

    return () => {
      readingSub.remove();
      fallSub.remove();
    };
  }, [setSensorData]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      fallDetectorRef.current?.stop();
      sensorManagerRef.current?.stop();
    };
  }, []);

  return {
    isActive,
    currentReading,
    sensorHistory,
    startMonitoring,
    stopMonitoring,
    fallDetected,
  };
}
