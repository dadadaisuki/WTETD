import { createApiRouter } from '../../server/api/router.js'

const router = createApiRouter(process.env)

const parseBody = (rawBody) => {
  if (!rawBody) {
    return undefined
  }

  try {
    return JSON.parse(rawBody)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON body.'
    const parseError = new Error(message)
    parseError.name = 'JsonParseError'
    throw parseError
  }
}

export const handler = async (event) => {
  try {
    const pathname = event.path || '/api'
    const body = parseBody(event.body)
    const result = await router.handle({
      method: event.httpMethod || 'GET',
      pathname,
      body,
    })

    return {
      statusCode: result.status,
      headers: result.headers,
      body: result.body,
    }
  } catch (error) {
    const isJsonError = error instanceof Error && error.name === 'JsonParseError'

    return {
      statusCode: isJsonError ? 400 : 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({
        message: isJsonError
          ? `Invalid JSON request body: ${error.message}`
          : (error instanceof Error ? error.message : 'Unknown function error.'),
      }),
    }
  }
}
