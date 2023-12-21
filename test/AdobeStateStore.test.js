/*
Copyright 2019 Adobe. All rights reserved.
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
const { AdobeStateStore } = require('../lib/AdobeStateStore')
const querystring = require('node:querystring')
const { Buffer } = require('node:buffer')

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
    prod: 'https://prod',
    stage: 'https://stage'
  }
}

// helpers //////////////////////////////////////////////////////////

const wrapInFetchResponse = (body) => {
  return {
    ok: true,
    headers: {
      get: () => 'fake req id'
    },
    json: async () => body
  }
}

const wrapInFetchError = (status) => {
  return {
    ok: false,
    headers: {
      get: () => 'fake req id'
    },
    json: async () => 'error',
    text: async () => 'error',
    status
  }
}

// mocks //////////////////////////////////////////////////////////

jest.mock('@adobe/aio-lib-core-networking')

jest.mock('../lib/constants', () => {
  return myConstants
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

    const store = await AdobeStateStore.init(credentials)
    expect(store.apikey).toEqual(credentials.apikey)
    expect(store.namespace).toEqual(credentials.namespace)
    expect(store.endpoint).toBeDefined()
  })

  test('bad credentials (no apikey and no namespace)', async () => {
    await expect(AdobeStateStore.init()).rejects
      .toThrow('[AdobeStateLib:ERROR_BAD_ARGUMENT] "apikey" is required')
  })

  test('bad credentials (no apikey)', async () => {
    const credentials = {
      namespace: 'some-namespace'
    }

    await expect(AdobeStateStore.init(credentials)).rejects
      .toThrow('[AdobeStateLib:ERROR_BAD_ARGUMENT] "apikey" is required')
  })

  test('bad credentials (no namespace)', async () => {
    const credentials = {
      apikey: 'some-apikey'
    }

    await expect(AdobeStateStore.init(credentials)).rejects
      .toThrow('[AdobeStateLib:ERROR_BAD_ARGUMENT] "namespace" is required')
  })
})

describe('get', () => {
  let store

  beforeEach(async () => {
    store = await AdobeStateStore.init(fakeCredentials)
  })

  test('success', async () => {
    const key = 'valid-key'
    const fetchResponseJson = {
      expiration: 999,
      value: 'foo'
    }

    mockExponentialBackoff.mockResolvedValue(wrapInFetchResponse(fetchResponseJson))

    const value = await store.get(key)
    expect(value).toEqual(fetchResponseJson)
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
    store = await AdobeStateStore.init(fakeCredentials)
  })

  test('success (string value)', async () => {
    const key = 'valid-key'
    const value = 'some-value'
    const fetchResponseJson = {}

    mockExponentialBackoff.mockResolvedValue(wrapInFetchResponse(fetchResponseJson))

    const returnKey = await store.put(key, value)
    expect(returnKey).toEqual(key)
  })

  test('success (binary value)', async () => {
    const key = 'valid-key'
    const value = Buffer.from([0x61, 0x72, 0x65, 0x26, 0x35, 0x55, 0xff])
    const fetchResponseJson = {}

    mockExponentialBackoff.mockResolvedValue(wrapInFetchResponse(fetchResponseJson))

    const returnKey = await store.put(key, value)
    expect(returnKey).toEqual(key)
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

  test('coverage: 429 error', async () => {
    const key = 'some-key'
    const value = 'some-value'

    mockExponentialBackoff.mockResolvedValue(wrapInFetchError(429))
    await expect(store.put(key, value)).rejects.toThrow('[AdobeStateLib:ERROR_REQUEST_RATE_TOO_HIGH] Request rate too high. Please retry after sometime.')
  })

  test('coverage: unknown server error', async () => {
    const key = 'some-key'
    const value = 'some-value'

    mockExponentialBackoff.mockResolvedValue(wrapInFetchError(500))
    await expect(store.put(key, value)).rejects.toThrow('[AdobeStateLib:ERROR_INTERNAL] unexpected response from provider with status: 500')
  })

  test('coverage: unknown error (fetch network failure)', async () => {
    const key = 'some-key'
    const value = 'some-value'

    const error = new Error('some network error')
    error.code = 502
    mockExponentialBackoff.mockRejectedValue(error)
    await expect(store.put(key, value)).rejects.toThrow('[AdobeStateLib:ERROR_INTERNAL] unexpected response from provider with status: 502')
  })
})

describe('delete', () => {
  let store

  beforeEach(async () => {
    store = await AdobeStateStore.init(fakeCredentials)
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
    store = await AdobeStateStore.init(fakeCredentials)
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

describe('any', () => {
  let store

  beforeEach(async () => {
    store = await AdobeStateStore.init(fakeCredentials)
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
  test('getAuthorizationHeaders (private)', async () => {
    const expectedHeaders = {
      Authorization: `Basic ${fakeCredentials.apikey}`
    }
    const store = await AdobeStateStore.init(fakeCredentials)

    expect(store.getAuthorizationHeaders()).toEqual(expectedHeaders)
  })

  describe('createRequestUrl (private)', () => {
    test('no params', async () => {
      const env = PROD_ENV
      getCliEnv.mockReturnValue(env)

      // need to instantiate a new store, when env changes
      const store = await AdobeStateStore.init(fakeCredentials)

      const url = store.createRequestUrl()
      expect(url).toEqual(`${myConstants.ADOBE_STATE_STORE_ENDPOINT[env]}/v1/containers/${fakeCredentials.namespace}`)
    })

    test('key set, no query params', async () => {
      const key = 'some-key'
      const env = STAGE_ENV
      getCliEnv.mockReturnValue(env)

      // need to instantiate a new store, when env changes
      const store = await AdobeStateStore.init(fakeCredentials)

      const url = store.createRequestUrl(key)
      expect(url).toEqual(`${myConstants.ADOBE_STATE_STORE_ENDPOINT[env]}/v1/containers/${fakeCredentials.namespace}/${key}`)
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
      const store = await AdobeStateStore.init(fakeCredentials)

      const url = store.createRequestUrl(key, queryParams)
      expect(url).toEqual(`${myConstants.ADOBE_STATE_STORE_ENDPOINT[env]}/v1/containers/${fakeCredentials.namespace}/${key}?${querystring.stringify(queryParams)}`)
    })
  })
})
