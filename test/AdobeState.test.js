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
const { getCliEnv, DEFAULT_ENV, PROD_ENV, STAGE_ENV } = require('@adobe/aio-lib-env')
const { HttpExponentialBackoff } = require('@adobe/aio-lib-core-networking')
const { AdobeState } = require('../lib/AdobeState')
const querystring = require('node:querystring')
const { Buffer } = require('node:buffer')
const { API_VERSION, ADOBE_STATE_STORE_REGIONS, HEADER_KEY_EXPIRES } = require('../lib/constants')

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

const myConstants = {
  ADOBE_STATE_STORE_ENDPOINT: {
    prod: 'prod-server',
    stage: 'stage-server'
  }
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
      get: () => 'fake req id'
    },
    json: async () => JSON.parse(body),
    text: async () => body,
    status
  }
}

// mocks //////////////////////////////////////////////////////////

jest.mock('@adobe/aio-lib-core-networking')

jest.mock('../lib/constants', () => {
  return {
    ...jest.requireActual('../lib/constants'),
    ...myConstants
  }
})

jest.mock('@adobe/aio-lib-env', () => {
  return {
    ...jest.requireActual('@adobe/aio-lib-env'),
    getCliEnv: jest.fn()
  }
})

// jest globals //////////////////////////////////////////////////////////

beforeEach(() => {
  getCliEnv.mockReturnValue(DEFAULT_ENV)
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

  test('failure (binary value)', async () => {
    const key = 'valid-key'
    const value = Buffer.from([0x61, 0x72, 0x65, 0x26, 0x35, 0x55, 0xff])

    await expect(store.put(key, value)).rejects.toThrow('[AdobeStateLib:ERROR_BAD_ARGUMENT] /value must be string')
  })

  test('coverage: 401 error', async () => {
    const key = 'some-key'
    const value = 'some-value'

    mockExponentialBackoff.mockResolvedValue(wrapInFetchError(401))
    await expect(store.put(key, value)).rejects.toThrow('[AdobeStateLib:ERROR_UNAUTHORIZED] you are not authorized to access underlying DB provider')
  })

  test('coverage: 403 error', async () => {
    const key = 'some-key'
    const value = 'some-value'

    mockExponentialBackoff.mockResolvedValue(wrapInFetchError(403))
    await expect(store.put(key, value)).rejects.toThrow('[AdobeStateLib:ERROR_BAD_CREDENTIALS] cannot access underlying DB provider, make sure your credentials are valid')
  })

  test('coverage: 413 error', async () => {
    const key = 'some-key'
    const value = 'some-value'

    mockExponentialBackoff.mockResolvedValue(wrapInFetchError(413))
    await expect(store.put(key, value)).rejects.toThrow('[AdobeStateLib:ERROR_PAYLOAD_TOO_LARGE] key, value or request payload is too large underlying DB provider')
  })

  test('coverage: 429 error', async () => {
    const key = 'some-key'
    const value = 'some-value'

    mockExponentialBackoff.mockResolvedValue(wrapInFetchError(429))
    await expect(store.put(key, value)).rejects.toThrow('[AdobeStateLib:ERROR_REQUEST_RATE_TOO_HIGH] Request rate too high. Please retry after sometime.')
  })

  test('coverage: unknown server error', async () => {
    const key = 'some-key'
    const value = 'some-value'
    const responseBody = 'error: this is the response body'

    mockExponentialBackoff.mockResolvedValue(wrapInFetchError(500, responseBody))
    await expect(store.put(key, value)).rejects.toThrow(`[AdobeStateLib:ERROR_INTERNAL] unexpected response from provider with status: 500 body: ${responseBody}`)
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
  const DEFAULT_REGION = ADOBE_STATE_STORE_REGIONS.at(0)

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
      getCliEnv.mockReturnValue(env)

      // need to instantiate a new store, when env changes
      const store = await AdobeState.init(fakeCredentials)

      const url = store.createRequestUrl()
      expect(url).toEqual(`https://${DEFAULT_REGION}.${myConstants.ADOBE_STATE_STORE_ENDPOINT[env]}/${API_VERSION}/containers/${fakeCredentials.namespace}`)
    })

    test('no params, localhost endpoint', async () => {
      const env = PROD_ENV
      getCliEnv.mockReturnValue(env)

      // need to instantiate a new store, when env changes
      const store = await AdobeState.init(fakeCredentials)
      store.endpoint = 'localhost'

      const url = store.createRequestUrl()
      expect(url).toEqual(`http://${store.endpoint}/${API_VERSION}/containers/${fakeCredentials.namespace}`)
    })

    test('no params, 127.0.0.1 endpoint', async () => {
      const env = PROD_ENV
      getCliEnv.mockReturnValue(env)

      // need to instantiate a new store, when env changes
      const store = await AdobeState.init(fakeCredentials)
      store.endpoint = '127.0.0.1'

      const url = store.createRequestUrl()
      expect(url).toEqual(`http://${store.endpoint}/${API_VERSION}/containers/${fakeCredentials.namespace}`)
    })

    test('key set, no query params', async () => {
      const key = 'some-key'
      const env = STAGE_ENV
      getCliEnv.mockReturnValue(env)

      // need to instantiate a new store, when env changes
      const store = await AdobeState.init(fakeCredentials)

      const url = store.createRequestUrl(key)
      expect(url).toEqual(`https://${DEFAULT_REGION}.${myConstants.ADOBE_STATE_STORE_ENDPOINT[env]}/${API_VERSION}/containers/${fakeCredentials.namespace}/data/${key}`)
    })

    test('key set, some query params', async () => {
      const queryParams = {
        foo: 'bar',
        cat: 'bat'
      }
      const key = 'some-key'
      const env = STAGE_ENV
      getCliEnv.mockReturnValue(env)

      // need to instantiate a new store, when env changes
      const store = await AdobeState.init(fakeCredentials)

      const url = store.createRequestUrl(key, queryParams)
      expect(url).toEqual(`https://${DEFAULT_REGION}.${myConstants.ADOBE_STATE_STORE_ENDPOINT[env]}/${API_VERSION}/containers/${fakeCredentials.namespace}/data/${key}?${querystring.stringify(queryParams)}`)
    })

    test('no params, region set', async () => {
      const region = 'apac'
      const env = PROD_ENV
      getCliEnv.mockReturnValue(env)

      // need to instantiate a new store, when env changes
      const store = await AdobeState.init({ ...fakeCredentials, region })

      const url = store.createRequestUrl()
      expect(url).toEqual(`https://${region}.${myConstants.ADOBE_STATE_STORE_ENDPOINT[env]}/${API_VERSION}/containers/${fakeCredentials.namespace}`)
    })

    test('no params, region invalid', async () => {
      const region = 'some-invalid-region'
      const env = PROD_ENV
      getCliEnv.mockReturnValue(env)

      await expect(AdobeState.init({ ...fakeCredentials, region })).rejects
        .toThrow('[AdobeStateLib:ERROR_BAD_ARGUMENT] /region must be equal to one of the allowed values: amer, apac, emea')
    })
  })
})
