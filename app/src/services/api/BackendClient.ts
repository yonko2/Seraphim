const DEFAULT_TIMEOUT = 10000;

export class BackendClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async post<T = any>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async get<T = any>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body != null ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`[BackendClient] ${method} ${path} failed (${response.status}): ${errorText}`);
      }

      const text = await response.text();
      if (!text) return {} as T;

      try {
        return JSON.parse(text) as T;
      } catch {
        return text as unknown as T;
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`[BackendClient] ${method} ${path} timed out after ${DEFAULT_TIMEOUT}ms`);
      }
      if (error instanceof Error && error.message.startsWith('[BackendClient]')) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`[BackendClient] ${method} ${path} network error: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
