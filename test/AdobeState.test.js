/*
Copyright 2024 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

// @ts-nocheck
const { DEFAULT_ENV, PROD_ENV, STAGE_ENV } = require('@adobe/aio-lib-env')
const { HttpExponentialBackoff } = require('@adobe/aio-lib-core-networking')
const { AdobeState } = require('../lib/AdobeState')
const querystring = require('node:querystring')
const { Buffer } = require('node:buffer')
const { ALLOWED_REGIONS, HEADER_KEY_EXPIRES, MAX_TTL_SECONDS } = require('../lib/constants')

// constants //////////////////////////////////////////////////////////

const mockExponentialBackoff = jest.fn()
HttpExponentialBackoff.mockImplementation(() => {
  return {
    exponentialBackoff: mockExponentialBackoff
  }
})

const fakeCredentials = {
  apikey: 'some-api-key',
  namespace: 'some-namespace'
}

// helpers //////////////////////////////////////////////////////////

const wrapInFetchResponse = (body, options = {}) => {
  const emptyFunc = () => {}
  const { headersGet = emptyFunc } = options

  return {
    ok: true,
    headers: {
      get: headersGet
    },
    text: async () => body,
    json: async () => JSON.parse(body)
  }
}

const wrapInFetchError = (status, body) => {
  return {
    ok: false,
    headers: {
      get: () => 'fake-req-id'
    },
    json: async () => JSON.parse(body),
    text: async () => body,
    status
  }
}

// mocks //////////////////////////////////////////////////////////

const mockCLIEnv = jest.fn()

jest.mock('@adobe/aio-lib-core-networking')

jest.mock('@adobe/aio-lib-env', () => {
  return {
    ...jest.requireActual('@adobe/aio-lib-env'),
    getCliEnv: () => mockCLIEnv()
  }
})

// jest globals //////////////////////////////////////////////////////////

beforeEach(() => {
  delete process.env.AIO_STATE_ENDPOINT
  mockCLIEnv.mockReturnValue(DEFAULT_ENV)
  mockExponentialBackoff.mockReset()
})

// //////////////////////////////////////////////////////////

describe('init and constructor', () => {
  test('good credentials', async () => {
    const credentials = {
      apikey: 'some-api-key',
      namespace: 'some-namespace'
    }

    const store = await AdobeState.init(credentials)
    expect(store.apikey).toEqual(credentials.apikey)
    expect(store.namespace).toEqual(credentials.namespace)
    expect(store.endpoint).toBeDefined()
  })

  test('bad credentials (no apikey and no namespace)', async () => {
    await expect(AdobeState.init()).rejects
      .toThrow('[AdobeStateLib:ERROR_BAD_ARGUMENT] must have required properties: apikey, namespace')
  })

  test('bad credentials (no apikey)', async () => {
    const credentials = {
      namespace: 'some-namespace'
    }

    await expect(AdobeState.init(credentials)).rejects
      .toThrow('[AdobeStateLib:ERROR_BAD_ARGUMENT] must have required properties: apikey')
  })

  test('bad credentials (no namespace)', async () => {
    const credentials = {
      apikey: 'some-apikey'
    }

    await expect(AdobeState.init(credentials)).rejects
      .toThrow('[AdobeStateLib:ERROR_BAD_ARGUMENT] must have required properties: namespace')
  })
})

describe('get', () => {
  let store

  beforeEach(async () => {
    store = await AdobeState.init(fakeCredentials)
  })

  test('success', async () => {
    const key = 'valid-key'
    const fetchBody = 'foo'
    const expiryHeaderValue = '1707445350000'

    const options = {
      headersGet: (header) => {
        if (header === HEADER_KEY_EXPIRES) {
          return expiryHeaderValue
        }
      }
    }

    mockExponentialBackoff.mockResolvedValue(wrapInFetchResponse(fetchBody, options))

    const { value, expiration } = await store.get(key)
    expect(value).toEqual(fetchBody)
    expect(typeof expiration).toEqual('string')
    expect(expiration).toEqual(new Date(Number(expiryHeaderValue)).toISOString())
  })

  test('invalid key', async () => {
    const key = 'bad/key'

    await expect(store.get(key)).rejects.toThrow('[AdobeStateLib:ERROR_BAD_ARGUMENT] /key must match pattern "^[a-zA-Z0-9-_.]{1,1024}$"')
  })

  test('not found', async () => {
    const key = 'not-found-key'

    mockExponentialBackoff.mockResolvedValue(wrapInFetchError(404))

    const value = await store.get(key)
    expect(value).toEqual(undefined)
  })
})

describe('put', () => {
  let store

  beforeEach(async () => {
    store = await AdobeState.init(fakeCredentials)
  })

  test('success (string value) no ttl', async () => {
    const key = 'valid-key'
    const value = 'some-value'
    const fetchResponseJson = {}

    mockExponentialBackoff.mockResolvedValue(wrapInFetchResponse(fetchResponseJson))

    const returnKey = await store.put(key, value)
    expect(returnKey).toEqual(key)
  })

  test('success (string value) with ttl', async () => {
    const key = 'valid.for-those_chars'
    const value = 'some-value'
    const fetchResponseJson = {}

    mockExponentialBackoff.mockResolvedValue(wrapInFetchResponse(fetchResponseJson))

    const returnKey = await store.put(key, value, { ttl: 999 })
    expect(returnKey).toEqual(key)
  })

  test('failure (invalid key)', async () => {
    const key = 'invalid/key'
    const value = 'some-value'

    await expect(store.put(key, value)).rejects.toThrow('[AdobeStateLib:ERROR_BAD_ARGUMENT] /key must match pattern "^[a-zA-Z0-9-_.]{1,1024}$"')
  })

  test('failure (invalid ttl)', async () => {
    const key = 'key'
    const value = 'some-value'

    await expect(store.put(key, value, { ttl: 'string' })).rejects.toThrow('[AdobeStateLib:ERROR_BAD_ARGUMENT] /ttl must be integer')
    await expect(store.put(key, value, { ttl: 1.1 })).rejects.toThrow('[AdobeStateLib:ERROR_BAD_ARGUMENT] /ttl must be integer')

    await expect(store.put(key, value, { ttl: MAX_TTL_SECONDS + 1 })).rejects.toThrow('ttl must be <= 365 days (31536000s). Infinite TTLs (< 0) are not supported.')
    await expect(store.put(key, value, { ttl: -1 })).rejects.toThrow('ttl must be <= 365 days (31536000s). Infinite TTLs (< 0) are not supported.')
  })

  test('failure (binary value)', async () => {
    const key = 'valid-key'
    const value = Buffer.from([0x61, 0x72, 0x65, 0x26, 0x35, 0x55, 0xff])
    // NOTE: the server supports binary values, so way want to revisit this eventually
    await expect(store.put(key, value)).rejects.toThrow('[AdobeStateLib:ERROR_BAD_ARGUMENT] /value must be string')
  })

  test('coverage: 401 error', async () => {
    const key = 'some-key'
    const value = 'some-value'

    mockExponentialBackoff.mockResolvedValue(wrapInFetchError(401))
    await expect(store.put(key, value)).rejects.toThrow(
      expect.objectContaining({
        sdkDetails: expect.objectContaining({
          requestId: 'fake-req-id'
        }),
        message: '[AdobeStateLib:ERROR_UNAUTHORIZED] you are not authorized to access State service'
      }))
  })

  test('coverage: 403 error', async () => {
    const key = 'some-key'
    const value = 'some-value'

    mockExponentialBackoff.mockResolvedValue(wrapInFetchError(403))
    await expect(store.put(key, value)).rejects.toThrow(
      expect.objectContaining({
        sdkDetails: expect.objectContaining({
          requestId: 'fake-req-id'
        }),
        message: '[AdobeStateLib:ERROR_BAD_CREDENTIALS] cannot access State service, make sure your credentials are valid'
      }))
  })

  test('coverage: 413 error', async () => {
    const key = 'some-key'
    const value = 'some-value'

    mockExponentialBackoff.mockResolvedValue(wrapInFetchError(413))
    await expect(store.put(key, value)).rejects.toThrow(
      expect.objectContaining({
        sdkDetails: expect.objectContaining({
          requestId: 'fake-req-id'
        }),
        message: '[AdobeStateLib:ERROR_PAYLOAD_TOO_LARGE] key, value or request payload is too large State service'
      }))
  })

  test('coverage: 429 error', async () => {
    const key = 'some-key'
    const value = 'some-value'

    mockExponentialBackoff.mockResolvedValue(wrapInFetchError(429))
    await expect(store.put(key, value)).rejects.toThrow(
      expect.objectContaining({
        sdkDetails: expect.objectContaining({
          requestId: 'fake-req-id'
        }),
        message: '[AdobeStateLib:ERROR_REQUEST_RATE_TOO_HIGH] Request rate too high. Please retry after sometime.'
      }))
  })

  test('coverage: unknown server error', async () => {
    const key = 'some-key'
    const value = 'some-value'
    const responseBody = 'error: this is the response body'

    mockExponentialBackoff.mockResolvedValue(wrapInFetchError(500, responseBody))
    await expect(store.put(key, value)).rejects.toThrow(
      expect.objectContaining({
        sdkDetails: expect.objectContaining({
          requestId: 'fake-req-id'
        }),
        message: `[AdobeStateLib:ERROR_INTERNAL] unexpected response from State service with status: 500 body: ${responseBody}`
      }))
  })

  test('coverage: unknown error (fetch network failure)', async () => {
    const key = 'some-key'
    const value = 'some-value'

    const error = new Error('some network error')
    mockExponentialBackoff.mockRejectedValue(error)
    await expect(store.put(key, value)).rejects.toThrow(error.message)
  })
})

describe('delete', () => {
  let store

  beforeEach(async () => {
    store = await AdobeState.init(fakeCredentials)
  })

  test('success', async () => {
    const key = 'valid-key'
    const fetchResponseJson = {}

    mockExponentialBackoff.mockResolvedValue(wrapInFetchResponse(fetchResponseJson))

    const returnKey = await store.delete(key)
    expect(returnKey).toEqual(key)
  })

  test('not found', async () => {
    const key = 'not-found-key'

    mockExponentialBackoff.mockResolvedValue(wrapInFetchError(404))

    const value = await store.delete(key)
    expect(value).toEqual(null)
  })
})

describe('deleteAll', () => {
  let store

  beforeEach(async () => {
    store = await AdobeState.init(fakeCredentials)
  })

  test('success', async () => {
    const fetchResponseJson = {}
    mockExponentialBackoff.mockResolvedValue(wrapInFetchResponse(fetchResponseJson))

    const value = await store.deleteAll()
    expect(value).toEqual(true)
  })

  test('not found', async () => {
    mockExponentialBackoff.mockResolvedValue(wrapInFetchError(404))

    const value = await store.deleteAll()
    expect(value).toEqual(false)
  })
})

describe('stats()', () => {
  let store

  beforeEach(async () => {
    store = await AdobeState.init(fakeCredentials)
  })

  test('success', async () => {
    const fetchResponseJson = JSON.stringify({})
    mockExponentialBackoff.mockResolvedValue(wrapInFetchResponse(fetchResponseJson))

    const value = await store.stats()
    expect(value).toEqual({})
  })

  test('not found', async () => {
    mockExponentialBackoff.mockResolvedValue(wrapInFetchError(404))

    const value = await store.stats()
    expect(value).toEqual(false)
  })
})

describe('list()', () => {
  let store

  beforeEach(async () => {
    store = await AdobeState.init(fakeCredentials)
  })

  test('validation', async () => {
    expect(() => store.list({ match: 'illegalchar*!"' })).toThrow('must match')
    expect(() => store.list({ countHint: 'f' })).toThrow('must be integer')
    expect(() => store.list({ countHint: 99 })).toThrow('must be in the [100, 1000] range')
    expect(() => store.list({ countHint: 1001 })).toThrow('must be in the [100, 1000] range')
  })

  test('not found', async () => {
    mockExponentialBackoff.mockResolvedValue(wrapInFetchError(404))

    const it = store.list()
    expect(await it.next()).toEqual({ done: false, value: { keys: [] } })
    expect(await it.next()).toEqual({ done: true, value: undefined })

    let iters = 0
    for await (const { keys } of store.list()) {
      ++iters
      expect(keys).toStrictEqual([])
    }
    expect(iters).toBe(1)
  })

  test('1 iteration', async () => {
    const fetchResponseJson = JSON.stringify({
      keys: ['a', 'b', 'c'],
      cursor: 0
    })
    mockExponentialBackoff.mockResolvedValue(wrapInFetchResponse(fetchResponseJson))

    const it = store.list()
    expect(await it.next()).toEqual({ done: false, value: { keys: ['a', 'b', 'c'] } })
    expect(await it.next()).toEqual({ done: true, value: undefined })

    let iters = 0
    for await (const { keys } of store.list()) {
      ++iters
      expect(keys).toStrictEqual(['a', 'b', 'c'])
    }
    expect(iters).toBe(1)
  })

  test('list 3 iterations', async () => {
    const fetchResponseJson = JSON.stringify({
      keys: ['a', 'b', 'c'],
      cursor: 1
    })
    const fetchResponseJson2 = JSON.stringify({
      keys: ['d', 'e'],
      cursor: 2
    })
    const fetchResponseJson3 = JSON.stringify({
      keys: ['f'],
      cursor: 0
    })
    mockExponentialBackoff.mockResolvedValueOnce(wrapInFetchResponse(fetchResponseJson))
    mockExponentialBackoff.mockResolvedValueOnce(wrapInFetchResponse(fetchResponseJson2))
    mockExponentialBackoff.mockResolvedValueOnce(wrapInFetchResponse(fetchResponseJson3))

    const allKeys = []
    for await (const { keys } of store.list()) {
      allKeys.push(...keys)
    }
    expect(allKeys).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })

  test('list 3 iterations with pattern and countHint', async () => {
    const fetchResponseJson = JSON.stringify({
      keys: ['a', 'b', 'c'],
      cursor: 1
    })
    const fetchResponseJson2 = JSON.stringify({
      keys: ['d', 'e'],
      cursor: 2
    })
    const fetchResponseJson3 = JSON.stringify({
      keys: ['f'],
      cursor: 0
    })
    mockExponentialBackoff.mockResolvedValueOnce(wrapInFetchResponse(fetchResponseJson))
    mockExponentialBackoff.mockResolvedValueOnce(wrapInFetchResponse(fetchResponseJson2))
    mockExponentialBackoff.mockResolvedValueOnce(wrapInFetchResponse(fetchResponseJson3))

    const allKeys = []
    // no pattern matching is happening on the client, we just check that the pattern is in a valid format
    for await (const { keys } of store.list({ pattern: 'valid*', countHint: 1000 })) {
      allKeys.push(...keys)
    }
    expect(allKeys).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })
})

describe('any', () => {
  let store

  beforeEach(async () => {
    store = await AdobeState.init(fakeCredentials)
  })

  test('success', async () => {
    const fetchResponseJson = {}
    mockExponentialBackoff.mockResolvedValue(wrapInFetchResponse(fetchResponseJson))

    const value = await store.any()
    expect(value).toEqual(true)
  })

  test('not found', async () => {
    mockExponentialBackoff.mockResolvedValue(wrapInFetchError(404))

    const value = await store.any()
    expect(value).toEqual(false)
  })
})

describe('private methods', () => {
  const DEFAULT_REGION = ALLOWED_REGIONS.at(0)

  test('getAuthorizationHeaders (private)', async () => {
    const expectedHeaders = {
      Authorization: `Basic ${Buffer.from(fakeCredentials.apikey).toString('base64')}`
    }
    const store = await AdobeState.init(fakeCredentials)

    expect(store.getAuthorizationHeaders()).toEqual(expectedHeaders)
  })

  describe('createRequestUrl (private)', () => {
    test('no params', async () => {
      const env = PROD_ENV
      mockCLIEnv.mockReturnValue(env)

      // need to instantiate a new store, when env changes
      const store = await AdobeState.init(fakeCredentials)

      const url = store.createRequestUrl()
      expect(url).toEqual(`https://storage-state-${DEFAULT_REGION}.app-builder.adp.adobe.io/containers/${fakeCredentials.namespace}`)
    })

    test('no params, custom endpoint', async () => {
      const env = PROD_ENV
      mockCLIEnv.mockReturnValue(env)

      // need to instantiate a new store, when env changes
      const store = await AdobeState.init(fakeCredentials)
      store.endpoint = 'http://localhost'

      const url = store.createRequestUrl()
      expect(url).toEqual(`${store.endpoint}/containers/${fakeCredentials.namespace}`)
    })

    test('key set, no query params', async () => {
      const key = '/data/some-key'
      const env = STAGE_ENV
      mockCLIEnv.mockReturnValue(env)

      // need to instantiate a new store, when env changes
      const store = await AdobeState.init(fakeCredentials)

      const url = store.createRequestUrl(key)
      expect(url).toEqual(`https://storage-state-${DEFAULT_REGION}.stg.app-builder.adp.adobe.io/containers/${fakeCredentials.namespace}${key}`)
    })

    test('key set, some query params', async () => {
      const queryParams = {
        foo: 'bar',
        cat: 'bat'
      }
      const key = '/data/some-key'
      const env = STAGE_ENV
      mockCLIEnv.mockReturnValue(env)

      // need to instantiate a new store, when env changes
      const store = await AdobeState.init(fakeCredentials)

      const url = store.createRequestUrl(key, queryParams)
      expect(url).toEqual(`https://storage-state-${DEFAULT_REGION}.stg.app-builder.adp.adobe.io/containers/${fakeCredentials.namespace}${key}?${querystring.stringify(queryParams)}`)
    })

    test('no params, region set', async () => {
      const region = 'apac'
      const env = PROD_ENV
      mockCLIEnv.mockReturnValue(env)

      // need to instantiate a new store, when env changes
      const store = await AdobeState.init({ ...fakeCredentials, region })

      const url = store.createRequestUrl()
      expect(url).toEqual(`https://storage-state-${region}.app-builder.adp.adobe.io/containers/${fakeCredentials.namespace}`)
    })

    test('no params, region invalid', async () => {
      const region = 'some-invalid-region'
      const env = PROD_ENV
      mockCLIEnv.mockReturnValue(env)

      await expect(AdobeState.init({ ...fakeCredentials, region })).rejects
        .toThrow('[AdobeStateLib:ERROR_BAD_ARGUMENT] /region must be equal to one of the allowed values: amer, apac, emea')
    })
  })

  test('default env and region', async () => {
    jest.resetModules()
    const env = PROD_ENV
    mockCLIEnv.mockReturnValue(env)

    // need to instantiate a new store, when env changes
    const customAdobeState = require('../lib/AdobeState').AdobeState
    const store = await customAdobeState.init({ ...fakeCredentials })
    const url = store.createRequestUrl()
    expect(url).toEqual(`https://storage-state-amer.app-builder.adp.adobe.io/containers/${fakeCredentials.namespace}`)
  })

  test('custom stage, emea', async () => {
    jest.resetModules()
    const region = 'emea'
    const env = STAGE_ENV
    mockCLIEnv.mockReturnValue(env)

    // need to instantiate a new store, when env changes
    const customAdobeState = require('../lib/AdobeState').AdobeState
    const store = await customAdobeState.init({ ...fakeCredentials, region })
    const url = store.createRequestUrl()
    expect(url).toEqual(`https://storage-state-${region}.stg.app-builder.adp.adobe.io/containers/${fakeCredentials.namespace}`)
  })

  test('custom AIO_STATE_ENDPOINT', async () => {
    jest.resetModules()
    process.env.AIO_STATE_ENDPOINT = 'https://custom.abc.com'

    // need to instantiate a new store, when env changes
    const customAdobeState = require('../lib/AdobeState').AdobeState
    const store = await customAdobeState.init({ ...fakeCredentials })
    const url = store.createRequestUrl()
    expect(url).toEqual(`https://custom.abc.com/containers/${fakeCredentials.namespace}`)
  })

  test('custom AIO_STATE_ENDPOINT, env and region should have no effect', async () => {
    jest.resetModules()
    process.env.AIO_STATE_ENDPOINT = 'https://custom.abc.com'
    const env = STAGE_ENV
    const region = 'apac'
    mockCLIEnv.mockReturnValue(env)

    // need to instantiate a new store, when env changes
    const customAdobeState = require('../lib/AdobeState').AdobeState
    const store = await customAdobeState.init({ ...fakeCredentials, region })
    const url = store.createRequestUrl()
    expect(url).toEqual(`https://custom.abc.com/containers/${fakeCredentials.namespace}`)
  })
})
