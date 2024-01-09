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
const stateLib = require('../index')

const { CosmosStateStore } = require('../lib/impl/CosmosStateStore')
jest.mock('../lib/impl/CosmosStateStore.js')

const TvmClient = require('@adobe/aio-lib-core-tvm')
jest.mock('@adobe/aio-lib-core-tvm')

describe('init', () => {
  /* Common setup for init tests */
  beforeEach(async () => {
    CosmosStateStore.mockRestore()
    CosmosStateStore.init = jest.fn()
  })

  const checkInitDebugLogNoSecrets = (str) => expect(global.mockLogDebug).not.toHaveBeenCalledWith(expect.stringContaining(str))

  describe('when user db credentials', () => {
    const fakeCosmosConfig = {

      masterKey: 'fakeKey',
      resourceToken: 'fakeToken'
    }
    test('with cosmos config', async () => {
      expect.hasAssertions()
      await stateLib.init({ cosmos: fakeCosmosConfig })
      expect(CosmosStateStore.init).toHaveBeenCalledTimes(1)
      expect(CosmosStateStore.init).toHaveBeenCalledWith(fakeCosmosConfig)
      expect(TvmClient.init).toHaveBeenCalledTimes(0)
      expect(global.mockLogDebug).toHaveBeenCalledWith(expect.stringContaining('cosmos'))
      checkInitDebugLogNoSecrets(fakeCosmosConfig.masterKey)
      checkInitDebugLogNoSecrets(fakeCosmosConfig.resourceToken)
    })
  })

  describe('with openwhisk credentials', () => {
    const fakeTVMResponse = {
      fakeTVMResponse: 'response'
    }
    const fakeOWCreds = {
      auth: 'fakeAuth',
      namespace: 'fakeNS'
    }
    const fakeTVMOptions = {
      some: 'options'
    }
    const cosmosTVMMock = jest.fn()
    beforeEach(async () => {
      TvmClient.mockReset()
      TvmClient.init.mockReset()
      cosmosTVMMock.mockReset()
      TvmClient.init.mockResolvedValue({
        getAzureCosmosCredentials: cosmosTVMMock
      })
    })
    test('when tvm options', async () => {
      expect.hasAssertions()
      cosmosTVMMock.mockResolvedValue(fakeTVMResponse)
      await stateLib.init({ ow: fakeOWCreds, tvm: fakeTVMOptions })
      expect(TvmClient.init).toHaveBeenCalledTimes(1)
      expect(TvmClient.init).toHaveBeenCalledWith({ ow: fakeOWCreds, ...fakeTVMOptions })
      expect(CosmosStateStore.init).toHaveBeenCalledTimes(1)
      expect(CosmosStateStore.init).toHaveBeenCalledWith(fakeTVMResponse)
      expect(global.mockLogDebug).toHaveBeenCalledWith(expect.stringContaining('openwhisk'))
      checkInitDebugLogNoSecrets(fakeOWCreds.auth)
    })
    test('when empty config to be able to pass OW creds as env variables', async () => {
      expect.hasAssertions()
      cosmosTVMMock.mockResolvedValue(fakeTVMResponse)
      await stateLib.init()
      expect(TvmClient.init).toHaveBeenCalledTimes(1)
      expect(TvmClient.init).toHaveBeenCalledWith({ ow: undefined })
      expect(CosmosStateStore.init).toHaveBeenCalledTimes(1)
      expect(CosmosStateStore.init).toHaveBeenCalledWith(fakeTVMResponse)
      expect(global.mockLogDebug).toHaveBeenCalledWith(expect.stringContaining('openwhisk'))
    })
    // eslint-disable-next-line jest/expect-expect
    test('when tvm rejects with a 401 (throws wrapped error)', async () => {
      expect.hasAssertions()
      const e = new Error('tvm error')
      e.sdkDetails = { fake: 'details', status: 401 }
      cosmosTVMMock.mockRejectedValue(e)
      await global.expectToThrowForbidden(stateLib.init.bind(stateLib, { ow: fakeOWCreds }), e.sdkDetails)
    })
    // eslint-disable-next-line jest/expect-expect
    test('when tvm rejects with a 403 (throws wrapped error)', async () => {
      expect.hasAssertions()
      const e = new Error('tvm error')
      e.sdkDetails = { fake: 'details', status: 403 }
      cosmosTVMMock.mockRejectedValue(e)
      await global.expectToThrowForbidden(stateLib.init.bind(stateLib, { ow: fakeOWCreds }), e.sdkDetails)
    })
    test('when tvm rejects with another status code (throws tvm error)', async () => {
      expect.hasAssertions()
      const tvmError = new Error('tvm error')
      tvmError.sdkDetails = { fake: 'details', status: 500 }
      cosmosTVMMock.mockRejectedValue(tvmError)
      return expect(stateLib.init({ ow: fakeOWCreds })).rejects.toThrow(tvmError)
    })
  })
})
