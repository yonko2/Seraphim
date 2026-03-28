import { HealthData, HealthProvider } from '../../types';
import { useStore } from '../../store/useStore';

const API_BASE_URL = 'http://localhost:8000'; // Will be configurable via store

interface GarminAuthResponse {
  success: boolean;
  message: string;
  profile?: {
    displayName: string;
    fullName: string;
    profileImage?: string;
  };
}

interface GarminHealthDataResponse {
  heartRate?: number;
  bloodOxygen?: number;
  stepCount?: number;
  lastUpdated: number;
  source: string;
  date: string;
  bodyBattery?: number;
  stressLevel?: number;
  sleepScore?: number;
}

interface GarminStatusResponse {
  available: boolean;
  authenticated: boolean;
  email?: string;
}

/**
 * Garmin Health Provider - Fetches health data from Garmin Connect via backend API
 * 
 * This provider connects to a Python backend that uses python-garminconnect
 * to fetch health data from Garmin Connect.
 */
export class GarminHealthProvider implements HealthProvider {
  name = 'Garmin Connect';
  private backendUrl: string;
  private isAuthenticated = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private email: string | null = null;

  constructor(backendUrl?: string) {
    this.backendUrl = backendUrl || API_BASE_URL;
  }

  /**
   * Check if Garmin service is available on the backend
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.backendUrl}/garmin/status`);
      if (!response.ok) return false;
      
      const status: GarminStatusResponse = await response.json();
      this.isAuthenticated = status.authenticated;
      this.email = status.email || null;
      return status.available;
    } catch (error) {
      console.warn('[GarminHealthProvider] Backend not available:', error);
      return false;
    }
  }

  /**
   * Request authentication - returns true if already authenticated or has tokens
   */
  async requestPermissions(): Promise<boolean> {
    // Check if already authenticated
    if (this.isAuthenticated) {
      return true;
    }

    // Try to authenticate with stored tokens
    try {
      const response = await fetch(`${this.backendUrl}/garmin/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const result: GarminAuthResponse = await response.json();
        this.isAuthenticated = result.success;
        return result.success;
      }
    } catch (error) {
      console.warn('[GarminHealthProvider] Token auth failed:', error);
    }

    // Not authenticated - user needs to login via settings
    return false;
  }

  /**
   * Authenticate with email/password
   * This should be called from the settings screen
   */
  async authenticate(email: string, password: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.backendUrl}/garmin/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Authentication failed');
      }

      const result: GarminAuthResponse = await response.json();
      this.isAuthenticated = result.success;
      this.email = email;
      return result.success;
    } catch (error) {
      console.error('[GarminHealthProvider] Authentication failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Garmin
   */
  async disconnect(): Promise<boolean> {
    try {
      const response = await fetch(`${this.backendUrl}/garmin/disconnect`, {
        method: 'POST',
      });

      if (response.ok) {
        this.isAuthenticated = false;
        this.email = null;
        return true;
      }
      return false;
    } catch (error) {
      console.error('[GarminHealthProvider] Disconnect failed:', error);
      return false;
    }
  }

  /**
   * Get current health data from Garmin
   */
  async getHealthData(): Promise<HealthData> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated with Garmin Connect');
    }

    try {
      const response = await fetch(`${this.backendUrl}/garmin/health-data`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch health data');
      }

      const data: GarminHealthDataResponse = await response.json();

      return {
        heartRate: data.heartRate,
        bloodOxygen: data.bloodOxygen,
        stepCount: data.stepCount,
        lastUpdated: data.lastUpdated,
      };
    } catch (error) {
      console.error('[GarminHealthProvider] Failed to get health data:', error);
      throw error;
    }
  }

  /**
   * Start monitoring health data with periodic polling
   */
  async startMonitoring(callback: (data: HealthData) => void): Promise<void> {
    // Stop any existing monitoring
    await this.stopMonitoring();

    // Check authentication first
    if (!this.isAuthenticated) {
      const authed = await this.requestPermissions();
      if (!authed) {
        throw new Error('Not authenticated with Garmin Connect. Please login in settings.');
      }
    }

    // Initial fetch
    try {
      const data = await this.getHealthData();
      callback(data);
    } catch (error) {
      console.warn('[GarminHealthProvider] Initial fetch failed:', error);
    }

    // Poll every 5 minutes (Garmin data doesn't update in real-time)
    this.monitoringInterval = setInterval(async () => {
      try {
        const data = await this.getHealthData();
        callback(data);
      } catch (error) {
        console.warn('[GarminHealthProvider] Polling fetch failed:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Stop monitoring health data
   */
  async stopMonitoring(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Check if currently authenticated
   */
  getAuthenticated(): boolean {
    return this.isAuthenticated;
  }

  /**
   * Get connected email
   */
  getEmail(): string | null {
    return this.email;
  }
}
