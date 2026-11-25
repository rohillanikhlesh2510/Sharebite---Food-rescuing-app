import { lazy, type ComponentType } from 'react';

/**
 * Wraps React.lazy with automatic in-place retries (without full-page browser reloads)
 * so transient network glitches on tab wake recover smoothly, and persistent chunk
 * failures surface cleanly to ErrorBoundary.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const delays = [300, 800];
    let lastError: unknown;

    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        return await factory();
      } catch (err) {
        lastError = err;
        if (attempt < delays.length) {
          await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
        }
      }
    }

    throw lastError;
  });
}
