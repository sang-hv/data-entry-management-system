import { randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'
import type { ActionContext, Actor } from '../actions/_base/context'
import { ActionError, UnauthorizedError } from '../actions/_base/errors'

const COOKIE_NAME = 'session_token'

export function getRequestId(event: H3Event): string {
  return (event.context.requestId as string | undefined) ?? randomUUID()
}

export function buildContext(event: H3Event): ActionContext {
  const user = event.context.user as Actor | null | undefined
  return {
    actor: user ?? null,
    source: 'ui',
    requestId: getRequestId(event),
    idempotencyKey: getHeader(event, 'idempotency-key') ?? undefined,
  }
}

export function requireAuth(event: H3Event): Actor {
  const user = event.context.user as Actor | null | undefined
  if (!user) throw new UnauthorizedError()
  return user
}

export function setSessionCookie(event: H3Event, token: string, expiresAt: Date) {
  setCookie(event, COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })
}

export function clearSessionCookie(event: H3Event) {
  deleteCookie(event, COOKIE_NAME, { path: '/' })
}

export function getSessionToken(event: H3Event): string | null {
  return getCookie(event, COOKIE_NAME) ?? null
}

/**
 * Translate ActionError / Zod errors into H3 errors with a consistent envelope.
 * Always throws — never returns.
 */
export function toHttpError(err: unknown): never {
  if (err instanceof ActionError) {
    throw createError({
      statusCode: err.httpStatus,
      statusMessage: err.code,
      data: {
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      },
    })
  }
  // Zod errors expose `issues`.
  if (err && typeof err === 'object' && 'issues' in err) {
    throw createError({
      statusCode: 400,
      statusMessage: 'VALIDATION',
      data: {
        error: {
          code: 'VALIDATION',
          message: 'Validation failed',
          details: (err as { issues: unknown }).issues,
        },
      },
    })
  }
  throw err
}
