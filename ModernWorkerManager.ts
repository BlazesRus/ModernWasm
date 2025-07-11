/*
 * ModernWorkerManager Template - Parameterized worker manager
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
import { wrap, proxy, transfer } from 'comlink';
import type { Remote } from 'comlink';
import { addDebugMessage, captureError } from './debugLogger.svelte';

/**
 * Generic worker manager template that can be parameterized for different worker types
 *
 * @template TWorkerInterface - The interface that the worker implements
 * @template TSearchConfig - The configuration type for search operations
 * @template TSearchResults - The results type for search operations
 * @template TProgressCallback - The progress callback type
 */
export class ModernWorkerManager<TWorkerInterface = any, TSearchConfig = any, TSearchResults = any, TProgressCallback = any> {
  private worker: Worker | null = null;
  private workerApi: Remote<TWorkerInterface> | null = null;
  private initialized = false;
  private workerImportPath: string;
  private workerName: string;

  /**
   * Create a new worker manager instance
   *
   * @param workerImportPath - The import path for the worker (e.g., './modern-sync-worker?worker')
   * @param workerName - Human-readable name for the worker (e.g., 'ModernTimelessWorker')
   */
  constructor(workerImportPath: string, workerName: string) {
    this.workerImportPath = workerImportPath;
    this.workerName = workerName;
  }

  /**
   * Initialize the worker
   */
  async init(): Promise<void> {
    if (!browser) {
      throw new Error(`${this.workerName} can only be initialized in browser environment`);
    }

    if (this.worker) {
      addDebugMessage(`${this.workerName} already initialized, terminating existing worker`, 'warn');
      this.terminate();
    }

    try {
      // Import the worker using Vite's worker import syntax
      const WorkerVariable = await import(/* @vite-ignore */ this.workerImportPath);
      this.worker = new WorkerVariable.default();

      // Wrap the worker with Comlink
      if (!this.worker) {
        throw new Error('Failed to create worker instance');
      }
      this.workerApi = wrap<TWorkerInterface>(this.worker);

      addDebugMessage(`${this.workerName} initialized successfully`);
    } catch (error) {
      captureError(error instanceof Error ? error : new Error(String(error)), `${this.workerName}Init`);
      throw new Error(`${this.workerName} initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Boot the worker with WASM data
   */
  async boot(wasmBuffer: ArrayBuffer): Promise<void> {
    if (!this.workerApi) {
      await this.init();
    }

    if (!this.workerApi) {
      throw new Error(`${this.workerName} not available`);
    }

    try {
      // Transfer the ArrayBuffer to the worker for better performance
      await (this.workerApi as any).initialize({
        wasmBuffer: transfer(wasmBuffer, [wasmBuffer])
      });

      this.initialized = true;
      addDebugMessage(`${this.workerName} booted successfully`);
    } catch (error) {
      captureError(error instanceof Error ? error : new Error(String(error)), `${this.workerName}Boot`);
      throw new Error(`${this.workerName} boot failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform reverse search with progress callback
   */
  async reverseSearch(config: TSearchConfig, onProgress?: TProgressCallback): Promise<TSearchResults> {
    if (!this.workerApi || !this.initialized) {
      throw new Error(`${this.workerName} not initialized. Call boot() first.`);
    }

    try {
      // Create a proxied progress callback if provided
      const progressProxy = onProgress ? proxy(onProgress) : undefined;
      const result = await (this.workerApi as any).reverseSearch(config, progressProxy);

      // Proxy cleanup is handled automatically by Comlink
      return result;
    } catch (error) {
      captureError(error instanceof Error ? error : new Error(String(error)), `${this.workerName}ReverseSearch`);
      throw new Error(`${this.workerName} search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get worker status
   */
  async getStatus(): Promise<{ initialized: boolean; ready: boolean }> {
    if (!this.workerApi) {
      return { initialized: false, ready: false };
    }

    try {
      return await (this.workerApi as any).getStatus();
    } catch (error) {
      captureError(error instanceof Error ? error : new Error(String(error)), `${this.workerName}Status`);
      return { initialized: false, ready: false };
    }
  }

  /**
   * Check if worker is ready
   */
  isReady(): boolean {
    return this.initialized && this.workerApi !== null;
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.workerApi = null;
      this.initialized = false;
      addDebugMessage(`${this.workerName} terminated`);
    }
  }

  /**
   * Cleanup method for proper resource management
   */
  dispose(): void {
    this.terminate();
  }

  /**
   * Get the worker API (for advanced usage)
   */
  getWorkerApi(): Remote<TWorkerInterface> | null {
    return this.workerApi;
  }
}

/**
 * Factory function to create a typed worker manager
 *
 * @param workerImportPath - The import path for the worker
 * @param workerName - Human-readable name for the worker
 * @returns A typed worker manager instance
 */
export function createWorkerManager<TWorkerInterface = any, TSearchConfig = any, TSearchResults = any, TProgressCallback = any>(workerImportPath: string, workerName: string): ModernWorkerManager<TWorkerInterface, TSearchConfig, TSearchResults, TProgressCallback> {
  return new ModernWorkerManager<TWorkerInterface, TSearchConfig, TSearchResults, TProgressCallback>(workerImportPath, workerName);
}

/**
 * Example usage:
 *
 * // Import your worker types
 * import type { ModernTimelessWorker, SearchConfig, SearchResults, SearchProgressCallback } from './modern-worker-types';
 *
 * // Create a typed worker manager
 * const workerManager = createWorkerManager<
 *   ModernTimelessWorker,
 *   SearchConfig,
 *   SearchResults,
 *   SearchProgressCallback
 * >('./modern-sync-worker?worker', 'ModernTimelessWorker');
 *
 * // Use the worker manager
 * await workerManager.init();
 * await workerManager.boot(wasmBuffer);
 * const results = await workerManager.reverseSearch(config, onProgress);
 */
