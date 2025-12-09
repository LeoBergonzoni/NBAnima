declare module '@netlify/functions' {
  export interface HandlerEvent {
    [key: string]: unknown;
  }
  export interface HandlerContext {
    [key: string]: unknown;
  }
  export type Handler = (
    event: HandlerEvent,
    context: HandlerContext,
  ) =>
    | Promise<{ statusCode: number; headers?: Record<string, string>; body?: string }>
    | { statusCode: number; headers?: Record<string, string>; body?: string };
}
