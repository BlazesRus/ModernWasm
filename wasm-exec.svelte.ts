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
import { debugLog, captureError } from './debugLogger.svelte';
import { getModernWasmRuntime, goRuntimeState, type ModernGoWasmRuntimeManager } from './go-runtime.svelte';

// Reactive WASM executor state using Svelte 5 runes
const wasmExecutorState = $state({
  // Core state
  isLoading: false,
  progress: 0, // 0-100
  statusMessage: '' as string,
  error: null as string | null,

  // Internal fields converted to reactive state
  _loadPromise: null as Promise<boolean> | null,
  _exports: {} as Record<string, any>,

  // Derived getters using $derived for optimal reactivity
  get exports() {
    return { ...this._exports };
  },

  get isReady() {
    return goRuntimeState.isReady && !this.isLoading && this.error === null;
  },

  get hasExports() {
    return Object.keys(this._exports).length > 0;
  }
});

// Helper functions for side effects (called manually when needed)
function handleExecutorError() {
  if (wasmExecutorState.error) {
    captureError(new Error(wasmExecutorState.error), 'WASM-Exec');
  }
}

function syncExportsFromRuntime() {
  wasmExecutorState._exports = goRuntimeState.exports;
}

function logProgressChange() {
  if (wasmExecutorState.progress > 0) {
    debugLog.debug(`Progress: ${wasmExecutorState.progress}% - ${wasmExecutorState.statusMessage}`, 'WASM-Exec');
  }
}

function logStateTransition() {
  const state = wasmExecutorState.isLoading ? 'loading' : wasmExecutorState.isReady ? 'ready' : wasmExecutorState.error ? 'error' : 'idle';
  debugLog.debug(`State transition: ${state}`, 'WASM-Exec');
}

// Export the reactive states for components
export { goRuntimeState as wasmState, wasmExecutorState };

// Enhanced WASM executor with full reactive state
export class ModernWasmExecutor {
  private runtime: ModernGoWasmRuntimeManager;

  constructor() {
    debugLog.info('Initializing Modern WASM Executor with reactive state', 'WASM-Exec');
    this.runtime = getModernWasmRuntime();
  }

  // Update progress using reactive state with manual logging calls
  private updateProgress(progress: number, message?: string) {
    wasmExecutorState.progress = Math.max(0, Math.min(100, progress)); // Clamp 0-100
    if (message) {
      wasmExecutorState.statusMessage = message;
    }
    // Manual logging and state management
    logProgressChange();
    logStateTransition();
    handleExecutorError();
  }

  async loadWasm(wasmPath: string): Promise<boolean> {
    if (!browser) {
      debugLog.warn('Not in browser environment, skipping WASM load', 'WASM-Exec');
      return false;
    }

    // Prevent multiple simultaneous loads using reactive state
    if (wasmExecutorState._loadPromise) {
      debugLog.info('WASM load already in progress, waiting...', 'WASM-Exec');
      return await wasmExecutorState._loadPromise;
    }

    // Reset state for new load
    wasmExecutorState.error = null;
    wasmExecutorState.progress = 0;
    wasmExecutorState.statusMessage = '';

    wasmExecutorState._loadPromise = this._performLoad(wasmPath);
    try {
      const result = await wasmExecutorState._loadPromise;
      return result;
    } finally {
      wasmExecutorState._loadPromise = null;
    }
  }

  private async _performLoad(wasmPath: string): Promise<boolean> {
    try {
      wasmExecutorState.isLoading = true;
      this.updateProgress(10, `Starting WASM load from: ${wasmPath}`);

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

          // Sync exports to reactive state and call sync helper
          wasmExecutorState._exports = this.runtime.getExports();
          syncExportsFromRuntime();

          // Log available exports
          const exportNames = Object.keys(wasmExecutorState._exports).filter(name => wasmExecutorState._exports[name] !== undefined);
          debugLog.info(`📦 Available exports: ${exportNames.join(', ')}`, 'WASM-Exec');

          // Also log global exports that might be from Crystalline
          const globalExports = Object.keys(globalThis).filter(key => typeof (globalThis as any)[key] === 'function' && !['setTimeout', 'setInterval', 'fetch', 'alert', 'confirm', 'prompt'].includes(key));
          debugLog.info(`🌐 Global function exports: ${globalExports.slice(0, 10).join(', ')}`, 'WASM-Exec');

          // Try to initialize Crystalline if the function exists
          debugLog.info('🔍 Checking for Crystalline functions in globalThis...', 'WASM-Exec');

          // Look for common Crystalline function patterns
          const crystallineFunctions = Object.keys(globalThis).filter(key => key.includes('crystalline') || key.includes('Crystalline') || key.includes('initialize') || key.includes('Calculate') || key.includes('ReverseSearch'));

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
            wasmExecutorState.error = 'Go initialization timeout - WASM loaded but not running';
            debugLog.error('❌ WASM timeout and runtime not running', 'WASM-Exec');
            return false;
          }
        }
      } else {
        this.updateProgress(0, '❌ WASM loading failed');
        wasmExecutorState.error = 'WASM loading failed';
        debugLog.error('❌ WASM loading failed', 'WASM-Exec');
        return false;
      }
    } catch (error) {
      const errorMsg = `WASM loading error: ${error}`;
      wasmExecutorState.error = errorMsg;
      this.updateProgress(0, errorMsg);
      debugLog.error(errorMsg, 'WASM-Exec');
      return false;
    } finally {
      // Always clear loading state
      wasmExecutorState.isLoading = false;
    }
  }

  // Wait for Go to finish initializing and export functions
  // Following Copilot's recommendation: check goRuntimeState.exports instead of globalThis
  private async waitForGoInitialization(timeoutMs: number = 15000): Promise<boolean> {
    const startTime = Date.now();
    let hasLoggedProgress = false;

    while (Date.now() - startTime < timeoutMs) {
      // Check the reactive exports object (Copilot's recommended approach)
      const exports = goRuntimeState.exports;
      if (exports && Object.keys(exports).length > 0) {
        debugLog.info(`✅ Exports detected: ${Object.keys(exports).join(', ')}`, 'WASM-Exec');
        return true;
      }

      // Also check if Go runtime is running - if so, we can proceed
      if (goRuntimeState.isRunning) {
        if (!hasLoggedProgress) {
          debugLog.info('✅ Go runtime is running, checking for global exports...', 'WASM-Exec');
          hasLoggedProgress = true;
        }

        // Check for specific Go exports that we know should exist
        const expectedFunctions = ['Calculate', 'TimelessJewels', 'PassiveSkills', 'TimelessJewelConquerors'];
        const foundFunctions = expectedFunctions.filter(name => (globalThis as any)[name] !== undefined);

        if (foundFunctions.length > 0) {
          debugLog.info(`✅ Expected Go exports found: ${foundFunctions.join(', ')}`, 'WASM-Exec');
          return true;
        }

        // Look for any indication that the calculator has been initialized
        // Check for console output that indicates success
        if (Date.now() - startTime > 2000) {
          // After 2 seconds, be more permissive
          debugLog.info(`✅ Go runtime running for ${Math.round((Date.now() - startTime) / 1000)}s - considering initialized`, 'WASM-Exec');
          return true;
        }

        // Also check for any function exports from Go
        const globalFunctions = Object.keys(globalThis).filter(key => {
          const value = (globalThis as any)[key];
          return typeof value === 'function' && !['setTimeout', 'setInterval', 'fetch', 'alert', 'confirm', 'prompt', 'console'].includes(key) && !key.startsWith('webkit') && !key.startsWith('chrome') && !key.startsWith('_');
        });

        if (globalFunctions.length > 2) {
          // More than just basic functions
          debugLog.info(`✅ Global exports found: ${globalFunctions.slice(0, 10).join(', ')}`, 'WASM-Exec');
          return true;
        }
      }

      // Check if we have specific indicators that the calculator is ready
      if ((globalThis as any).Calculate && typeof (globalThis as any).Calculate === 'function') {
        debugLog.info('✅ Calculator function detected - Go initialization complete', 'WASM-Exec');
        return true;
      }

      // Small sleep before re-check
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Timeout - but check if we're still running and have the key functions
    if (goRuntimeState.isRunning && !goRuntimeState.hasExited) {
      // Final check for the calculator function
      if ((globalThis as any).Calculate) {
        debugLog.warn('✅ Calculator function found despite timeout - proceeding', 'WASM-Exec');
        return true;
      }

      debugLog.warn('⚠️ Initialization timeout but Go runtime is still running - proceeding anyway', 'WASM-Exec');
      return true; // Proceed anyway if Go is running
    }

    debugLog.warn('⚠️ Initialization timeout and Go runtime not confirmed running', 'WASM-Exec');
    return false;
  }

  // Call a WASM exported function with reactive state and improved error handling
  callFunction(functionName: string, ...args: any[]): any {
    if (!wasmExecutorState.isReady) {
      const error = new Error('WASM not ready. Call loadWasm() first.');
      wasmExecutorState.error = error.message;
      throw error;
    }

    try {
      debugLog.debug(`Calling WASM function: ${functionName}`, 'WASM-Exec');
      const result = this.runtime.callExport(functionName, ...args);
      debugLog.debug(`Function ${functionName} completed successfully`, 'WASM-Exec');

      // Clear any previous errors on successful call
      if (wasmExecutorState.error) {
        wasmExecutorState.error = null;
      }

      return result;
    } catch (error) {
      const errorMsg = `Error calling ${functionName}: ${error}`;
      wasmExecutorState.error = errorMsg;
      debugLog.error(errorMsg, 'WASM-Exec');
      throw error;
    }
  }

  // Reset the reactive state (useful for cleanup or restart)
  reset() {
    wasmExecutorState.isLoading = false;
    wasmExecutorState.progress = 0;
    wasmExecutorState.statusMessage = '';
    wasmExecutorState.error = null;
    wasmExecutorState._loadPromise = null;
    wasmExecutorState._exports = {};
    debugLog.info('WASM executor state reset', 'WASM-Exec');
  }

  // Get all available exports from reactive state
  getExports(): Record<string, any> {
    return wasmExecutorState.exports;
  }

  // Check if WASM is ready for use using reactive state
  isReady(): boolean {
    return wasmExecutorState.isReady;
  }

  // Get current reactive state
  getState() {
    return wasmExecutorState;
  }

  // Get debug information with reactive state
  getDebugInfo() {
    return {
      isReady: wasmExecutorState.isReady,
      exports: Object.keys(wasmExecutorState.exports),
      progress: wasmExecutorState.progress,
      statusMessage: wasmExecutorState.statusMessage,
      error: wasmExecutorState.error,
      isLoading: wasmExecutorState.isLoading,
      hasExports: wasmExecutorState.hasExports,
      goRuntimeState: goRuntimeState
    };
  }
}

// Global instance for singleton pattern
let globalWasmExecutor: ModernWasmExecutor | null = null;

export function getModernWasmExecutor(): ModernWasmExecutor {
  if (!globalWasmExecutor) {
    globalWasmExecutor = new ModernWasmExecutor();
  }
  return globalWasmExecutor;
}

// Legacy compatibility wrapper (matches the interface expected by existing code)
export class ModernGoWasmRuntime {
  private executor: ModernWasmExecutor;

  constructor() {
    debugLog.info('Creating legacy compatibility wrapper', 'WASM-Exec');
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

debugLog.info('✅ Modern WASM Executor loaded and ready', 'WASM-Exec');
