import { randomUUID } from 'node:crypto'

export default defineEventHandler((event) => {
  const incoming = getHeader(event, 'x-request-id')
  const requestId = incoming && /^[A-Za-z0-9-]{8,64}$/.test(incoming)
    ? incoming
    : randomUUID()
  event.context.requestId = requestId
  setHeader(event, 'X-Request-Id', requestId)
})
