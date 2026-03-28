import type { EmergencyReport } from '../../types';
import { BackendClient } from '../api/BackendClient';
import type { ReportGenerator } from './ReportGenerator';

interface EmergencyManagerConfig {
  reportGenerator: ReportGenerator;
  backendUrl: string;
}

export class EmergencyManager {
  private reportGenerator: ReportGenerator;
  private client: BackendClient;

  constructor(config: EmergencyManagerConfig) {
    this.reportGenerator = config.reportGenerator;
    this.client = new BackendClient(config.backendUrl);
  }

  async triggerEmergency(report: EmergencyReport): Promise<void> {
    try {
      await this.client.post('/emergency', {
        id: report.id,
        timestamp: report.timestamp,
        location: report.location,
        emergencyType: report.emergencyType,
        severity: report.severity,
        objectiveDescription: report.objectiveDescription,
        recommendedActions: report.recommendedActions,
        healthData: report.healthData,
        sensorData: report.sensorData.slice(-10), // Send only recent readings
      });
    } catch (error) {
      console.error('[EmergencyManager] Failed to send emergency report:', error);
      throw error;
    }
  }

  async getCallStatus(callId: string): Promise<any> {
    try {
      return await this.client.get(`/status/${callId}`);
    } catch (error) {
      console.error('[EmergencyManager] Failed to get call status:', error);
      throw error;
    }
  }

  async testCall(): Promise<any> {
    try {
      return await this.client.post('/test-call', {});
    } catch (error) {
      console.error('[EmergencyManager] Test call failed:', error);
      throw error;
    }
  }

  cancelEmergency(): void {
    // Cleanup: nothing persistent to tear down in this implementation.
    // Future: cancel pending network requests, stop polling, etc.
    console.log('[EmergencyManager] Emergency cancelled.');
  }
}
