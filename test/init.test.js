const stateLib = require('../index')

const { CosmosStateStore } = require('../lib/impl/CosmosStateStore')
jest.mock('../lib/impl/CosmosStateStore.js')

const TvmClient = require('@adobe/adobeio-cna-tvm-client')
jest.mock('@adobe/adobeio-cna-tvm-client')

beforeEach(async () => {
  expect.hasAssertions()
  jest.restoreAllMocks()
})

describe('init', () => {
  /* Common setup for init tests */
  beforeEach(async () => {
    CosmosStateStore.mockRestore()
    CosmosStateStore.init = jest.fn()
  })

  describe('when user db credentials', () => {
    const fakeCosmosConfig = {
      fake: 'cosmosconfig'
    }
    test('with cosmos config', async () => {
      await stateLib.init({ cosmos: fakeCosmosConfig })
      expect(CosmosStateStore.init).toHaveBeenCalledTimes(1)
      expect(CosmosStateStore.init).toHaveBeenCalledWith(fakeCosmosConfig)
      expect(TvmClient.init).toHaveBeenCalledTimes(0)
    })
  })

  describe('with openwhisk credentials', () => {
    const fakeTVMResponse = {
      fakeTVMResponse: 'response'
    }
    const fakeOWCreds = {
      auth: 'fake',
      namespace: 'fake'
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
      cosmosTVMMock.mockResolvedValue(fakeTVMResponse)
      await stateLib.init({ ow: fakeOWCreds, tvm: fakeTVMOptions })
      expect(TvmClient.init).toHaveBeenCalledTimes(1)
      expect(TvmClient.init).toHaveBeenCalledWith({ ow: fakeOWCreds, ...fakeTVMOptions })
      expect(CosmosStateStore.init).toHaveBeenCalledTimes(1)
      expect(CosmosStateStore.init).toHaveBeenCalledWith(fakeTVMResponse)
    })
    test('when empty config to be able to pass OW creds as env variables', async () => {
      cosmosTVMMock.mockResolvedValue(fakeTVMResponse)
      await stateLib.init()
      expect(TvmClient.init).toHaveBeenCalledTimes(1)
      expect(TvmClient.init).toHaveBeenCalledWith({ ow: undefined })
      expect(CosmosStateStore.init).toHaveBeenCalledTimes(1)
      expect(CosmosStateStore.init).toHaveBeenCalledWith(fakeTVMResponse)
    })
    test('when tvm rejects with a 401 (throws wrapped error)', async () => {
      cosmosTVMMock.mockRejectedValue({ status: 401 })
      await expect(stateLib.init.bind(stateLib, { ow: fakeOWCreds })).toThrowForbidden()
    })
    test('when tvm rejects with a 403 (throws wrapped error)', async () => {
      cosmosTVMMock.mockRejectedValue({ status: 403 })
      await expect(stateLib.init.bind(stateLib, { ow: fakeOWCreds })).toThrowForbidden()
    })
    test('when tvm rejects with another status code (throws tvm error)', async () => {
      const tvmError = new Error({ status: 500 })
      cosmosTVMMock.mockRejectedValue(tvmError)
      try {
        await stateLib.init({ ow: fakeOWCreds })
      } catch (e) {
        expect(e).toBe(tvmError)
      }
    })
  })
})
