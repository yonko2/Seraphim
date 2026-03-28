import { useEffect, useRef, useCallback, useState } from 'react';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import { useStore } from '../store/useStore';

const CHECK_INTERVAL_MS = 5000;
const SENSOR_SAMPLE_INTERVAL_MS = 100;

interface CollapseResult {
  collapsed: boolean;
  confidence: number;
  reason: string;
  health_data: any;
  details: any;
}

export function useCollapseMonitor() {
  const backendUrl = useStore((s) => s.backendUrl);
  const collapseMonitoring = useStore((s) => s.collapseMonitoring);

  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<CollapseResult | null>(null);
  const [collapseDetected, setCollapseDetected] = useState(false);
  const [liveAccel, setLiveAccel] = useState<{ x: number; y: number; z: number } | null>(null);
  const [liveGyro, setLiveGyro] = useState<{ x: number; y: number; z: number } | null>(null);

  const accelBuffer = useRef<{ x: number; y: number; z: number; timestamp: number }[]>([]);
  const gyroBuffer = useRef<{ x: number; y: number; z: number; timestamp: number }[]>([]);
  const accelSubRef = useRef<any>(null);
  const gyroSubRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startSensors = useCallback(() => {
    Accelerometer.setUpdateInterval(SENSOR_SAMPLE_INTERVAL_MS);
    Gyroscope.setUpdateInterval(SENSOR_SAMPLE_INTERVAL_MS);

    accelSubRef.current = Accelerometer.addListener((data) => {
      const sample = {
        x: data.x * 9.81,
        y: data.y * 9.81,
        z: data.z * 9.81,
        timestamp: Date.now() / 1000,
      };
      accelBuffer.current.push(sample);
      if (accelBuffer.current.length > 200) {
        accelBuffer.current = accelBuffer.current.slice(-200);
      }
      setLiveAccel({ x: data.x, y: data.y, z: data.z });
    });

    gyroSubRef.current = Gyroscope.addListener((data) => {
      gyroBuffer.current.push({
        x: data.x,
        y: data.y,
        z: data.z,
        timestamp: Date.now() / 1000,
      });
      if (gyroBuffer.current.length > 200) {
        gyroBuffer.current = gyroBuffer.current.slice(-200);
      }
      setLiveGyro({ x: data.x, y: data.y, z: data.z });
    });
  }, []);

  const stopSensors = useCallback(() => {
    if (accelSubRef.current) {
      accelSubRef.current.remove();
      accelSubRef.current = null;
    }
    if (gyroSubRef.current) {
      gyroSubRef.current.remove();
      gyroSubRef.current = null;
    }
    accelBuffer.current = [];
    gyroBuffer.current = [];
  }, []);

  const checkCollapse = useCallback(async () => {
    if (!backendUrl || accelBuffer.current.length === 0) return;

    const accelSamples = [...accelBuffer.current];
    const gyroSamples = [...gyroBuffer.current];

    try {
      const response = await fetch(`${backendUrl}/garmin/health-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accel_data: accelSamples,
          gyro_data: gyroSamples,
        }),
      });

      if (!response.ok) return;

      const result: CollapseResult = await response.json();
      setLastResult(result);

      if (result.collapsed) {
        console.warn('[CollapseMonitor] COLLAPSE DETECTED:', result.reason);
        setCollapseDetected(true);
      }
    } catch (err) {
      console.warn('[CollapseMonitor] Health check failed:', err);
    }
  }, [backendUrl]);

  useEffect(() => {
    if (collapseMonitoring && backendUrl) {
      startSensors();
      intervalRef.current = setInterval(checkCollapse, CHECK_INTERVAL_MS);
      setIsRunning(true);
      console.log('[CollapseMonitor] Started with accel + gyro');
    } else {
      stopSensors();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsRunning(false);
      setLiveAccel(null);
      setLiveGyro(null);
    }

    return () => {
      stopSensors();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [collapseMonitoring, backendUrl, startSensors, stopSensors, checkCollapse]);

  const clearCollapse = useCallback(() => {
    setCollapseDetected(false);
  }, []);

  return {
    isRunning,
    lastResult,
    collapseDetected,
    clearCollapse,
    liveAccel,
    liveGyro,
  };
}
