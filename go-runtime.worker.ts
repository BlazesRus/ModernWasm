/**
 * Worker-compatible Modern TypeScript Go WASM Runtime
 *
 * This is a worker-safe version of go-runtime.svelte that doesn't use SvelteKit imports.
 * Used in web workers where $app/environment and Svelte runes are not available.
 * Based on the main go-runtime.svelte but with plain JavaScript state management.
 */

// Worker context doesn't have access to debugLogger from main thread
// Simple console-based logging for workers
function addDebugMessage(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;

  switch (level) {
    case 'error':
      console.error(logMessage);
      break;
    case 'warn':
      console.warn(logMessage);
      break;
    default:
      console.log(logMessage);
  }
}

function captureError(error: Error, context: string) {
  console.error(`[${context}]`, error);
}

// In worker context, we're always in a browser-like environment
const browser = true;

// Comprehensive type definitions for Go WASM (same as main version)
export interface GoInstance {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
  env: Record<string, string>;
  argv: string[];
  _pendingEvent?: any;
  _scheduledTimeouts?: Map<number, any>;
  _nextCallbackTimeoutID?: number;
  exited?: boolean;
  mem?: DataView;
  _values?: any[];
  _goRefCounts: number[];
  _ids: Map<any, number>;
  _idPool: number[];
  _inst?: WebAssembly.Instance;
  _resolveExitPromise?: (value?: any) => void;
}

/**
 * Worker Manager State Interface
 */
export interface WorkerManagerState {
  isInitialized: boolean;
  isRunning: boolean;
  hasExited: boolean;
  error: string | null;
  debugEnabled: boolean;
  logs: string[];
  exports: Record<string, any>;
  memoryUsage: number;
  lastOperation: string | null;
  _wasmInstance: WebAssembly.Instance | null;
}

// Plain JavaScript state for worker context (no Svelte runes)
const workerState = {
  isInitialized: false,
  isRunning: false,
  hasExited: false,
  error: null as string | null,
  debugEnabled: true,
  logs: [] as string[],
  exports: {} as Record<string, any>,
  memoryUsage: 0,
  lastOperation: null as string | null,

  // internal place to stash the live WASM instance
  _wasmInstance: null as WebAssembly.Instance | null,

  // computed: spread-less copy of the live exports
  get rawExports(): Record<string, any> {
    return (this._wasmInstance?.exports as Record<string, any>) ?? {};
  },

  // computed property
  get isReady() {
    return this.isInitialized && this.isRunning && !this.hasExited && this.error === null;
  },

  // derived field built into the same state object
  get wasmExports() {
    return { ...this.exports };
  }
};

/**
 * Enhanced debug logging for worker context with reactive logs
 */
function debugLog(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  if (!workerState.debugEnabled) return;

  const timestamp = new Date().toISOString();
  const logMessage = `[Go WASM Worker ${timestamp}] ${message}`;

  // Add to reactive logs
  workerState.logs = [...workerState.logs, logMessage];
  if (workerState.logs.length > 50) {
    workerState.logs = workerState.logs.slice(-50);
  }

  switch (level) {
    case 'warn':
      addDebugMessage(`⚠️ Go Runtime Worker: ${message}`, 'warn');
      break;
    case 'error':
      addDebugMessage(`🚨 Go Runtime Worker: ${message}`, 'error');
      break;
    default:
      addDebugMessage(`ℹ️ Go Runtime Worker: ${message}`);
  }
}

/**
 * Modern Worker Manager for Go WASM Runtime
 *
 * This class provides a worker-safe implementation of the Go WASM runtime
 * with plain JavaScript state management (no Svelte runes).
 */
export class ModernWorkerManager {
  private state: WorkerManagerState;
  private goInstance: ModernGo;

  constructor() {
    this.state = {
      isInitialized: false,
      isRunning: false,
      hasExited: false,
      error: null,
      debugEnabled: true,
      logs: [],
      exports: {},
      memoryUsage: 0,
      lastOperation: null,
      _wasmInstance: null
    };

    this.goInstance = new ModernGo(this);
    this.debugLog('ModernWorkerManager initialized');
  }

  /**
   * Get current state (readonly copy)
   */
  getState(): Readonly<WorkerManagerState> {
    return { ...this.state };
  }

  /**
   * Check if runtime is ready
   */
  get isReady(): boolean {
    return this.state.isInitialized && this.state.isRunning && !this.state.hasExited && this.state.error === null;
  }

  /**
   * Get WASM exports
   */
  get wasmExports(): Record<string, any> {
    return { ...this.state.exports };
  }

  /**
   * Get raw exports directly from instance
   */
  get rawExports(): Record<string, any> {
    return (this.state._wasmInstance?.exports as Record<string, any>) ?? {};
  }

  /**
   * Enhanced debug logging for worker context with reactive logs
   */
  debugLog(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (!this.state.debugEnabled) return;

    const timestamp = new Date().toISOString();
    const logMessage = `[Go WASM Worker ${timestamp}] ${message}`;

    // Add to reactive logs
    this.state.logs = [...this.state.logs, logMessage];
    if (this.state.logs.length > 50) {
      this.state.logs = this.state.logs.slice(-50);
    }

    switch (level) {
      case 'warn':
        addDebugMessage(`⚠️ Go Runtime Worker: ${message}`, 'warn');
        break;
      case 'error':
        addDebugMessage(`🚨 Go Runtime Worker: ${message}`, 'error');
        break;
      default:
        addDebugMessage(`ℹ️ Go Runtime Worker: ${message}`);
    }
  }

  /**
   * Initialize the Go WASM runtime
   */
  async initialize(): Promise<void> {
    try {
      this.debugLog('Initializing Go WASM runtime');
      this.state.isInitialized = true;
      this.state.error = null;
      this.state.lastOperation = 'initialize';
      this.debugLog('Go WASM runtime initialized successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.state.error = errorMsg;
      this.state.isInitialized = false;
      this.debugLog(`Initialization failed: ${errorMsg}`, 'error');
      throw error;
    }
  }

  /**
   * Load and run WASM instance
   */
  async loadAndRun(wasmBytes: ArrayBuffer): Promise<void> {
    try {
      this.debugLog('Loading WASM module');

      const module = await WebAssembly.compile(wasmBytes);
      const instance = await WebAssembly.instantiate(module, this.goInstance.importObject);

      this.state._wasmInstance = instance;
      this.state.exports = { ...instance.exports };
      this.state.memoryUsage = (instance.exports.mem as WebAssembly.Memory).buffer.byteLength;
      this.state.lastOperation = 'load';

      this.debugLog('WASM module loaded, starting execution');
      await this.goInstance.run(instance);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.state.error = errorMsg;
      this.state.isRunning = false;
      this.debugLog(`Load and run failed: ${errorMsg}`, 'error');
      throw error;
    }
  }

  /**
   * Reset the runtime state
   */
  reset(): void {
    this.debugLog('Resetting Go WASM runtime');

    this.state.isInitialized = false;
    this.state.isRunning = false;
    this.state.hasExited = false;
    this.state.error = null;
    this.state.logs = [];
    this.state.exports = {};
    this.state.memoryUsage = 0;
    this.state.lastOperation = 'reset';
    this.state._wasmInstance = null;

    // Reset Go instance
    this.goInstance = new ModernGo(this);

    this.debugLog('Go WASM runtime reset completed');
  }

  /**
   * Update state from Go instance
   */
  updateState(updates: Partial<WorkerManagerState>): void {
    Object.assign(this.state, updates);
  }
}

// File system implementation for browser environment
function createBrowserFS() {
  const constants = {
    O_WRONLY: -1,
    O_RDWR: -1,
    O_CREAT: -1,
    O_TRUNC: -1,
    O_APPEND: -1,
    O_EXCL: -1
  };

  return {
    constants,
    writeSync(fd: number, buffer: Uint8Array): number {
      if (fd === 1) {
        // stdout
        const decoder = new TextDecoder();
        addDebugMessage(decoder.decode(buffer));
      } else if (fd === 2) {
        // stderr
        const decoder = new TextDecoder();
        console.error(decoder.decode(buffer));
      } else {
        throw new Error('Bad file descriptor');
      }
      return buffer.length;
    },
    write(fd: number, buffer: Uint8Array, offset: number, length: number, position: number | null, callback: Function) {
      if (offset !== 0 || length !== buffer.length || position !== null) {
        throw new Error('Not implemented');
      }
      try {
        const n = this.writeSync(fd, buffer);
        callback(null, n);
      } catch (err) {
        callback(err);
      }
    },
    chmod() {
      throw new Error('Not implemented');
    },
    chown() {
      throw new Error('Not implemented');
    },
    close() {
      throw new Error('Not implemented');
    },
    fchmod() {
      throw new Error('Not implemented');
    },
    fchown() {
      throw new Error('Not implemented');
    },
    fstat() {
      throw new Error('Not implemented');
    },
    fsync() {
      throw new Error('Not implemented');
    },
    ftruncate() {
      throw new Error('Not implemented');
    },
    lchown() {
      throw new Error('Not implemented');
    },
    link() {
      throw new Error('Not implemented');
    },
    lstat() {
      throw new Error('Not implemented');
    },
    mkdir() {
      throw new Error('Not implemented');
    },
    open() {
      throw new Error('Not implemented');
    },
    read() {
      throw new Error('Not implemented');
    },
    readdir() {
      throw new Error('Not implemented');
    },
    readlink() {
      throw new Error('Not implemented');
    },
    rename() {
      throw new Error('Not implemented');
    },
    rmdir() {
      throw new Error('Not implemented');
    },
    stat() {
      throw new Error('Not implemented');
    },
    symlink() {
      throw new Error('Not implemented');
    },
    truncate() {
      throw new Error('Not implemented');
    },
    unlink() {
      throw new Error('Not implemented');
    },
    utimes() {
      throw new Error('Not implemented');
    }
  };
}

// Process implementation for browser environment
function createBrowserProcess() {
  return {
    pid: 1,
    ppid: 0,
    platform: 'browser',
    arch: 'wasm',
    version: 'v1.0.0',
    env: {},
    argv: ['js'],
    cwd: () => '/',
    chdir: () => {
      throw new Error('Not implemented');
    },
    umask: () => {
      throw new Error('Not implemented');
    },
    getuid: () => -1,
    getgid: () => -1,
    geteuid: () => -1,
    getegid: () => -1,
    getgroups: () => {
      throw new Error('Not implemented');
    }
  };
}

/**
 * Modern Go class for WASM execution in worker context
 */
export class ModernGo implements GoInstance {
  public importObject: WebAssembly.Imports;
  public env: Record<string, string> = {};
  public argv: string[] = ['js'];
  public _pendingEvent?: any = null;
  public _scheduledTimeouts = new Map<number, any>();
  public _nextCallbackTimeoutID = 1;
  public exited = false;
  public mem?: DataView;

  public _values: any[] = [];
  public _goRefCounts: number[] = [];
  public _ids = new Map<any, number>();
  public _idPool: number[] = [];
  public _inst?: WebAssembly.Instance;
  public _resolveExitPromise?: (value?: any) => void;

  private manager: ModernWorkerManager;

  constructor(manager: ModernWorkerManager) {
    this.manager = manager;
    this.manager.debugLog('Initializing Modern Go WASM runtime for worker');

    // Initialize browser environment
    if (browser && !(globalThis as any).fs) {
      (globalThis as any).fs = createBrowserFS();
      this.manager.debugLog('Browser filesystem initialized');
    }

    if (browser && !globalThis.process) {
      (globalThis as any).process = createBrowserProcess();
      this.manager.debugLog('Browser process initialized');
    }

    this._resetIdPool();
    this.importObject = this._createImportObject();

    this.manager.debugLog('Modern Go WASM runtime initialized for worker');
  }

  private _resetIdPool(): void {
    this._values = [NaN, 0, null, true, false, globalThis, this];
    this._goRefCounts = new Array(this._values.length).fill(Infinity);
    this._ids.clear();
    this._idPool = [];

    let id = this._values.length;
    for (let i = 0; i < 8; i++) {
      this._idPool.push(id++);
    }
  }

  private _createImportObject(): WebAssembly.Imports {
    return {
      go: {
        // Runtime.keepAlive
        'runtime.keepAlive': (sp: number) => {
          // Keep the program alive
        },

        // Runtime.wasmExit
        'runtime.wasmExit': (sp: number) => {
          if (!this.mem) return;

          const code = this.mem.getInt32(sp + 8, true);
          this.exited = true;

          // Update manager state
          this.manager.updateState({
            hasExited: true,
            isRunning: false,
            lastOperation: 'exit'
          });

          delete this._pendingEvent;

          for (const [id, timer] of this._scheduledTimeouts) {
            clearTimeout(timer);
          }
          this._scheduledTimeouts.clear();

          if (code !== 0) {
            this.manager.debugLog(`Go program exited with code ${code}`, 'error');
            this.manager.updateState({ error: `Program exited with code ${code}` });
          } else {
            this.manager.debugLog('Go program exited successfully');
          }

          // Resolve the exit promise
          if (this._resolveExitPromise) {
            this._resolveExitPromise(code);
          }
        },

        // Runtime.wasmWrite
        'runtime.wasmWrite': (sp: number) => {
          if (!this.mem) return;

          const fd = this.mem.getBigInt64(sp + 8, true);
          const p = this.mem.getBigInt64(sp + 16, true);
          const n = this.mem.getInt32(sp + 24, true);

          if (fd === 1n || fd === 2n) {
            // stdout or stderr
            const data = new Uint8Array(this.mem.buffer, Number(p), n);
            const str = new TextDecoder().decode(data);

            if (fd === 1n) {
              addDebugMessage(str);
            } else {
              console.error(str);
            }
          }

          this.mem.setInt32(sp + 32, n, true);
        },

        // Runtime.resetMemoryDataView
        'runtime.resetMemoryDataView': (sp: number) => {
          if (!this.mem) return;
          this.mem = new DataView((this.importObject.go as any).mem.buffer);
        },

        // Runtime.nanotime1
        'runtime.nanotime1': (sp: number) => {
          if (!this.mem) return;

          const nsec = BigInt(Math.floor(performance.now() * 1000000));
          this.mem.setBigInt64(sp + 8, nsec, true);
        },

        // Runtime.walltime
        'runtime.walltime': (sp: number) => {
          if (!this.mem) return;

          const msec = Date.now();
          const sec = Math.floor(msec / 1000);
          const nsec = (msec % 1000) * 1000000;

          this.mem.setBigInt64(sp + 8, BigInt(sec), true);
          this.mem.setInt32(sp + 16, nsec, true);
        },

        // Runtime.scheduleTimeoutEvent
        'runtime.scheduleTimeoutEvent': (sp: number) => {
          if (!this.mem) return;

          const id = this._nextCallbackTimeoutID++;
          const delay = this.mem.getBigInt64(sp + 8, true);

          this._scheduledTimeouts.set(
            id,
            setTimeout(() => {
              this._scheduledTimeouts.delete(id);
              this._resume();
            }, Number(delay))
          );

          this.mem.setInt32(sp + 16, id, true);
        },

        // Runtime.clearTimeoutEvent
        'runtime.clearTimeoutEvent': (sp: number) => {
          if (!this.mem) return;

          const id = this.mem.getInt32(sp + 8, true);
          const timer = this._scheduledTimeouts.get(id);

          if (timer) {
            clearTimeout(timer);
            this._scheduledTimeouts.delete(id);
          }
        },

        // Runtime.getRandomData
        'runtime.getRandomData': (sp: number) => {
          if (!this.mem) return;

          const slice = this._loadSlice(sp + 8);
          crypto.getRandomValues(slice);
        },

        // Add other required Go runtime functions...
        'syscall/js.finalizeRef': (sp: number) => {
          // Implementation for reference finalization
        },

        'syscall/js.stringVal': (sp: number) => {
          // Implementation for string values
        },

        // syscall/js.valueGet
        'syscall/js.valueGet': (sp: number) => {
          if (!this.mem) return;

          const v = this._loadValue(sp + 8);
          const p = this._loadString(sp + 16);
          const result = Reflect.get(v, p);
          this._storeValue(sp + 32, result);
        },

        // syscall/js.valueSet
        'syscall/js.valueSet': (sp: number) => {
          if (!this.mem) return;

          const v = this._loadValue(sp + 8);
          const p = this._loadString(sp + 16);
          const x = this._loadValue(sp + 32);
          Reflect.set(v, p, x);
        },

        // syscall/js.valueDelete
        'syscall/js.valueDelete': (sp: number) => {
          if (!this.mem) return;

          const v = this._loadValue(sp + 8);
          const p = this._loadString(sp + 16);
          Reflect.deleteProperty(v, p);
        },

        // syscall/js.valueIndex
        'syscall/js.valueIndex': (sp: number) => {
          if (!this.mem) return;

          const v = this._loadValue(sp + 8);
          const i = this.mem.getBigUint64(sp + 16, true);
          this._storeValue(sp + 24, Reflect.get(v, Number(i)));
        },

        // syscall/js.valueSetIndex
        'syscall/js.valueSetIndex': (sp: number) => {
          if (!this.mem) return;

          const v = this._loadValue(sp + 8);
          const i = this.mem.getBigUint64(sp + 16, true);
          const x = this._loadValue(sp + 24);
          Reflect.set(v, Number(i), x);
        },

        // syscall/js.valueCall
        'syscall/js.valueCall': (sp: number) => {
          if (!this.mem) return;

          try {
            const v = this._loadValue(sp + 8);
            const m = this._loadString(sp + 16);
            const args = this._loadSliceOfValues(sp + 32);
            const result = Reflect.apply(v[m], v, args);
            this._storeValue(sp + 56, result);
            this.mem.setUint8(sp + 64, 1);
          } catch (err) {
            this._storeValue(sp + 56, err);
            this.mem.setUint8(sp + 64, 0);
          }
        },

        // syscall/js.valueInvoke
        'syscall/js.valueInvoke': (sp: number) => {
          if (!this.mem) return;

          try {
            const v = this._loadValue(sp + 8);
            const args = this._loadSliceOfValues(sp + 16);
            const result = Reflect.apply(v, undefined, args);
            this._storeValue(sp + 40, result);
            this.mem.setUint8(sp + 48, 1);
          } catch (err) {
            this._storeValue(sp + 40, err);
            this.mem.setUint8(sp + 48, 0);
          }
        },

        // syscall/js.valueNew
        'syscall/js.valueNew': (sp: number) => {
          if (!this.mem) return;

          try {
            const v = this._loadValue(sp + 8);
            const args = this._loadSliceOfValues(sp + 16);
            const result = Reflect.construct(v, args);
            this._storeValue(sp + 40, result);
            this.mem.setUint8(sp + 48, 1);
          } catch (err) {
            this._storeValue(sp + 40, err);
            this.mem.setUint8(sp + 48, 0);
          }
        },

        // syscall/js.valueLength
        'syscall/js.valueLength': (sp: number) => {
          if (!this.mem) return;

          const v = this._loadValue(sp + 8);
          this.mem.setBigUint64(sp + 16, BigInt(v.length), true);
        },

        // syscall/js.valuePrepareString
        'syscall/js.valuePrepareString': (sp: number) => {
          if (!this.mem) return;

          const v = this._loadValue(sp + 8);
          const str = String(v);
          const encoder = new TextEncoder();
          const bytes = encoder.encode(str);
          this._storeValue(sp + 16, bytes);
          this.mem.setBigUint64(sp + 24, BigInt(bytes.length), true);
        },

        // syscall/js.valueLoadString
        'syscall/js.valueLoadString': (sp: number) => {
          if (!this.mem) return;

          const v = this._loadValue(sp + 8);
          const slice = this._loadSlice(sp + 16);
          const decoder = new TextDecoder();
          const str = decoder.decode(slice);
          this._storeValue(sp + 24, str);
        },

        // syscall/js.valueInstanceOf
        'syscall/js.valueInstanceOf': (sp: number) => {
          if (!this.mem) return;

          const v = this._loadValue(sp + 8);
          const t = this._loadValue(sp + 16);
          this.mem.setUint8(sp + 24, v instanceof t ? 1 : 0);
        },

        // syscall/js.copyBytesToGo
        'syscall/js.copyBytesToGo': (sp: number) => {
          if (!this.mem) return;

          const dst = this._loadSlice(sp + 8);
          const src = this._loadValue(sp + 32);
          const n = Math.min(dst.length, src.length);
          dst.set(src.subarray(0, n));
          this.mem.setBigUint64(sp + 40, BigInt(n), true);
        },

        // syscall/js.copyBytesToJS
        'syscall/js.copyBytesToJS': (sp: number) => {
          if (!this.mem) return;

          const dst = this._loadValue(sp + 8);
          const src = this._loadSlice(sp + 16);
          const n = Math.min(dst.length, src.length);
          dst.set(src.subarray(0, n));
          this.mem.setBigUint64(sp + 40, BigInt(n), true);
        },

        debug: (value: any) => {
          this.manager.debugLog(`Debug: ${value}`);
        }
      }
    };
  }

  private _ref(v: any): number {
    if (v === null) return 2;
    if (v === undefined) return 3;
    if (typeof v === 'boolean') return v ? 4 : 5;
    if (typeof v === 'number') return 1;
    if (typeof v === 'string') return 1;
    if (typeof v === 'symbol') {
      let id = this._ids.get(v);
      if (id === undefined) {
        id = this._idPool.pop();
        if (id === undefined) {
          id = this._values.length;
        }
        this._values[id] = v;
        this._goRefCounts[id] = 0;
        this._ids.set(v, id);
      }
      this._goRefCounts[id]!++;
      return id;
    }

    let id = this._ids.get(v);
    if (id === undefined) {
      id = this._idPool.pop();
      if (id === undefined) {
        id = this._values.length;
      }
      this._values[id] = v;
      this._goRefCounts[id] = 0;
      this._ids.set(v, id);
    }
    this._goRefCounts[id]!++;
    return id;
  }

  private _unref(id: number): void {
    this._goRefCounts[id]!--;
    if (this._goRefCounts[id] === 0) {
      const v = this._values[id];
      this._values[id] = null;
      this._ids.delete(v);
      this._idPool.push(id);
    }
  }

  private _loadValue(addr: number): any {
    if (!this.mem) throw new Error('Memory not initialized');

    const f = this.mem.getBigUint64(addr, true);
    if (f === 0n) return undefined;
    if (f === 1n) return null;

    return this._values[Number(f)];
  }

  private _storeValue(addr: number, v: any): void {
    if (!this.mem) throw new Error('Memory not initialized');

    const nanHead = 0x7ff80000;

    if (typeof v === 'number' && v !== 0) {
      if (isNaN(v)) {
        this.mem.setUint32(addr + 4, nanHead, true);
        this.mem.setUint32(addr, 0, true);
        return;
      }
      this.mem.setBigUint64(addr, BigInt(v), true);
      return;
    }

    if (v === undefined) {
      this.mem.setBigUint64(addr, 0n, true);
      return;
    }

    let id = this._ids.get(v);
    if (id === undefined) {
      id = this._idPool.pop();
      if (id === undefined) {
        id = this._values.length;
      }
      this._values[id] = v;
      this._goRefCounts[id] = 0;
      this._ids.set(v, id);
    }
    this._goRefCounts[id]!++;

    let typeFlag = 0;
    switch (typeof v) {
      case 'object':
        if (v !== null) {
          typeFlag = 1;
        }
        break;
      case 'string':
        typeFlag = 2;
        break;
      case 'symbol':
        typeFlag = 3;
        break;
      case 'function':
        typeFlag = 4;
        break;
    }
    this.mem.setUint32(addr + 4, nanHead | typeFlag, true);
    this.mem.setUint32(addr, id, true);
  }

  private _loadSlice(addr: number): Uint8Array {
    if (!this.mem) throw new Error('Memory not initialized');

    const array = this.mem.getBigUint64(addr, true);
    const len = this.mem.getBigUint64(addr + 8, true);

    return new Uint8Array(this.mem.buffer, Number(array), Number(len));
  }

  private _loadString(addr: number): string {
    if (!this.mem) throw new Error('Memory not initialized');

    const saddr = this.mem.getBigUint64(addr, true);
    const len = this.mem.getBigUint64(addr + 8, true);

    return new TextDecoder().decode(new Uint8Array(this.mem.buffer, Number(saddr), Number(len)));
  }

  private _loadSliceOfValues(addr: number): any[] {
    if (!this.mem) throw new Error('Memory not initialized');

    const array = this.mem.getBigUint64(addr, true);
    const len = this.mem.getBigUint64(addr + 8, true);
    const values: any[] = [];

    for (let i = 0; i < Number(len); i++) {
      values.push(this._loadValue(Number(array) + i * 8));
    }

    return values;
  }

  private _resume(): void {
    if (this.exited) {
      throw new Error('Go program has already exited');
    }

    if (!this._inst) {
      throw new Error('WebAssembly instance not available');
    }

    // Resume execution
    this.manager.debugLog('Resuming Go execution');
    (this._inst.exports.resume as Function)();

    if (this.exited && this._resolveExitPromise) {
      this._resolveExitPromise();
    }
  }

  private _makeFuncWrapper(id: number): Function {
    const go = this;
    return function (this: any, ...args: any[]) {
      const event: any = { id: id, this: this, args: args };
      go._pendingEvent = event;
      go._resume();
      return event.result;
    };
  }

  /**
   * Run the Go program with enhanced reactive state management
   */
  async run(instance: WebAssembly.Instance): Promise<void> {
    if (!browser) {
      debugLog('Not in browser environment', 'warn');
      throw new Error('Go WASM can only run in browser environment');
    }

    try {
      this.manager.debugLog('Starting Go WASM program execution');

      // Initialize runtime state
      this.manager.updateState({
        isInitialized: true,
        isRunning: true,
        hasExited: false,
        error: null,
        lastOperation: 'run'
      });

      this.mem = new DataView((instance.exports.mem as WebAssembly.Memory).buffer);
      this._inst = instance;
      (this.importObject.go as any).mem = instance.exports.mem;

      // Store the instance in manager state
      this.manager.updateState({
        _wasmInstance: instance,
        memoryUsage: this.mem.buffer.byteLength,
        exports: { ...instance.exports }
      });

      // Set up environment variables
      this.env = {
        GOOS: 'js',
        GOARCH: 'wasm',
        GO_WASM_DEBUG: this.manager.getState().debugEnabled ? 'true' : 'false'
      };

      // Prepare arguments and call Go main
      let offset = 4096;
      const strPtr = (str: string): number => {
        const ptr = offset;
        const bytes = new TextEncoder().encode(str + '\0');
        new Uint8Array(this.mem!.buffer, offset, bytes.length).set(bytes);
        offset += bytes.length;
        if (offset % 8 !== 0) {
          offset += 8 - (offset % 8);
        }
        return ptr;
      };

      const argc = this.argv.length;
      const argvPtrs: number[] = [];
      this.argv.forEach(arg => {
        argvPtrs.push(strPtr(arg));
      });

      this.mem.setBigInt64(offset, BigInt(argc), true);
      this.mem.setBigInt64(offset + 8, BigInt(argvPtrs[0] || 0), true);

      // Create exit promise for proper cleanup
      const exitPromise = new Promise<void>(resolve => {
        this._resolveExitPromise = resolve;
      });

      // Start the Go program
      this.manager.debugLog('Calling Go main function');
      (instance.exports.run as Function)(offset, offset + 8);

      // Wait for program to exit
      await exitPromise;

      this.manager.debugLog('Go WASM program completed successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      captureError(error instanceof Error ? error : new Error(errorMsg), 'GoWasmExecution');

      this.manager.updateState({
        error: errorMsg,
        isRunning: false
      });

      throw error;
    }
  }
}

// Auto-initialize global Go if in worker context
if (typeof globalThis !== 'undefined' && !(globalThis as any).Go) {
  // Create a default manager for backwards compatibility
  const defaultManager = new ModernWorkerManager();
  (globalThis as any).Go = class extends ModernGo {
    constructor() {
      super(defaultManager);
    }
  };

  defaultManager.debugLog('ModernGo class registered globally for worker context');
}

// Export the utilities
export { debugLog };
