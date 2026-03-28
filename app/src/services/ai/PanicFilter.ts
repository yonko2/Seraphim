import type { GeminiService } from './GeminiService';

const PANIC_PATTERNS: RegExp[] = [
  /oh\s*my\s*god/gi,
  /please\s*help/gi,
  /we'?re\s*(all\s*)?going\s*to\s*die/gi,
  /i('?m)?\s*(so\s*)?(terrified|scared|freaking\s*out|panicking)/gi,
  /this\s*is\s*(so\s*)?horrible/gi,
  /i\s*can'?t\s*believe/gi,
  /someone\s*do\s*something/gi,
  /no\s*no\s*no/gi,
  /!!+/g,
  /\?!+/g,
  /[A-Z]{5,}/g, // extended all-caps words
];

export class PanicFilter {
  private gemini: GeminiService;

  constructor(geminiService: GeminiService) {
    this.gemini = geminiService;
  }

  async filter(rawObservations: string[]): Promise<string> {
    if (!rawObservations.length) return '';

    const combined = rawObservations.join('\n');

    try {
      return await this.gemini.filterPanic(combined);
    } catch (error) {
      console.warn(
        '[PanicFilter] Gemini unavailable, falling back to local filter:',
        error,
      );
      return this.localFilter(combined);
    }
  }

  /**
   * Regex-based fallback that strips common panic phrases and cleans up
   * punctuation / casing artefacts.
   */
  localFilter(text: string): string {
    let cleaned = text;

    for (const pattern of PANIC_PATTERNS) {
      cleaned = cleaned.replace(pattern, '');
    }

    // Collapse extra whitespace and punctuation artefacts
    cleaned = cleaned
      .replace(/\s{2,}/g, ' ')
      .replace(/^\s*[,;]\s*/gm, '')
      .replace(/[,;]\s*$/gm, '')
      .trim();

    // Ensure first character is uppercase
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    return cleaned || 'No actionable observations recorded.';
  }
}
