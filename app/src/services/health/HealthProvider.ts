import { HealthData, HealthProvider } from '../../types';

export class HealthProviderManager {
  private providers: HealthProvider[] = [];
  private monitoringCallbacks: Map<HealthProvider, () => void> = new Map();

  registerProvider(provider: HealthProvider): void {
    this.providers.push(provider);
  }

  async getAvailableProviders(): Promise<HealthProvider[]> {
    const results = await Promise.allSettled(
      this.providers.map(async (provider) => {
        const available = await provider.isAvailable();
        return available ? provider : null;
      }),
    );

    return results
      .filter(
        (r): r is PromiseFulfilledResult<HealthProvider> =>
          r.status === 'fulfilled' && r.value !== null,
      )
      .map((r) => r.value);
  }

  async getAggregatedHealthData(): Promise<HealthData> {
    const available = await this.getAvailableProviders();

    const aggregated: HealthData = { lastUpdated: 0 };

    const results = await Promise.allSettled(
      available.map((provider) => provider.getHealthData()),
    );

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;

      const data = result.value;
      if (data.heartRate !== undefined) aggregated.heartRate = data.heartRate;
      if (data.bloodOxygen !== undefined) aggregated.bloodOxygen = data.bloodOxygen;
      if (data.bloodGlucose !== undefined) aggregated.bloodGlucose = data.bloodGlucose;
      if (data.stepCount !== undefined) aggregated.stepCount = data.stepCount;
      if (data.lastUpdated > aggregated.lastUpdated) {
        aggregated.lastUpdated = data.lastUpdated;
      }
    }

    if (aggregated.lastUpdated === 0) {
      aggregated.lastUpdated = Date.now();
    }

    return aggregated;
  }

  async startMonitoring(callback: (data: HealthData) => void): Promise<void> {
    const available = await this.getAvailableProviders();

    const startResults = await Promise.allSettled(
      available.map(async (provider) => {
        await provider.requestPermissions();
        await provider.startMonitoring(callback);
        return provider;
      }),
    );

    for (const result of startResults) {
      if (result.status === 'rejected') {
        console.warn('[HealthProviderManager] Provider failed to start:', result.reason);
      }
    }
  }

  async stopMonitoring(): Promise<void> {
    const results = await Promise.allSettled(
      this.providers.map((provider) => provider.stopMonitoring()),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        console.warn('[HealthProviderManager] Provider failed to stop:', result.reason);
      }
    }

    this.monitoringCallbacks.clear();
  }
}
