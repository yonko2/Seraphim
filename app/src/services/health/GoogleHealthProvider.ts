import { Platform } from 'react-native';
import { HealthData, HealthProvider } from '../../types';

// TODO: Install and import react-native-health-connect when ready for real Health Connect integration
// import { initialize, requestPermission, readRecords } from 'react-native-health-connect';

export class GoogleHealthProvider implements HealthProvider {
  name = 'Google Health Connect';

  private intervalId: ReturnType<typeof setInterval> | null = null;

  async isAvailable(): Promise<boolean> {
    // TODO: Also check Health Connect SDK availability once native module is configured
    // const isInitialized = await initialize();
    // return Platform.OS === 'android' && isInitialized;
    return Platform.OS === 'android';
  }

  async requestPermissions(): Promise<boolean> {
    // TODO: Replace with real Health Connect permission request:
    // await requestPermission([
    //   { accessType: 'read', recordType: 'HeartRate' },
    //   { accessType: 'read', recordType: 'OxygenSaturation' },
    //   { accessType: 'read', recordType: 'BloodGlucose' },
    //   { accessType: 'read', recordType: 'Steps' },
    // ]);
    return true;
  }

  async getHealthData(): Promise<HealthData> {
    // TODO: Replace with real Health Connect queries:
    // const heartRateRecords = await readRecords('HeartRate', {
    //   timeRangeFilter: { operator: 'after', startTime: ... },
    // });
    return this.generateMockData();
  }

  async startMonitoring(callback: (data: HealthData) => void): Promise<void> {
    // TODO: Replace with Health Connect change listeners or polling via readRecords
    this.stopMonitoringSync();
    this.intervalId = setInterval(() => {
      callback(this.generateMockData());
    }, 5000);
  }

  async stopMonitoring(): Promise<void> {
    this.stopMonitoringSync();
  }

  private stopMonitoringSync(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private generateMockData(): HealthData {
    return {
      heartRate: 70 + Math.floor(Math.random() * 14),
      bloodOxygen: 95 + Math.floor(Math.random() * 5),
      bloodGlucose: 80 + Math.floor(Math.random() * 30),
      stepCount: 2500 + Math.floor(Math.random() * 6000),
      lastUpdated: Date.now(),
    };
  }
}
