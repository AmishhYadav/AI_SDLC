import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

// Accepts only UUID-format strings; rejects everything else (log injection prevention).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractSafeTraceId(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const candidate = raw.trim().slice(0, 128);
  return UUID_RE.test(candidate) ? candidate : undefined;
}

// W3C Trace Context: {version}-{trace-id}-{parent-id}-{flags}
// Extract segment [1] (32-char hex trace-id) and convert to UUID format.
function extractTraceparentId(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const parts = header.split('-');
  const traceHex = parts[1];
  if (!traceHex) return undefined;
  // Convert 32-char hex trace-id to UUID format (8-4-4-4-12)
  if (!/^[0-9a-f]{32}$/i.test(traceHex)) return undefined;
  return `${traceHex.slice(0, 8)}-${traceHex.slice(8, 12)}-${traceHex.slice(12, 16)}-${traceHex.slice(16, 20)}-${traceHex.slice(20)}`;
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request & { traceId?: string }, _res: Response, next: NextFunction): void {
    const rawId =
      extractSafeTraceId(req.headers['x-request-id'] as string | undefined) ??
      extractTraceparentId(req.headers['traceparent'] as string | undefined);

    req.traceId = rawId ?? crypto.randomUUID();
    next();
  }
}
