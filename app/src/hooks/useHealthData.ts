import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { HealthData, HealthProvider } from '../types';
import { HealthProviderManager } from '../services/health/HealthProvider';
import { AppleHealthProvider } from '../services/health/AppleHealthProvider';
import { GoogleHealthProvider } from '../services/health/GoogleHealthProvider';
import { GarminHealthProvider } from '../services/health/GarminHealthProvider';
import { useStore } from '../store/useStore';

export function useHealthData() {
  const managerRef = useRef<HealthProviderManager | null>(null);

  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [availableProviders, setAvailableProviders] = useState<HealthProvider[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setStoreHealthData = useStore((s) => s.setHealthData);
  const backendUrl = useStore((s) => s.backendUrl);

  if (!managerRef.current) {
    const manager = new HealthProviderManager();
    if (Platform.OS === 'ios') {
      manager.registerProvider(new AppleHealthProvider());
    } else if (Platform.OS === 'android') {
      manager.registerProvider(new GoogleHealthProvider());
    }
    // Register Garmin provider (works on both platforms via backend)
    manager.registerProvider(new GarminHealthProvider(backendUrl));
    managerRef.current = manager;
  }

  useEffect(() => {
    let mounted = true;
    managerRef.current?.getAvailableProviders().then((providers) => {
      if (mounted) setAvailableProviders(providers);
    });
    return () => { mounted = false; };
  }, []);

  const handleHealthUpdate = useCallback(
    (data: HealthData) => {
      setHealthData(data);
      setStoreHealthData(data);
    },
    [setStoreHealthData],
  );

  const startMonitoring = useCallback(async () => {
    try {
      setError(null);
      await managerRef.current?.startMonitoring(handleHealthUpdate);
      setIsMonitoring(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start health monitoring');
    }
  }, [handleHealthUpdate]);

  const stopMonitoring = useCallback(async () => {
    try {
      await managerRef.current?.stopMonitoring();
      setIsMonitoring(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop health monitoring');
    }
  }, []);

  useEffect(() => {
    return () => {
      managerRef.current?.stopMonitoring();
    };
  }, []);

  return {
    healthData,
    availableProviders,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    error,
  };
}
