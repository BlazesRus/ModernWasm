/**
 * Modern WASM Executor for Svelte 5 with Runes
 *
 * Copyright (C) 2025 James Armstrong (github.com/BlazesRus)
 * Generated with GitHub Copilot assistance
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * This provides a clean interface to the modern Go WASM runtime
 */

import { browser } from '$app/environment';
import { getModernWasmRuntime, goRuntimeState, type ModernGoWasmRuntimeManager } from './go-runtime.svelte';

// Re-export the reactive state for components
export { goRuntimeState as wasmState };

// Debug logging with reactive state
function debugLog(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  if (!browser) return;

  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] WASM Exec: ${message}`;

  // Add to reactive logs
  goRuntimeState.logs.push(logMessage);
  if (goRuntimeState.logs.length > 50) {
    goRuntimeState.logs = goRuntimeState.logs.slice(-50);
  }

  // Console output
  switch (level) {
    case 'error':
      console.error(`🚨 WASM Exec: ${message}`);
      break;
    case 'warn':
      console.warn(`⚠️ WASM Exec: ${message}`);
      break;
    default:
      console.log(`🔧 WASM Exec: ${message}`);
  }
}

// Enhanced WASM executor with full TypeScript typing and Svelte 5 runes
export class ModernWasmExecutor {
  private runtime: ModernGoWasmRuntimeManager;
  private loadPromise: Promise<boolean> | null = null;
  private progressCallback?: (progress: number) => void;

  constructor(progressCallback?: (progress: number) => void) {
    debugLog('Initializing Modern WASM Executor with Svelte 5 runes');
    this.runtime = getModernWasmRuntime();
    this.progressCallback = progressCallback;
  }

  // Update progress and notify callback
  private updateProgress(progress: number, message?: string) {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
    if (message) {
      debugLog(message);
    }
  }

  async loadWasm(wasmPath: string): Promise<boolean> {
    if (!browser) {
      debugLog('Not in browser environment, skipping WASM load', 'warn');
      return false;
    }

    // Prevent multiple simultaneous loads
    if (this.loadPromise) {
      debugLog('WASM load already in progress, waiting...');
      return await this.loadPromise;
    }

    this.loadPromise = this._performLoad(wasmPath);
    const result = await this.loadPromise;
    this.loadPromise = null;
    return result;
  }

  private async _performLoad(wasmPath: string): Promise<boolean> {
    try {
      this.updateProgress(10, `Starting WASM load from: ${wasmPath}`);
      goRuntimeState.error = null;

      this.updateProgress(30, 'Initializing Go runtime...');

      // Load and run the WASM using the new TypeScript runtime
      this.updateProgress(60, 'Loading WASM binary...');
      const success = await this.runtime.loadAndRun(wasmPath);

      if (success) {
        this.updateProgress(80, 'Waiting for Go initialization...');

        // Wait for Go to finish initializing and export functions
        const isReady = await this.waitForGoInitialization();

        if (isReady) {
          this.updateProgress(90, 'Extracting exports...');

          // Log available exports
          const exports = this.runtime.getExports();
          const exportNames = Object.keys(exports).filter(name => exports[name] !== undefined);
          debugLog(`📦 Available exports: ${exportNames.join(', ')}`);

          // Also log global exports that might be from Crystalline
          const globalExports = Object.keys(globalThis).filter(key => 
          typeof (globalThis as any)[key] === 'function' &&
          !['setTimeout', 'setInterval', 'fetch', 'alert', 'confirm', 'prompt'].includes(key));
          debugLog(`🌐 Global function exports: ${globalExports.slice(0, 10).join(', ')}`);

          this.updateProgress(100, '✅ WASM loaded successfully with modern TypeScript runtime!');
          return true;
        } else {
          this.updateProgress(50, '⚠️ Go initialization timeout - WASM loaded but exports not ready');
          debugLog('⚠️ Go initialization timeout but continuing anyway', 'warn');
          // Don't fail completely - the WASM might still be functional
          return true;
        }
      } else {
        this.updateProgress(0, '❌ WASM loading failed');
        debugLog('❌ WASM loading failed', 'error');
        return false;
      }
    } catch (error) {
      const errorMsg = `WASM loading error: ${error}`;
      goRuntimeState.error = errorMsg;
      this.updateProgress(0, errorMsg);
      debugLog(errorMsg, 'error');
      return false;
    }
  }

  // Wait for Go to finish initializing and export functions
  // Following Copilot's recommendation: check goRuntimeState.exports instead of globalThis
  private async waitForGoInitialization(timeoutMs: number = 10000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      // Check the reactive exports object (Copilot's recommended approach)
      const exports = goRuntimeState.exports;
      if (exports && Object.keys(exports).length > 0) {
        debugLog(`✅ Exports detected: ${Object.keys(exports).join(', ')}`);
        return true;
      }

      // Also check if Go runtime is running and has low-level WASM exports
      if (goRuntimeState.isRunning && exports) {
        const exportKeys = Object.keys(exports);
        if (exportKeys.length > 0) {
          debugLog(`✅ Go runtime exports ready: ${exportKeys.slice(0, 10).join(', ')}`);
          return true;
        }
      }

      // Small sleep before re-check
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    debugLog('⚠️ Initialization timeout – no exports found', 'warn');
    return false;
  }

  // Call a WASM exported function with full type safety
  callFunction(functionName: string, ...args: any[]): any {
    if (!this.isReady()) {
      throw new Error('WASM not ready. Call loadWasm() first.');
    }

    try {
      debugLog(`Calling WASM function: ${functionName}`);
      const result = this.runtime.callExport(functionName, ...args);
      debugLog(`Function ${functionName} completed successfully`);
      return result;
    } catch (error) {
      const errorMsg = `Error calling ${functionName}: ${error}`;
      goRuntimeState.error = errorMsg;
      debugLog(errorMsg, 'error');
      throw error;
    }
  }

  // Get all available exports
  getExports(): Record<string, any> {
    return this.runtime.getExports();
  }

  // Check if WASM is ready for use
  isReady(): boolean {
    return this.runtime.isReady();
  }

  // Get current state (reactive)
  getState() {
    return goRuntimeState;
  }

  // Get debug information
  getDebugInfo() {
    return {
      isReady: this.isReady(),
      exports: Object.keys(this.getExports()),
      memoryUsage: goRuntimeState.memoryUsage,
      lastOperation: goRuntimeState.lastOperation,
      logs: goRuntimeState.logs.slice(-10), // Last 10 logs
      state: goRuntimeState
    };
  }
}

// Global instance for singleton pattern
let globalWasmExecutor: ModernWasmExecutor | null = null;

export function getModernWasmExecutor(progressCallback?: (progress: number) => void): ModernWasmExecutor {
  if (!globalWasmExecutor) {
    globalWasmExecutor = new ModernWasmExecutor(progressCallback);
  }
  return globalWasmExecutor;
}

// Legacy compatibility wrapper (matches the interface expected by existing code)
export class ModernGoWasmRuntime {
  private executor: ModernWasmExecutor;

  constructor() {
    debugLog('Creating legacy compatibility wrapper');
    this.executor = getModernWasmExecutor();
  }

  async loadWasm(wasmPath: string): Promise<boolean> {
    return await this.executor.loadWasm(wasmPath);
  }

  getExports(): Record<string, any> {
    return this.executor.getExports();
  }

  callFunction(functionName: string, ...args: any[]): any {
    return this.executor.callFunction(functionName, ...args);
  }

  isReady(): boolean {
    return this.executor.isReady();
  }

  hasFunction(name: string): boolean {
    const exports = this.getExports();
    return typeof exports[name] === 'function';
  }
}

debugLog('✅ Modern WASM Executor loaded and ready');
