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
const { ADOBE_STATE_STORE_REGIONS } = require('../lib/constants')

describe('init', () => {
  const env = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...env }
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
    expect(store.region).toEqual(ADOBE_STATE_STORE_REGIONS.at(0))
  })

  test('when config.region is set, OW creds as env variables', async () => {
    process.env.__OW_NAMESPACE = 'some-namespace'
    process.env.__OW_API_KEY = 'some-api-key'
    const region = 'emea'

    expect.hasAssertions()
    const store = await stateLib.init({ region })

    expect(store.namespace).toEqual(process.env.__OW_NAMESPACE)
    expect(store.apikey).toEqual(process.env.__OW_API_KEY)
    expect(store.region).toEqual(region)
  })
})
