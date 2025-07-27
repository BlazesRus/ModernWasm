/**
 * Modern WASM Executor for Svelte 5 with Runes
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

import { browser } from '$app/environment';
import { debugLog } from './wasmLogger.svelte';
import { getModernWasmRuntime, goRuntimeState, type ModernGoWasmRuntimeManager } from './go-runtime.svelte';

// Re-export the reactive state for components
export { goRuntimeState as wasmState };

// Enhanced WASM executor with full TypeScript typing and Svelte 5 runes
export class ModernWasmExecutor {
  private runtime: ModernGoWasmRuntimeManager;
  private loadPromise: Promise<boolean> | null = null;
  private progressCallback?: (progress: number) => void;

  constructor(progressCallback?: (progress: number) => void) {
    debugLog.info('Initializing Modern WASM Executor with Svelte 5 runes', 'WASM-Exec');
    this.runtime = getModernWasmRuntime();
    this.progressCallback = progressCallback;
  }

  // Update progress and notify callback
  private updateProgress(progress: number, message?: string) {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
    if (message) {
      debugLog.info(message, 'WASM-Exec');
    }
  }

  async loadWasm(wasmPath: string): Promise<boolean> {
    if (!browser) {
      debugLog.warn('Not in browser environment, skipping WASM load', 'WASM-Exec');
      return false;
    }

    // Prevent multiple simultaneous loads
    if (this.loadPromise) {
      debugLog.info('WASM load already in progress, waiting...', 'WASM-Exec');
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
        this.updateProgress(75, 'Go runtime started, waiting for initialization...');

        // Wait for Go to finish initializing and export functions
        const isReady = await this.waitForGoInitialization();

        if (isReady) {
          this.updateProgress(90, 'Extracting exports...');

          // Log available exports
          const exports = this.runtime.getExports();
          const exportNames = Object.keys(exports).filter(name => exports[name] !== undefined);
          debugLog.info(`📦 Available exports: ${exportNames.join(', ')}`, 'WASM-Exec');

          // Also log global exports that might be from Crystalline
          const globalExports = Object.keys(globalThis).filter(key => typeof (globalThis as any)[key] === 'function' && !['setTimeout', 'setInterval', 'fetch', 'alert', 'confirm', 'prompt'].includes(key));
          debugLog.info(`🌐 Global function exports: ${globalExports.slice(0, 10).join(', ')}`, 'WASM-Exec');

          this.updateProgress(100, '✅ WASM loaded successfully with modern TypeScript runtime!');
          return true;
        } else {
          // Timeout occurred, but WASM might still be functional
          debugLog.warn('⚠️ Go initialization timeout but checking if WASM is functional...', 'WASM-Exec');

          // Check if WASM runtime is actually running (this indicates success despite timeout)
          if (goRuntimeState.isRunning && !goRuntimeState.hasExited) {
            this.updateProgress(95, '⚠️ WASM loaded - exports detection slow but runtime is active');
            debugLog.info('✅ WASM is running, proceeding despite initialization timeout', 'WASM-Exec');

            // Give it one more moment to settle, then declare success
            await new Promise(resolve => setTimeout(resolve, 500));
            this.updateProgress(100, '✅ WASM loaded successfully (runtime confirmed active)!');
            return true;
          } else {
            this.updateProgress(70, '❌ Go initialization timeout - WASM loaded but not running');
            debugLog.error('❌ WASM timeout and runtime not running', 'WASM-Exec');
            return false;
          }
        }
      } else {
        this.updateProgress(0, '❌ WASM loading failed');
        debugLog.error('❌ WASM loading failed', 'WASM-Exec');
        return false;
      }
    } catch (error) {
      const errorMsg = `WASM loading error: ${error}`;
      goRuntimeState.error = errorMsg;
      this.updateProgress(0, errorMsg);
      debugLog.error(errorMsg, 'WASM-Exec');
      return false;
    }
  }

  // Wait for Go to finish initializing and export functions
  // Following Copilot's recommendation: check goRuntimeState.exports instead of globalThis
  private async waitForGoInitialization(timeoutMs: number = 8000): Promise<boolean> {
    const startTime = Date.now();
    let hasLoggedProgress = false;

    while (Date.now() - startTime < timeoutMs) {
      // Check the reactive exports object (Copilot's recommended approach)
      const exports = goRuntimeState.exports;
      if (exports && Object.keys(exports).length > 0) {
        debugLog.info(`✅ Exports detected: ${Object.keys(exports).join(', ')}`);
        return true;
      }

      // Also check if Go runtime is running - if so, we can proceed
      if (goRuntimeState.isRunning) {
        if (!hasLoggedProgress) {
          debugLog.info('✅ Go runtime is running, checking for global exports...');
          hasLoggedProgress = true;
        }

        // Check for specific Go exports that we know should exist
        const expectedFunctions = ['Calculate', 'TimelessJewels', 'PassiveSkills', 'TimelessJewelConquerors'];
        const foundFunctions = expectedFunctions.filter(name => (globalThis as any)[name] !== undefined);

        if (foundFunctions.length > 0) {
          debugLog.info(`✅ Expected Go exports found: ${foundFunctions.join(', ')}`);
          return true;
        }

        // Also check for any function exports from Go
        const globalFunctions = Object.keys(globalThis).filter(key => {
          const value = (globalThis as any)[key];
          return typeof value === 'function' &&
                 !['setTimeout', 'setInterval', 'fetch', 'alert', 'confirm', 'prompt', 'console'].includes(key) &&
                 !key.startsWith('webkit') && !key.startsWith('chrome') && !key.startsWith('_');
        });

        if (globalFunctions.length > 2) { // More than just basic functions
          debugLog.info(`✅ Global exports found: ${globalFunctions.slice(0, 10).join(', ')}`);
          return true;
        }
      }

      // Check if we have specific indicators that the calculator is ready
      if ((globalThis as any).Calculate && typeof (globalThis as any).Calculate === 'function') {
        debugLog.info('✅ Calculator function detected - Go initialization complete');
        return true;
      }

      // Small sleep before re-check
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    // Timeout - but check if we're still running and have the key functions
    if (goRuntimeState.isRunning && !goRuntimeState.hasExited) {
      // Final check for the calculator function
      if ((globalThis as any).Calculate) {
        debugLog.warn('✅ Calculator function found despite timeout - proceeding');
        return true;
      }

      debugLog.warn('⚠️ Initialization timeout but Go runtime is still running - proceeding anyway');
      return true; // Proceed anyway if Go is running
    }

    debugLog.warn('⚠️ Initialization timeout and Go runtime not confirmed running');
    return false;
  }

  // Call a WASM exported function with full type safety
  callFunction(functionName: string, ...args: any[]): any {
    if (!this.isReady()) {
      throw new Error('WASM not ready. Call loadWasm() first.');
    }

    try {
      debugLog.info(`Calling WASM function: ${functionName}`);
      const result = this.runtime.callExport(functionName, ...args);
      debugLog.info(`Function ${functionName} completed successfully`);
      return result;
    } catch (error) {
      const errorMsg = `Error calling ${functionName}: ${error}`;
      goRuntimeState.error = errorMsg;
      debugLog.error(errorMsg);
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
    debugLog.info('Creating legacy compatibility wrapper');
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

debugLog.info('✅ Modern WASM Executor loaded and ready');
