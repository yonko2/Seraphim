import {
  GoogleGenerativeAI,
  GenerativeModel,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';
import type {
  DisasterClassification,
  EmergencyType,
  SensorReading,
  HealthData,
} from '../../types';

const MAX_REQUESTS_PER_MINUTE = 14;
const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 1000;

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

export class GeminiService {
  private model: GenerativeModel;
  private requestTimestamps: number[] = [];

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-lite',
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    });
  }

  // ── Rate Limiter ──────────────────────────────────────────────────────

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      (t) => now - t < 60_000,
    );

    if (this.requestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
      const oldest = this.requestTimestamps[0];
      const waitMs = 60_000 - (now - oldest) + 100; // +100ms safety margin
      await this.sleep(waitMs);
    }

    this.requestTimestamps.push(Date.now());
  }

  // ── Retry wrapper ─────────────────────────────────────────────────────

  private async callWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.waitForRateLimit();
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < MAX_RETRIES) {
          const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt);
          console.warn(
            `[GeminiService] Attempt ${attempt + 1} failed, retrying in ${backoff}ms…`,
            error,
          );
          await this.sleep(backoff);
        }
      }
    }

    throw lastError;
  }

  // ── Public API ────────────────────────────────────────────────────────

  async classifyImage(base64Image: string): Promise<DisasterClassification> {
    const prompt = [
      'You are an emergency detection AI. Analyze this image and determine if there is an emergency situation.',
      'Respond ONLY with valid JSON in this exact format (no markdown, no backticks):',
      '{"type":"fire|flood|fall|car_crash|medical|violence|none","severity":"critical|high|medium|low|none","confidence":0.0,"description":"brief objective description"}',
    ].join(' ');

    const result = await this.callWithRetry(() =>
      this.model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image,
          },
        },
      ]),
    );

    const text = result.response.text().trim();
    const parsed = this.parseJSON<{
      type: EmergencyType;
      severity: string;
      confidence: number;
      description: string;
    }>(text);

    return {
      type: this.validateEmergencyType(parsed.type),
      severity: this.validateSeverity(parsed.severity),
      confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0)),
      description: parsed.description ?? 'No description provided',
      timestamp: Date.now(),
    };
  }

  async filterPanic(rawText: string): Promise<string> {
    const prompt = [
      'You are an emergency dispatcher AI.',
      'Rewrite the following observations in a calm, objective, clinical tone.',
      'Remove emotional language, speculation, and panic. Focus only on facts.',
      'Return ONLY the rewritten text with no extra commentary.\n\n',
      rawText,
    ].join(' ');

    const result = await this.callWithRetry(() =>
      this.model.generateContent(prompt),
    );

    return result.response.text().trim();
  }

  async getFirstAidGuidance(
    emergencyType: EmergencyType,
    description: string,
  ): Promise<string[]> {
    const prompt = [
      'You are a certified first aid instructor.',
      `Given a "${emergencyType}" emergency with this description: "${description}",`,
      'provide 5-8 clear, actionable first aid steps a bystander should take.',
      'Respond ONLY with a valid JSON array of strings (no markdown, no backticks).',
      'Example: ["Step 1…","Step 2…"]',
    ].join(' ');

    const result = await this.callWithRetry(() =>
      this.model.generateContent(prompt),
    );

    const text = result.response.text().trim();
    const steps = this.parseJSON<string[]>(text);

    if (!Array.isArray(steps) || steps.length === 0) {
      return ['Ensure scene safety.', 'Call emergency services immediately.'];
    }

    return steps;
  }

  async generateReport(data: GenerateReportInput): Promise<GenerateReportOutput> {
    const sensorSummary = this.summariseSensorData(data.sensorData);
    const healthSummary = this.summariseHealthData(data.healthData);

    const prompt = [
      'You are an emergency report AI. Given the following data, produce a structured emergency report.',
      `\n\nClassification: ${data.classification.type} (${data.classification.severity}), confidence ${data.classification.confidence}`,
      `Description: ${data.classification.description}`,
      `\n\nSensor data summary: ${sensorSummary}`,
      `\nHealth data: ${healthSummary}`,
      `\nRaw observations:\n${data.rawObservations.join('\n')}`,
      '\n\nRespond ONLY with valid JSON (no markdown, no backticks):',
      '{"objectiveDescription":"...", "recommendedActions":["action1","action2"]}',
    ].join(' ');

    const result = await this.callWithRetry(() =>
      this.model.generateContent(prompt),
    );

    const text = result.response.text().trim();
    const parsed = this.parseJSON<GenerateReportOutput>(text);

    return {
      objectiveDescription:
        parsed.objectiveDescription ?? 'Unable to generate description.',
      recommendedActions: Array.isArray(parsed.recommendedActions)
        ? parsed.recommendedActions
        : ['Contact emergency services.'],
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private parseJSON<T>(raw: string): T {
    // Strip markdown code fences if Gemini wraps the response
    let cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    // Also handle stray trailing commas before closing braces/brackets
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

    try {
      return JSON.parse(cleaned) as T;
    } catch {
      throw new Error(`[GeminiService] Failed to parse JSON response: ${raw}`);
    }
  }

  private validateEmergencyType(value: string): EmergencyType {
    const valid: EmergencyType[] = [
      'fall', 'fire', 'flood', 'car_crash', 'medical', 'violence', 'unknown', 'none',
    ];
    return valid.includes(value as EmergencyType) ? (value as EmergencyType) : 'unknown';
  }

  private validateSeverity(value: string): DisasterClassification['severity'] {
    const valid = ['critical', 'high', 'medium', 'low', 'none'] as const;
    type S = (typeof valid)[number];
    return valid.includes(value as S) ? (value as S) : 'medium';
  }

  private summariseSensorData(readings: SensorReading[]): string {
    if (!readings.length) return 'No sensor data available.';

    const latest = readings[readings.length - 1];
    const parts: string[] = [];

    if (latest.accelerometer) {
      const { x, y, z } = latest.accelerometer;
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      parts.push(`Accelerometer magnitude: ${magnitude.toFixed(2)} m/s²`);
    }
    if (latest.gyroscope) {
      const { x, y, z } = latest.gyroscope;
      parts.push(`Gyroscope: x=${x.toFixed(2)} y=${y.toFixed(2)} z=${z.toFixed(2)}`);
    }
    if (latest.barometer) {
      parts.push(`Barometric pressure: ${latest.barometer.pressure.toFixed(1)} hPa`);
    }

    return parts.length ? parts.join('; ') : 'Sensor data present but empty.';
  }

  private summariseHealthData(health: HealthData | null): string {
    if (!health) return 'No health data available.';

    const parts: string[] = [];
    if (health.heartRate != null) parts.push(`HR: ${health.heartRate} bpm`);
    if (health.bloodOxygen != null) parts.push(`SpO2: ${health.bloodOxygen}%`);
    if (health.bloodGlucose != null) parts.push(`Glucose: ${health.bloodGlucose} mg/dL`);
    if (health.stepCount != null) parts.push(`Steps: ${health.stepCount}`);

    return parts.length ? parts.join('; ') : 'Health data present but empty.';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
