/**
 * Worker-safe Debug Logger Utility
 * A minimal debug logger that works in web workers without SvelteKit dependencies
 *
 * Copyright (C) 2025 James Armstrong (github.com/BlazesRus)
 * Generated with GitHub Copilot assistance
 *
 * MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

// Worker-safe browser detection
const isWorkerBrowser = typeof window !== 'undefined' || typeof self !== 'undefined';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface DebugMessage {
  timestamp: string;
  message: string;
  level: LogLevel;
  context?: string;
}

export interface CustomError {
  message: string;
  context?: string;
  timestamp: string;
  stack?: string;
}

// Simple in-memory storage for worker context
const MAX_LOGS = 40;
let debugMessages: DebugMessage[] = [];
let lastError: CustomError | null = null;

/**
 * Add a debug message to the log
 */
export function addDebugMessage(message: string, level: LogLevel = 'info', context?: string): void {
  const debugMessage: DebugMessage = {
    timestamp: new Date().toISOString(),
    message,
    level,
    context
  };

  debugMessages.push(debugMessage);

  // Keep only the last MAX_LOGS messages
  if (debugMessages.length > MAX_LOGS) {
    debugMessages = debugMessages.slice(-MAX_LOGS);
  }

  // Also log to console in worker context
  if (isWorkerBrowser) {
    const logMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : level === 'debug' ? console.debug : console.log;

    const prefix = context ? `[${context}]` : '[Worker]';
    logMethod(`${prefix} ${message}`);
  }
}

/**
 * Capture an error and store it
 */
export function captureError(error: Error, context?: string): void {
  const customError: CustomError = {
    message: error.message,
    context,
    timestamp: new Date().toISOString(),
    stack: error.stack
  };

  lastError = customError;

  // Also add as debug message
  addDebugMessage(error.message, 'error', context);
}

/**
 * Get all debug messages
 */
export function getDebugMessages(): DebugMessage[] {
  return [...debugMessages];
}

/**
 * Get the last error
 */
export function getLastError(): CustomError | null {
  return lastError;
}

/**
 * Clear all debug messages
 */
export function clearDebugMessages(): void {
  debugMessages = [];
}

/**
 * Clear the last error
 */
export function clearLastError(): void {
  lastError = null;
}

/**
 * Worker-safe WASM debug utilities
 */
export const wasmDebug = {
  /**
   * Inspect WASM memory state (worker-safe version)
   */
  inspectMemory(): any {
    try {
      const info: any = {
        globalThis: {},
        wasmInstance: {},
        memoryInfo: {},
        error: null
      };

      // Check for WASM globals in worker context
      try {
        const globalThisAny = globalThis as any;
        const wasmExports: string[] = [];

        // Check for common WASM exports
        const commonExports = ['Calculate', 'TimelessJewels', 'PassiveSkills', 'memory'];
        commonExports.forEach(exportName => {
          if (exportName in globalThisAny) {
            wasmExports.push(exportName);
          }
        });

        info.globalThis = {
          totalExports: wasmExports.length,
          hasCalculate: 'Calculate' in globalThisAny,
          hasTimelessJewels: 'TimelessJewels' in globalThisAny,
          hasPassiveSkills: 'PassiveSkills' in globalThisAny,
          wasmExports
        };
      } catch (error) {
        info.globalThis = { error: error instanceof Error ? error.message : 'Unknown error' };
      }

      // Check for WebAssembly instance
      try {
        if (globalThis.WebAssembly) {
          info.wasmInstance = {
            exportCount: 0,
            hasMemory: false,
            memoryPages: 0
          };
        }
      } catch (error) {
        info.wasmInstance = { error: error instanceof Error ? error.message : 'Unknown error' };
      }

      // Memory info (worker context)
      try {
        if (typeof performance !== 'undefined' && (performance as any).memory) {
          const memory = (performance as any).memory;
          info.memoryInfo = {
            usedMB: Math.round(memory.usedJSHeapSize / 1024 / 1024),
            totalMB: Math.round(memory.totalJSHeapSize / 1024 / 1024),
            jsHeapSizeLimit: memory.jsHeapSizeLimit
          };
        }
      } catch (error) {
        info.memoryInfo = { error: error instanceof Error ? error.message : 'Memory API not available' };
      }

      return info;
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to inspect memory',
        globalThis: {},
        wasmInstance: {},
        memoryInfo: {}
      };
    }
  }
};
