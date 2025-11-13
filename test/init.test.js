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
const stateLib = require('../index')
const { HttpExponentialBackoff } = require('@adobe/aio-lib-core-networking')

jest.mock('@adobe/aio-lib-core-networking')

describe('init', () => {
  const env = process.env
  const mockExponentialBackoff = jest.fn()

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...env }
    jest.clearAllMocks()

    HttpExponentialBackoff.mockImplementation((options) => {
      return {
        exponentialBackoff: mockExponentialBackoff
      }
    })
  })

  afterEach(() => {
    process.env = env
  })

  const fakeOWCreds = {
    auth: 'fakeAuth',
    namespace: 'fakeNS'
  }

  test('pass OW creds', async () => {
    expect.hasAssertions()
    const store = await stateLib.init({ ow: fakeOWCreds })

    expect(store.namespace).toEqual(fakeOWCreds.namespace)
    expect(store.apikey).toEqual(fakeOWCreds.auth)
  })

  test('when empty config to be able to pass OW creds as env variables', async () => {
    process.env.__OW_NAMESPACE = 'some-namespace'
    process.env.__OW_API_KEY = 'some-api-key'

    expect.hasAssertions()
    const store = await stateLib.init()

    expect(store.namespace).toEqual(process.env.__OW_NAMESPACE)
    expect(store.apikey).toEqual(process.env.__OW_API_KEY)
  })

  test('pass logLevel in config', async () => {
    expect.hasAssertions()
    const logLevel = 'debug'
    const store = await stateLib.init({ ow: fakeOWCreds, logLevel })

    expect(store.namespace).toEqual(fakeOWCreds.namespace)
    expect(store.apikey).toEqual(fakeOWCreds.auth)
    expect(HttpExponentialBackoff).toHaveBeenCalledWith({ logLevel, logRetryAfterSeconds: 10 })
  })

  test('when logLevel is not provided, HttpExponentialBackoff receives undefined', async () => {
    expect.hasAssertions()
    const store = await stateLib.init({ ow: fakeOWCreds })

    expect(store.namespace).toEqual(fakeOWCreds.namespace)
    expect(store.apikey).toEqual(fakeOWCreds.auth)
    expect(HttpExponentialBackoff).toHaveBeenCalledWith({ logLevel: undefined, logRetryAfterSeconds: 10 })
  })

  test('pass logRetryAfterSeconds in config', async () => {
    expect.hasAssertions()
    const logRetryAfterSeconds = 20
    const store = await stateLib.init({ ow: fakeOWCreds, logRetryAfterSeconds })

    expect(store.namespace).toEqual(fakeOWCreds.namespace)
    expect(store.apikey).toEqual(fakeOWCreds.auth)
    expect(HttpExponentialBackoff).toHaveBeenCalledWith({ logLevel: undefined, logRetryAfterSeconds })
  })

  test('pass both logLevel and logRetryAfterSeconds in config', async () => {
    expect.hasAssertions()
    const logLevel = 'debug'
    const logRetryAfterSeconds = 30
    const store = await stateLib.init({ ow: fakeOWCreds, logLevel, logRetryAfterSeconds })

    expect(store.namespace).toEqual(fakeOWCreds.namespace)
    expect(store.apikey).toEqual(fakeOWCreds.auth)
    expect(HttpExponentialBackoff).toHaveBeenCalledWith({ logLevel, logRetryAfterSeconds })
  })
})
