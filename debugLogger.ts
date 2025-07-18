/**
 * Debug Logger Utility for Modern Mode
 * Captures the last 20 debug messages and provides error handling
 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

interface DebugMessage {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: string;
}

interface CaughtError {
  message: string;
  stack?: string;
  timestamp: string;
  context?: string;
}

const MAX_LOGS = 20;

// Stores for debug messages and errors
export const debugMessages = writable<DebugMessage[]>([]);
export const lastError = writable<CaughtError | null>(null);

// Add a debug message to the log
export function addDebugMessage(message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info', context?: string) {
  if (!browser) return;

  const debugMsg: DebugMessage = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context
  };

  debugMessages.update(messages => {
    const newMessages = [...messages, debugMsg];
    return newMessages.length > MAX_LOGS ? newMessages.slice(-MAX_LOGS) : newMessages;
  });

  // Also log to console for development
  const logMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  const prefix = context ? `[${context}]` : '';
  logMethod(`🔧 ${prefix} ${message}`);
}

// Capture an error with context
export function captureError(error: Error | string, context?: string) {
  if (!browser) return;

  const errorObj: CaughtError = {
    message: typeof error === 'string' ? error : error.message,
    stack: typeof error === 'object' && error.stack ? error.stack : undefined,
    timestamp: new Date().toISOString(),
    context
  };

  lastError.set(errorObj);
  addDebugMessage(`❌ Error caught: ${errorObj.message}`, 'error', context);

  // Log to console as well
  console.error('🚨 Error captured:', errorObj);
}

// Clear all debug messages
export function clearDebugMessages() {
  debugMessages.set([]);
}

// Clear the last error
export function clearLastError() {
  lastError.set(null);
}

// Convenience functions for different log levels
export const debugLog = {
  info: (message: string, context?: string) => addDebugMessage(message, 'info', context),
  warn: (message: string, context?: string) => addDebugMessage(message, 'warn', context),
  error: (message: string, context?: string) => addDebugMessage(message, 'error', context),
  debug: (message: string, context?: string) => addDebugMessage(message, 'debug', context)
};

// Initialize with a startup message
if (browser) {
  addDebugMessage('Debug logger initialized', 'info', 'DebugLogger');
}

// WASM debugging utilities
export const wasmDebug = {
  // Inspect WASM memory usage
  inspectMemory(wasmInstance?: WebAssembly.Instance): object {
    if (!browser) return {};

    const info: any = {
      timestamp: new Date().toISOString(),
      memoryInfo: {},
      globalThis: {},
      wasmInstance: null
    };

    try {
      // Browser memory info if available
      if ('memory' in performance && (performance as any).memory) {
        const mem = (performance as any).memory;
        info.memoryInfo = {
          usedJSHeapSize: mem.usedJSHeapSize,
          totalJSHeapSize: mem.totalJSHeapSize,
          jsHeapSizeLimit: mem.jsHeapSizeLimit,
          usedMB: Math.round(mem.usedJSHeapSize / 1024 / 1024),
          totalMB: Math.round(mem.totalJSHeapSize / 1024 / 1024)
        };
      }

      // WASM-specific exports and globals
      const wasmExports = Object.keys(globalThis).filter(key => {
        const value = (globalThis as any)[key];
        return typeof value === 'function' &&
               !['setTimeout', 'setInterval', 'fetch', 'alert', 'confirm', 'prompt', 'console'].includes(key) &&
               !key.startsWith('webkit') && !key.startsWith('chrome') && !key.startsWith('_');
      });

      info.globalThis = {
        wasmExports: wasmExports.slice(0, 10), // First 10 exports
        totalExports: wasmExports.length,
        hasCalculate: typeof (globalThis as any).Calculate === 'function',
        hasTimelessJewels: typeof (globalThis as any).TimelessJewels === 'object',
        hasPassiveSkills: Array.isArray((globalThis as any).PassiveSkills)
      };

      // WASM instance info if provided
      if (wasmInstance) {
        info.wasmInstance = {
          hasExports: !!wasmInstance.exports,
          exportCount: wasmInstance.exports ? Object.keys(wasmInstance.exports).length : 0,
          hasMemory: !!(wasmInstance.exports as any)?.memory,
          memoryPages: (wasmInstance.exports as any)?.memory?.buffer?.byteLength ?
                       Math.floor((wasmInstance.exports as any).memory.buffer.byteLength / 65536) : 0
        };
      }

    } catch (error) {
      info.error = error instanceof Error ? error.message : String(error);
    }

    return info;
  },

  // Log current WASM state with memory inspection
  logWasmState(context?: string, wasmInstance?: WebAssembly.Instance) {
    const info = this.inspectMemory(wasmInstance);
    addDebugMessage(`WASM State: ${JSON.stringify(info, null, 2)}`, 'debug', context || 'WASM-Debug');
    return info;
  },

  // Monitor WASM function calls with performance tracking
  wrapWasmFunction<T extends (...args: any[]) => any>(fn: T, name: string): T {
    if (!browser || typeof fn !== 'function') return fn;

    return ((...args: any[]) => {
      const start = performance.now();
      addDebugMessage(`Calling WASM function: ${name} with ${args.length} args`, 'debug', 'WASM-Call');

      try {
        const result = fn(...args);
        const duration = performance.now() - start;
        addDebugMessage(`WASM function ${name} completed in ${duration.toFixed(2)}ms`, 'debug', 'WASM-Call');
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        captureError(error instanceof Error ? error : new Error(String(error)), `WASM-Call-${name}`);
        addDebugMessage(`WASM function ${name} failed after ${duration.toFixed(2)}ms`, 'error', 'WASM-Call');
        throw error;
      }
    }) as T;
  }
};

// Auto-log WASM state every 10 seconds in debug mode (only in development)
if (browser && import.meta.env.DEV) {
  setInterval(() => {
    if ((globalThis as any).Calculate) {
      wasmDebug.logWasmState('Auto-Monitor');
    }
  }, 10000);
}
