import type {
  DisasterClassification,
  EmergencyType,
  SensorReading,
  HealthData,
} from '../../types';

interface GenerateReportInput {
  sensorData: SensorReading[];
  healthData: HealthData | null;
  classification: DisasterClassification;
  rawObservations: string[];
}

interface GenerateReportOutput {
  objectiveDescription: string;
  recommendedActions: string[];
}

interface ImageAnalysisResult {
  emergency: boolean;
  type: string;
  severity: string;
  confidence: number;
  title: string;
  description: string;
  icon: string;
  instructions: string[];
}

export class RateLimitError extends Error {
  retryAfterMs: number;
  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class GeminiService {
  private backendUrl: string;

  constructor(backendUrl: string) {
    this.backendUrl = backendUrl.replace(/\/+$/, '');
  }

  // ── Public API ────────────────────────────────────────────────────────

  async classifyImage(base64Image: string): Promise<DisasterClassification> {
    const response = await fetch(`${this.backendUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') ?? '60', 10);
        throw new RateLimitError(
          `[GeminiService] /api/analyze rate limited. Retry after ${retryAfter}s.`,
          retryAfter * 1000,
        );
      }
      throw new Error(`[GeminiService] /api/analyze failed (${response.status}): ${errorText}`);
    }

    const result: ImageAnalysisResult = await response.json();

    return {
      type: this.validateEmergencyType(result.type),
      severity: this.validateSeverity(result.severity),
      confidence: Math.max(0, Math.min(1, result.confidence / 100)),
      description: result.description,
      timestamp: Date.now(),
      instructions: result.instructions || [],
    };
  }

  async classifyVideo(frames: string[]): Promise<DisasterClassification> {
    const response = await fetch(`${this.backendUrl}/api/analyze-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frames }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`[GeminiService] /api/analyze-video failed (${response.status}): ${errorText}`);
    }

    const result: ImageAnalysisResult = await response.json();

    return {
      type: this.validateEmergencyType(result.type),
      severity: this.validateSeverity(result.severity),
      confidence: Math.max(0, Math.min(1, result.confidence / 100)),
      description: result.description,
      timestamp: Date.now(),
      instructions: result.instructions || [],
    };
  }

  async filterPanic(rawText: string): Promise<string> {
    try {
      const response = await fetch(`${this.backendUrl}/api/filter-panic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText }),
      });

      if (!response.ok) {
        throw new Error(`Filter panic failed (${response.status})`);
      }

      const result = await response.json();
      return result.filtered_text;
    } catch (error) {
      console.warn('[GeminiService] Panic filter unavailable, returning raw text:', error);
      return rawText;
    }
  }

  async getFirstAidGuidance(
    emergencyType: EmergencyType,
    description: string,
  ): Promise<string[]> {
    try {
      const response = await fetch(`${this.backendUrl}/api/first-aid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emergency_type: emergencyType,
          description,
        }),
      });

      if (!response.ok) {
        throw new Error(`First aid API failed (${response.status})`);
      }

      const result = await response.json();
      return result.steps;
    } catch (error) {
      console.warn('[GeminiService] First aid API unavailable, using fallback:', error);
      return [
        'Ensure scene safety before approaching.',
        'Check for responsiveness — tap and shout.',
        'Call emergency services (112) immediately.',
        'Provide first aid within your training level.',
        'Stay with the person until help arrives.',
      ];
    }
  }

  async generateReport(data: GenerateReportInput): Promise<GenerateReportOutput> {
    const firstAid = await this.getFirstAidGuidance(
      data.classification.type,
      data.classification.description,
    );

    return {
      objectiveDescription: data.classification.description,
      recommendedActions: [
        'Contact emergency services (112).',
        ...firstAid,
      ],
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private validateEmergencyType(value: string): EmergencyType {
    const valid: EmergencyType[] = [
      'fall', 'fire', 'flood', 'earthquake', 'car_crash', 'medical', 'violence', 'unknown', 'none',
    ];
    return valid.includes(value as EmergencyType) ? (value as EmergencyType) : 'unknown';
  }

  private validateSeverity(value: string): DisasterClassification['severity'] {
    const valid = ['critical', 'high', 'medium', 'low', 'none'] as const;
    type S = (typeof valid)[number];
    return valid.includes(value as S) ? (value as S) : 'medium';
  }
}
