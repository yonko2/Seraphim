/**
 * Extracts a user-friendly message from API errors.
 */
export function handleApiError(error: unknown): string {
  if (error instanceof Response || (error && typeof error === 'object' && 'status' in error)) {
    const status = (error as { status: number }).status;
    switch (true) {
      case status === 401:
        return 'Authentication failed. Please sign in again.';
      case status === 403:
        return 'You don\'t have permission to perform this action.';
      case status === 404:
        return 'The requested resource was not found.';
      case status === 429:
        return 'Too many requests. Please wait a moment and try again.';
      case status >= 500:
        return 'Server error. Please try again later.';
      default:
        return `Request failed with status ${status}.`;
    }
  }

  if (isNetworkError(error)) {
    return 'Network error. Please check your internet connection.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Returns guidance text for a denied permission.
 */
export function handlePermissionError(permission: string): string {
  const messages: Record<string, string> = {
    camera: 'Camera access is required to capture images for emergency reporting. Please enable it in Settings.',
    location: 'Location access is needed to share your position with emergency services. Please enable it in Settings.',
    microphone: 'Microphone access is needed for voice commands. Please enable it in Settings.',
    notifications: 'Notifications help alert you to emergencies. Please enable them in Settings.',
  };

  return messages[permission.toLowerCase()] ??
    `${permission} permission is required. Please enable it in your device settings.`;
}

/**
 * Logs errors with context. Extensible to crash reporting services.
 */
export function logError(context: string, error: unknown): void {
  const timestamp = new Date().toISOString();
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  console.error(`[${timestamp}] [${context}] ${message}`);
  if (stack) {
    console.error(stack);
  }
}

/**
 * Checks if the error is network-related.
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === 'Network request failed') {
    return true;
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('econnrefused') ||
      msg.includes('enotfound') ||
      msg.includes('fetch failed')
    );
  }

  return false;
}

/**
 * Generic retry wrapper with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      logError(`withRetry (attempt ${attempt + 1}/${maxRetries + 1})`, error);

      if (attempt < maxRetries) {
        const backoff = delay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }

  throw lastError;
}
