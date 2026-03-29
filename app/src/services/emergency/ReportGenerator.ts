import type { GeminiService } from '../ai/GeminiService';
import type {
  EmergencyReport,
  EmergencyType,
  Severity,
  SensorReading,
  HealthData,
  DisasterClassification,
} from '../../types';

interface GenerateReportParams {
  sensorData: SensorReading[];
  healthData?: HealthData;
  classification?: DisasterClassification;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    address?: string;
  };
  rawObservations?: string[];
}

export class ReportGenerator {
  private gemini: GeminiService;

  constructor(geminiService: GeminiService) {
    this.gemini = geminiService;
  }

  async generateReport(params: GenerateReportParams): Promise<EmergencyReport> {
    const {
      sensorData,
      healthData,
      classification,
      location,
      rawObservations = [],
    } = params;

    const id = Date.now().toString(36) + Math.random().toString(36);
    const emergencyType = this.determineEmergencyType(classification, sensorData);
    const severity = classification?.severity ?? this.estimateSeverity(sensorData);

    let objectiveDescription: string;
    let recommendedActions: string[];

    const effectiveClassification: DisasterClassification = classification ?? {
      type: emergencyType,
      severity,
      confidence: emergencyType === 'unknown' ? 0.3 : 0.5,
      description: `Emergency detected via ${classification ? 'AI classification' : 'sensor analysis'}`,
      timestamp: Date.now(),
    };

    try {
      const aiReport = await this.gemini.generateReport({
        sensorData,
        healthData: healthData ?? null,
        classification: effectiveClassification,
        rawObservations,
      });
      objectiveDescription = aiReport.objectiveDescription;
      recommendedActions = aiReport.recommendedActions;
    } catch (error) {
      console.warn('[ReportGenerator] Gemini failed, using fallback:', error);
      const fallback = this.generateFallbackReport(emergencyType, severity, sensorData, healthData);
      objectiveDescription = fallback.objectiveDescription;
      recommendedActions = fallback.recommendedActions;
    }

    return {
      id,
      timestamp: Date.now(),
      location,
      emergencyType,
      severity,
      sensorData,
      healthData,
      disasterClassification: effectiveClassification,
      objectiveDescription,
      recommendedActions,
      rawObservations,
    };
  }

  private determineEmergencyType(
    classification?: DisasterClassification,
    sensorData?: SensorReading[],
  ): EmergencyType {
    if (classification && classification.type !== 'none') {
      return classification.type;
    }

    if (sensorData && sensorData.length > 0) {
      const latest = sensorData[sensorData.length - 1];
      if (latest.accelerometer) {
        const { x, y, z } = latest.accelerometer;
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        if (magnitude > 25) return 'fall';
      }
    }

    return 'unknown';
  }

  private estimateSeverity(sensorData: SensorReading[]): Severity {
    if (!sensorData.length) return 'medium';

    const latest = sensorData[sensorData.length - 1];
    if (latest.accelerometer) {
      const { x, y, z } = latest.accelerometer;
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      if (magnitude > 40) return 'critical';
      if (magnitude > 30) return 'high';
      if (magnitude > 20) return 'medium';
    }

    return 'medium';
  }

  private generateFallbackReport(
    type: EmergencyType,
    severity: Severity,
    sensorData: SensorReading[],
    healthData?: HealthData,
  ): { objectiveDescription: string; recommendedActions: string[] } {
    const descriptions: Record<EmergencyType, string> = {
      fall: 'A possible fall has been detected based on accelerometer data showing sudden high-G impact followed by stillness.',
      fire: 'A fire emergency has been detected via visual analysis. Smoke or flames may be present.',
      flood: 'Flooding conditions detected in the immediate area. Water levels may be rising.',
      earthquake: 'Earthquake-like shaking detected. Structural hazards and secondary effects may be present.',
      car_crash: 'A vehicle collision has been detected. Impact sensors indicate significant force.',
      medical: 'A medical emergency has been reported. Vital signs may be abnormal.',
      violence: 'A violent incident has been detected in the area. Immediate danger may be present.',
      unknown: 'An emergency situation has been detected but the type could not be determined.',
      none: 'No emergency detected.',
    };

    const actions: Record<EmergencyType, string[]> = {
      fall: [
        'Do not move the person unless in immediate danger.',
        'Check for consciousness and breathing.',
        'Call emergency services immediately.',
        'Keep the person warm and still until help arrives.',
      ],
      fire: [
        'Evacuate the area immediately.',
        'Call fire services.',
        'Do not re-enter the building.',
        'Move to a safe assembly point.',
      ],
      flood: [
        'Move to higher ground immediately.',
        'Avoid walking through floodwater.',
        'Call emergency services.',
        'Stay away from power lines.',
      ],
      earthquake: [
        'Drop, cover, and hold on until shaking stops.',
        'Move away from windows and heavy objects.',
        'Once safe, check for injuries and hazards.',
        'Call emergency services if structural damage or injuries are present.',
      ],
      car_crash: [
        'Ensure scene safety before approaching.',
        'Call emergency services immediately.',
        'Do not move injured persons unless in danger.',
        'Control any visible bleeding with pressure.',
      ],
      medical: [
        'Call emergency services immediately.',
        'Check airway, breathing, and circulation.',
        'Provide first aid as trained.',
        'Keep the person calm and comfortable.',
      ],
      violence: [
        'Move to a safe location immediately.',
        'Call emergency services.',
        'Do not confront the aggressor.',
        'Help others evacuate if safe to do so.',
      ],
      unknown: [
        'Assess the situation carefully.',
        'Call emergency services.',
        'Move to a safe location.',
        'Wait for professional help.',
      ],
      none: ['No action required.'],
    };

    let description = descriptions[type];

    if (healthData) {
      const vitals: string[] = [];
      if (healthData.heartRate != null) vitals.push(`HR: ${healthData.heartRate} bpm`);
      if (healthData.bloodOxygen != null) vitals.push(`SpO2: ${healthData.bloodOxygen}%`);
      if (vitals.length) {
        description += ` Vital signs: ${vitals.join(', ')}.`;
      }
    }

    return {
      objectiveDescription: `[${severity.toUpperCase()}] ${description}`,
      recommendedActions: actions[type],
    };
  }
}
