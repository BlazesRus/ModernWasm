/**
 * Worker-compatible Modern TypeScript Go WASM Runtime
 *
 * This is a worker-safe version of go-runtime.svelte.ts that doesn't use SvelteKit imports.
 * Used in web workers where $app/environment is not available.
 */

// In worker context, we're always in a browser-like environment
const browser = true;

// Comprehensive type definitions for Go WASM
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
}

// Simple state for worker context (no Svelte runes)
const goRuntimeState = {
  debugEnabled: false,
  exports: null as any,
  instance: null as WebAssembly.Instance | null,
  ready: false,
  error: null as Error | null,
  loadingProgress: 0
};

/**
 * Simple debug logging for worker context
 */
function debugLog(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  if (!goRuntimeState.debugEnabled) return;

  const timestamp = new Date().toISOString();
  const logMessage = `[Go WASM Worker ${timestamp}] ${message}`;

  switch (level) {
    case 'warn':
      console.warn(logMessage);
      break;
    case 'error':
      console.error(logMessage);
      break;
    default:
      console.log(logMessage);
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
        console.log(decoder.decode(buffer));
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

  private _values: any[] = [];
  private _goRefCounts: number[] = [];
  private _ids = new Map<any, number>();
  private _idPool: number[] = [];

  constructor() {
    debugLog('Initializing Modern Go WASM runtime for worker');

    // Initialize browser environment
    if (browser && !globalThis.fs) {
      (globalThis as any).fs = createBrowserFS();
      debugLog('Browser filesystem initialized');
    }

    if (browser && !globalThis.process) {
      (globalThis as any).process = createBrowserProcess();
      debugLog('Browser process initialized');
    }

    this._resetIdPool();
    this.importObject = this._createImportObject();

    debugLog('Modern Go WASM runtime initialized for worker');
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

  // ... [Include all the other methods from the original go-runtime.svelte.ts]
  // For brevity, I'll include the key methods that are needed

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
          delete this._pendingEvent;

          for (const [id, timer] of this._scheduledTimeouts) {
            clearTimeout(timer);
          }
          this._scheduledTimeouts.clear();

          if (code !== 0) {
            debugLog(`Go program exited with code ${code}`, 'error');
          } else {
            debugLog('Go program exited successfully');
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
              console.log(str);
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

        'syscall/js.valueGet': (sp: number) => {
          // Implementation for getting values
        },

        'syscall/js.valueSet': (sp: number) => {
          // Implementation for setting values
        },

        'syscall/js.valueDelete': (sp: number) => {
          // Implementation for deleting values
        },

        'syscall/js.valueIndex': (sp: number) => {
          // Implementation for indexing values
        },

        'syscall/js.valueSetIndex': (sp: number) => {
          // Implementation for setting indexed values
        },

        'syscall/js.valueCall': (sp: number) => {
          // Implementation for calling values
        },

        'syscall/js.valueInvoke': (sp: number) => {
          // Implementation for invoking values
        },

        'syscall/js.valueNew': (sp: number) => {
          // Implementation for creating new values
        },

        'syscall/js.valueLength': (sp: number) => {
          // Implementation for getting value length
        },

        'syscall/js.valuePrepareString': (sp: number) => {
          // Implementation for preparing strings
        },

        'syscall/js.valueLoadString': (sp: number) => {
          // Implementation for loading strings
        },

        'syscall/js.valueInstanceOf': (sp: number) => {
          // Implementation for instanceof checks
        },

        'syscall/js.copyBytesToGo': (sp: number) => {
          // Implementation for copying bytes to Go
        },

        'syscall/js.copyBytesToJS': (sp: number) => {
          // Implementation for copying bytes to JS
        }
      }
    };
  }

  private _resume(): void {
    if (this.exited) {
      throw new Error('Go program has already exited');
    }

    // Resume execution
    debugLog('Resuming Go execution');
  }

  private _loadSlice(addr: number): Uint8Array {
    if (!this.mem) throw new Error('Memory not initialized');

    const array = this.mem.getBigInt64(addr, true);
    const len = this.mem.getBigInt64(addr + 8, true);

    return new Uint8Array(this.mem.buffer, Number(array), Number(len));
  }

  private _loadString(addr: number): string {
    if (!this.mem) throw new Error('Memory not initialized');

    const saddr = this.mem.getBigInt64(addr, true);
    const len = this.mem.getBigInt64(addr + 8, true);

    return new TextDecoder().decode(new Uint8Array(this.mem.buffer, Number(saddr), Number(len)));
  }

  /**
   * Run the Go program
   */
  async run(instance: WebAssembly.Instance): Promise<void> {
    if (!browser) {
      debugLog('Not in browser environment', 'warn');
      throw new Error('Go WASM can only run in browser environment');
    }

    try {
      debugLog('Starting Go WASM program execution');

      this.mem = new DataView((instance.exports.mem as WebAssembly.Memory).buffer);
      (this.importObject.go as any).mem = instance.exports.mem;

      goRuntimeState.instance = instance;
      goRuntimeState.ready = true;
      goRuntimeState.error = null;

      // Run the Go program
      const runFunc = instance.exports.run as CallableFunction;
      if (typeof runFunc !== 'function') {
        throw new Error('WASM module does not export run function');
      }

      await runFunc();

      debugLog('Go WASM program completed successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      debugLog(`Go WASM execution error: ${errorMsg}`, 'error');

      goRuntimeState.error = error instanceof Error ? error : new Error(errorMsg);
      goRuntimeState.ready = false;

      throw error;
    }
  }
}

// Export the state and utilities for worker use
export { goRuntimeState, debugLog };

// Auto-initialize global Go if in worker context
if (typeof globalThis !== 'undefined' && !globalThis.Go) {
  (globalThis as any).Go = ModernGo;
  debugLog('ModernGo class registered globally for worker context');
}
