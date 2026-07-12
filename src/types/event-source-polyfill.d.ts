declare module 'event-source-polyfill' {
  export interface EventSourcePolyfillInit {
    withCredentials?: boolean;
    headers?: Record<string, string>;
    heartbeatTimeout?: number;
    [key: string]: unknown;
  }

  export class EventSourcePolyfill {
    constructor(url: string, options?: EventSourcePolyfillInit);
    addEventListener(type: string, listener: (event: MessageEvent) => void): void;
    removeEventListener(type: string, listener: (event: MessageEvent) => void): void;
    close(): void;
    readonly readyState: number;
    readonly url: string;
  }
}
