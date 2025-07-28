// import $state if your setup requires it; otherwise Svelte 5 auto-imports runes
// import { state as $state } from 'svelte/runes';
import { addDebugMessage, captureError, wasmLog } from './wasmLogger.svelte';
import { WASI } from '@wasmer/wasi';
import { WasmFs } from '@wasmer/wasmfs';

// Helper function for debug logging with context
function wasiDebugLog(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  wasmLog[level](`🔧 WASI Loader: ${message}`, 'WasiLoader');
}

// Types for WASI WASM module using @wasmer/wasi
export interface WasiModule {
  instance: any;
  exports: Record<string, any>;
  memory: WebAssembly.Memory | null;
}

/**
 * WASI Loader class - uses @wasmer/wasi with proper dynamic imports
 * Each instance manages its own WASM module independently
 */
export class WasiLoader {
  // Static registry: filename → compiled Module
  private static moduleRegistry = new Map<string, WebAssembly.Module>();

  private readonly isWorker: boolean;
  private readonly isIsolated: boolean;
  private readonly isSSR: boolean;

  public state = $state({
    url: '',
    isLoading: false,
    progress: 0,
    error: null as string | null,
    wasiModule: null as WasiModule | null,
    progressHistory: [] as number[],

    //Dynamic state variables(these shouldn't change value after finish loading linked wasm file
		//(should save some cpu cycles once wasm loaded)
    isReady = !this.isLoading && this.error === null && !!this.wasiModule;
		exports = this.wasiModule?.exports ?? {};
		
    get memory() {
      return this.wasiModule?.memory ?? null;
    },
		
    get hasError() {
      return this.error !== null;
    },
		
  });
	
	function isWasmReady() {
		return !this.isLoading && this.error === null && !!this.wasiModule;
	}
	 
	function getExports() {
		return this.wasiModule?.exports ?? {};
	}
	
  constructor() {
    this.isWorker = typeof self !== 'undefined'
                 && typeof WorkerGlobalScope !== 'undefined'
                 && self instanceof WorkerGlobalScope;
    this.isIsolated = typeof SharedArrayBuffer !== 'undefined';
    this.isSSR      = typeof window === 'undefined';
	}

  get url()             { return this.state.url; }
  get isLoading()       { return this.state.isLoading; }
  get progress()        { return this.state.progress; }
  get error()           { return this.state.error; }
  get wasiModule()      { return this.state.wasiModule; }
  get progressHistory() { return this.state.progressHistory; }

  // --- Approach 01: streaming instantiate + WASI ---
  private async IsoStreamingApproach(): Promise<boolean> {
    const url = this.state.url;
    wasiDebugLog(`Fetching WASM via streaming instantiate`, 'info');
    this.state.progress = 10;

    const { WASI }   = await import('@wasmer/wasi');
    const { WasmFs } = await import('@wasmer/wasmfs');

    const resp  = await fetch(url);
    const bytes = await resp.arrayBuffer();
    this.state.progress = 50;

    const wasmFs = new WasmFs();
    const wasi   = new WASI({
      args: [], env: {},
      bindings: { ...WASI.defaultBindings, fs: wasmFs.fs }
    });

    const { instance } = await WebAssembly.instantiate(bytes, {
      wasi_snapshot_preview1: wasi.wasiImport
    });
    wasi.setMemory(instance.exports.memory);

    this.state.wasiModule = { instance, exports: instance.exports, memory: instance.exports.memory };
    this.state.progress   = 100;
    this.state.isLoading  = false;
    wasiDebugLog(`WASM loaded via Approach 01`, 'info');
    return true;
  }

  // --- Approach 02: compile & instantiate manually ---
  private async IsoCompileInstantiateApproach(): Promise<boolean> {
    const url = this.state.url;
    wasiDebugLog(`Falling back to manual compile & instantiate`, 'info');
    this.state.progress = 5;

    const { WASI }   = await import('@wasmer/wasi');
    const { WasmFs } = await import('@wasmer/wasmfs');

    const resp     = await fetch(url);
    const wasmBuf  = await resp.arrayBuffer();
    this.state.progress = 40;

    const module   = await WebAssembly.compile(wasmBuf);
    this.state.progress = 60;

    const wasmFs2 = new WasmFs();
    const wasi2   = new WASI({
      args: [], env: {},
      bindings: { ...WASI.defaultBindings, fs: wasmFs2.fs }
    });

    const { instance } = await WebAssembly.instantiate(module, {
      wasi_snapshot_preview1: wasi2.wasiImport
    });
    wasi2.setMemory(instance.exports.memory);

    this.state.wasiModule = { instance, exports: instance.exports, memory: instance.exports.memory };
    this.state.progress   = 100;
    this.state.isLoading  = false;
    wasiDebugLog(`WASM loaded via Approach 02`, 'info');
    return true;
  }

  // --- Node/SSR fallback ---
  private async NonNodeSSRApproach(): Promise<boolean> {
    const url = this.state.url;
    wasiDebugLog(`Non-isolated SSR; using fs.readFile`, 'warn');

    const fs        = await import('fs/promises');
    const wasmBuf   = await fs.readFile(new URL(url, import.meta.url));

    const { WASI } = await import('@wasmer/wasi-node');
    const wasi     = new WASI({ args: [], env: {} });

    const { instance } = await WebAssembly.instantiate(wasmBuf, {
      wasi_snapshot_preview1: wasi.wasiImport
    });
    wasi.start(instance);

    this.state.wasiModule = { instance, exports: instance.exports, memory: instance.exports.memory };
    this.state.progress   = 100;
    this.state.isLoading  = false;
    return true;
  }

  // --- Worker offload fallback ---
  private async NonIsoWorkerApproach(): Promise<boolean> {
    const url = this.state.url;
    wasiDebugLog(`Spawning worker approach`, 'info');

    const worker = new Worker(new URL('./wasiWorker.ts', import.meta.url), { type: 'module' });
    worker.postMessage({ url });

    const result: any = await new Promise(resolve => {
      worker.onmessage = e => resolve(e.data);
    });
    if (result.error) throw new Error(result.error);

    this.state.wasiModule = {
      instance: { exports: result.exports },
      exports: result.exports,
      memory: result.memory
    };
    this.state.progress  = 100;
    this.state.isLoading = false;
    return true;
  }

  // --- Fallback: simple fetch + minimal imports ---
  private async NonIsoFallbackApproach(): Promise<boolean> {
    const url = this.state.url;
    wasiDebugLog(`Non-isolated fallback; simple loader`, 'warn');

    const bytes    = await fetch(url).then(r => r.arrayBuffer());
    const module   = await WebAssembly.compile(bytes);
    const instance = await WebAssembly.instantiate(module, {
      wasi_snapshot_preview1: this.createMinimalWasiImports()
    });

    this.state.wasiModule = { instance, exports: instance.exports, memory: instance.exports.memory };
    this.state.progress   = 100;
    this.state.isLoading  = false;
    return true;
  }

	/**
	 * Returns a promise that resolves to the correct WebAssembly imports
	 * object for your environment.
	 */
	private async resolveWasiImportsBasedOnEnv(): Promise<WebAssembly.Imports> {
		// Worker path: delegate instantiation to your worker logic
		if (this.state.isWorker) {
			// If you serialize the module and imports to a worker, you might not
			// need imports here—your worker thread can rehydrate them.
			return { wasi_snapshot_preview1: this.createWorkerWasiImports() };
		}

		// Cross-origin isolated browsers: try streaming first, then compile
		if (this.state.isIsolated) {
			const { WASI }   = await import('@wasmer/wasi');
			const { WasmFs } = await import('@wasmer/wasmfs');
			const wasmFs     = new WasmFs();
			const wasi       = new WASI({
				args: [], env: {},
				bindings: { ...WASI.defaultBindings, fs: wasmFs.fs }
			});
			return { wasi_snapshot_preview1: wasi.wasiImport };
		}

		// Node/SSR path
		if (this.state.isSSR) {
			const { WASI } = await import('@wasmer/wasi-node');
			const wasi     = new WASI({ args: [], env: {} });
			return { wasi_snapshot_preview1: wasi.wasiImport };
		}

		// Non-isolated browser fallback
		return { wasi_snapshot_preview1: this.createMinimalWasiImports() };
	}

	// stream-instantiate the compiled module
	private async instantiateWithIsolatedMod(module: WebAssembly.Module): Promise<boolean> {
		this.state.progress = 10;
		const { WASI }   = await import('@wasmer/wasi');
		const { WasmFs } = await import('@wasmer/wasmfs');
		const wasmFs = new WasmFs();
		const wasi   = new WASI({ args: [], env: {}, bindings: { ...WASI.defaultBindings, fs: wasmFs.fs } });
		const { instance } = await WebAssembly.instantiate(module, {
			wasi_snapshot_preview1: wasi.wasiImport
		});
		wasi.setMemory(instance.exports.memory);
		this.state.wasiModule = { instance, exports: instance.exports, memory: instance.exports.memory };
		this.state.isLoading  = false;
		this.state.progress   = 100;
		return true;
	}

	private async instantiateCachedModule(
		module: WebAssembly.Module,
		wasiImports: WebAssembly.Imports
	): Promise<boolean> {
		try {
			const { instance } = await WebAssembly.instantiate(module, wasiImports);
			this.state.wasiModule = {
				instance,
				exports: instance.exports,
				memory: instance.exports.memory
			};
			this.state.progress  = 100;
			this.state.isLoading = false;
			return true;
		}
		catch (err: any) {
			this.state.error     = String(err);
			this.state.isLoading = false;
			captureError(err instanceof Error ? err : new Error(String(err)), 'WASI-Loader');
			return false;
		}
	}

	// Node/SSR instantiate
	private async instantiateNodeWasi(module: WebAssembly.Module): Promise<boolean> {
		const { WASI: NodeWASI } = await import('@wasmer/wasi-node');
		const wasi = new NodeWASI({ args: [], env: {} });

		const { instance } = await WebAssembly.instantiate(module, {
			wasi_snapshot_preview1: wasi.wasiImport
		});
		wasi.start(instance);

		this.state.wasiModule = { instance, exports: instance.exports, memory: instance.exports.memory };
		this.state.progress   = 100;
		this.state.isLoading  = false;
		return true;
	}

	// minimal fallback instantiate
	private async instantiateMinimal(module: WebAssembly.Module): Promise<boolean> {
		const instance = await WebAssembly.instantiate(module, {
			wasi_snapshot_preview1: this.createMinimalWasiImports()
		});

		this.state.wasiModule = { instance, exports: instance.exports, memory: instance.exports.memory };
		this.state.progress   = 100;
		this.state.isLoading  = false;
		return true;
	}

	// worker-based instantiate (reuse your existing logic, swapping in `module`)
	private async NonIsoWorkerInstantiate(module: WebAssembly.Module): Promise<boolean> {
			const url = this.state.url;
			wasiDebugLog(`Spawning worker approach`, 'info');

			//Should I have separate worker file for reusing module?
			const worker = new Worker(new URL('./wasiWorker.ts', import.meta.url), { type: 'module' });
			worker.postMessage({ url });

			const result: any = await new Promise(resolve => {
				worker.onmessage = e => resolve(e.data);
			});
			if (result.error) throw new Error(result.error);

			this.state.wasiModule = module;
			this.state.progress  = 100;
			this.state.isLoading = false;
			return true;
	}

	private async instantiateModule(
		module: WebAssembly.Module
	): Promise<boolean> {
		wasiDebugLog('Instantiating cached WASM module', 'info');

		try {
			if (this.state.isWorker) {
				// Delegate to your existing worker‐based approach
				return await this.NonIsoWorkerInstantiate(module);
			}
			else if (this.state.isIsolated) {
				// Use Wasmer streaming if available, else compile & instantiate
				return await this.instantiateWithIsolatedMod(module);
			}
			else if (this.state.isSSR) {
				// SSR / Node path
				return await this.instantiateNodeWasi(module);
			}
			else {
				// Fallback minimal imports
				return await this.instantiateMinimal(module);
			}
		}
		catch (err) {
			this.state.error     = String(err);
			this.state.isLoading = false;
			captureError(err, 'WASI-Loader');
			wasmLog.error(`❌ Cached instantiation failed: ${err}`, 'WasiLoader');
			return false;
		}
	}


  /**
   * Load or reuse a WASM module identified by `key`.
   * If already compiled, instantiate immediately.
   * Otherwise fetch, compile, cache, then instantiate.
   */
  public async loadWasm(key: string, url: string): Promise<boolean> {
    this.reset();
    this.state.url = url;
    try {
      let module: WebAssembly.Module;

      // 1) Reuse cached compile if available
      if (WasiLoader.moduleRegistry.has(key)) {
				const module = WasiLoader.moduleRegistry.get(key)!;
				wasiDebugLog(`Reusing compiled module for "${key}"`, 'info');

				try {
					// Worker offload
					if (this.state.isWorker) {
						return await this.NonIsoWorkerInstantiate(module);
					}
					// Cross-origin isolated (WASI streaming first, then compile fallback)
					else if (this.state.isIsolated) {
						try {
							return await this.instantiateWithIsolatedMod(module);
						}
						catch {
              const imports = this.resolveWasiImportsBasedOnEnv(isWorker, isIsolated, isSSR);
              return await this.instantiateCachedModule(module, imports);
						}
					}
					// Server-side (Node) path
					else if (this.state.isSSR) {
						return await this.instantiateNodeWasi(module);
					}
					// Non-isolated browser fallback
					else {
						return await this.instantiateMinimal(module);
					}
				}
				catch (err: any) {
					this.state.error     = String(err);
					this.state.isLoading = false;
					captureError(err instanceof Error ? err : new Error(String(err)), 'WASI-Loader');
					wasmLog.error(`❌ Cached instantiation failed: ${err}`, 'WasiLoader');
					return false;
				}
        wasiDebugLog(`Reusing compiled module for "${key}"`, 'info');
        module = WasiLoader.moduleRegistry.get(key)!;

        // 3) Instantiate via your preferred approach (streaming vs. minimal, based on isolation)
        const { WASI }   = await import('@wasmer/wasi');
        const { WasmFs } = await import('@wasmer/wasmfs');
  
        const wasmFs = new WasmFs();
        const wasi   = new WASI({
          args: [], env: {},
          bindings: { ...WASI.defaultBindings, fs: wasmFs.fs }
        });
  
        wasiDebugLog(`Instantiating WASM for "${key}"`, 'info');
        const { instance } = await WebAssembly.instantiate(module, {
          wasi_snapshot_preview1: wasi.wasiImport
        });
        wasi.setMemory(instance.exports.memory);
  
        this.state.wasiModule = {
          instance,
          exports: instance.exports,
          memory: instance.exports.memory
        };
  
        this.state.progress   = 100;
        this.state.isLoading  = false;
        wasiDebugLog(`WASM instantiated for "${key}"`, 'info');
        return true;
      }
      // 2) Else fetch & compile
      else {
        try {
          if (isWorker) {
            return await this.NonIsoWorkerApproach();
          }
          else if (isIsolated) {
            try {
              return await this.IsoStreamingApproach();
            }
            catch {
              return await this.IsoCompileInstantiateApproach();
            }
          }
          else if (isSSR) {
            return await this.NonNodeSSRApproach();
          }
          else {
            return await this.NonIsoFallbackApproach();
          }
          WasiLoader.moduleRegistry.set(key, module);
          this.state.progress   = 100;
          this.state.isLoading  = false;
          wasiDebugLog(`WASM instantiated for "${key}"`, 'info');
          return true;
        }
        catch (err: any) {
          const msg = String(err);
          this.state.error     = msg;
          this.state.isLoading = false;
          captureError(err instanceof Error ? err : new Error(msg), 'WASI-Loader');
          wasmLog.error(`❌ WASI load failed: ${msg}`, 'WasiLoader');
          return false;
        }
      }
    }
    catch (err: any) {
      this.state.error     = String(err);
      this.state.isLoading = false;
      wasmLog.error(`❌ loadWasiModule("${key}") failed: ${err}`, 'WasiLoader');
      captureError(err instanceof Error ? err : new Error(String(err)), 'WASI-Loader');
      return false;
    }
  }
}

  // Create minimal WASI imports for basic functionality
  private createMinimalWasiImports() {
    return {
      proc_exit:   (c: number) => console.log(`WASI exit ${c}`),
      fd_write:    () => 0,
      fd_close:    () => 0,
      fd_seek:     () => 0,
      path_open:   () => 8,
      random_get:  () => 0,
      clock_time_get: () => 0,
      environ_sizes_get: () => 0,
      environ_get:        () => 0,
      args_sizes_get:     () => 0,
      args_get:           () => 0
    };
  }

  /**
   * Get a specific export from the WASI module
   */
  getExport(name: string) {
    if (!this.state.wasiModule) throw new Error('WASI module not loaded');
    return this.state.wasiModule.exports[name];
  }

  /**
   * Call a WASI exported function
   */
  callFunction(name: string, ...args: any[]) {
    const fn = this.getExport(name);
    if (typeof fn !== 'function') throw new Error(`'${name}' is not a function`);
    try {
      wasmLog.info(`Calling WASI function: ${name}`, 'WasiLoader');
      return fn(...args);
    } catch (e) {
      const msg = `Error calling '${name}': ${e}`;
      wasmLog.error(msg, 'WasiLoader');
      throw new Error(msg);
    }
  }

  /**
   * Read memory from the WASI module
   */
  readMemory(offset: number, len: number) {
    const mem = this.state.wasiModule?.memory;
    if (!mem) throw new Error('Memory unavailable');
    return new Uint8Array(mem.buffer).slice(offset, offset + len);
  }

  /**
   * Reset the WASI loader state
   */
  reset() {
    this.state.url            = '';
    this.state.isLoading      = false;
    this.state.progress       = 0;
    this.state.error          = null;
    this.state.wasiModule     = null;
    this.state.progressHistory= [];
  }
}
