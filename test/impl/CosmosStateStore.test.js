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

const { CosmosStateStore } = require('../../lib/impl/CosmosStateStore')
const { StateStore } = require('../../lib/StateStore')

const cosmos = require('@azure/cosmos')
jest.mock('@azure/cosmos')

const fakeCosmosResourceCredentials = {
  endpoint: 'https://fake.com',
  resourceToken: 'fakeToken',
  databaseId: 'fakedb',
  containerId: 'fakeContainer',
  partitionKey: 'fakePK'
}

const fakeCosmosMasterCredentials = {
  endpoint: 'https://fake.com',
  masterKey: 'fakeKey',
  databaseId: 'fakedb',
  containerId: 'fakeContainer',
  partitionKey: 'fakePK'
}

const fakeCosmosTVMResponse = {
  expiration: new Date(8640000000000000).toISOString(),
  ...fakeCosmosResourceCredentials
}

const cosmosDatabaseMock = jest.fn()
const cosmosContainerMock = jest.fn()
beforeEach(async () => {
  expect.hasAssertions()
  jest.restoreAllMocks()

  cosmos.CosmosClient.mockReset()
  cosmosContainerMock.mockReset()
  cosmosDatabaseMock.mockReset()

  cosmos.CosmosClient.mockImplementation(() => {
    return {
      database: cosmosDatabaseMock.mockReturnValue({
        container: cosmosContainerMock
      })
    }
  })
})

// eslint-disable-next-line jsdoc/require-jsdoc
async function testProviderErrorHandling (func, mock) {
  // eslint-disable-next-line jsdoc/require-jsdoc
  async function testOne (status, expectCheck, expectArgs) {
    mock.mockReset()
    mock.mockRejectedValue({
      code: status,
      message: 'fakeError'
    })
    await expect(func)[expectCheck](expectArgs)
  }

  await testOne(403, 'toThrowForbidden')
  await testOne(413, 'toThrowTooLarge')
  await testOne(500, 'toThrowInternalWithStatus', 500)
  await testOne(undefined, 'toThrowInternal')
  // when provider resolves with bad status which is not 404
  mock.mockReset()
  mock.mockResolvedValue({
    statusCode: 400
  })
  await expect(func).toThrowInternalWithStatus(400)
}

describe('init', () => {
  // eslint-disable-next-line jsdoc/require-jsdoc
  async function testInitWithMissing (object, missing) {
    const args = { ...object, [missing]: undefined }
    await expect(CosmosStateStore.init.bind(CosmosStateStore, args)).toThrowBadArgWithMessageContaining([missing, 'required'])
  }
  describe('with bad args', () => {
    test('with undefined credentials', async () => {
      await expect(CosmosStateStore.init.bind(CosmosStateStore)).toThrowBadArgWithMessageContaining(['cosmos', 'required'])
    })
    test('with resourceToken and missing endpoint, databaseId, containerId, partitionKey', async () => {
      await testInitWithMissing(fakeCosmosResourceCredentials, 'endpoint')
      await testInitWithMissing(fakeCosmosResourceCredentials, 'databaseId')
      await testInitWithMissing(fakeCosmosResourceCredentials, 'containerId')
      await testInitWithMissing(fakeCosmosResourceCredentials, 'partitionKey')
    })
    test('with masterKey and missing endpoint, databaseId, containerId, partitionKey', async () => {
      await testInitWithMissing(fakeCosmosMasterCredentials, 'endpoint')
      await testInitWithMissing(fakeCosmosMasterCredentials, 'databaseId')
      await testInitWithMissing(fakeCosmosMasterCredentials, 'containerId')
      await testInitWithMissing(fakeCosmosMasterCredentials, 'partitionKey')
    })
    test('with missing masterKey and resourceToken', async () => {
      const args = { ...fakeCosmosMasterCredentials, masterKey: undefined }
      await expect(CosmosStateStore.init.bind(CosmosStateStore, args)).toThrowBadArgWithMessageContaining(['masterKey', 'resourceToken'])
    })
    test('with both masterKey and resourceToken', async () => {
      const args = { ...fakeCosmosMasterCredentials, masterKey: undefined }
      await expect(CosmosStateStore.init.bind(CosmosStateStore, args)).toThrowBadArgWithMessageContaining(['masterKey', 'resourceToken'])
    })
    test('with unknown option', async () => {
      const args = { ...fakeCosmosMasterCredentials, someFake__unknown: 'hello' }
      await expect(CosmosStateStore.init.bind(CosmosStateStore, args)).toThrowBadArgWithMessageContaining(['someFake__unknown', 'not allowed'])
    })
    describe('with correct args', () => {
      const testInitOK = async (credentials) => {
        const state = await CosmosStateStore.init(credentials)
        expect(state).toBeInstanceOf(CosmosStateStore)
        expect(state).toBeInstanceOf(StateStore)
        expect(cosmos.CosmosClient).toHaveBeenCalledTimes(1)
        expect(cosmos.CosmosClient).toHaveBeenCalledWith(expect.objectContaining({ endpoint: credentials.endpoint }))
        expect(cosmosDatabaseMock).toHaveBeenCalledTimes(1)
        expect(cosmosDatabaseMock).toHaveBeenCalledWith(credentials.databaseId)
        expect(cosmosContainerMock).toHaveBeenCalledTimes(1)
        expect(cosmosContainerMock).toHaveBeenCalledWith(credentials.containerId)
      }

      test('with resourceToken', async () => {
        await testInitOK(fakeCosmosResourceCredentials)
      })
      test('with resourceToken and expiration (tvm response format)', async () => {
        await testInitOK(fakeCosmosTVMResponse)
      })
      test('with masterKey', async () => {
        await testInitOK(fakeCosmosMasterCredentials)
      })
    })
  })
})

describe('_get', () => {
  const cosmosItemMock = jest.fn()
  const cosmosItemReadMock = jest.fn()
  beforeEach(async () => {
    cosmosItemMock.mockReset()
    cosmosItemReadMock.mockReset()
    cosmosContainerMock.mockReturnValue({
      item: cosmosItemMock.mockReturnValue({
        read: cosmosItemReadMock
      })
    })
  })

  test('with existing key value', async () => {
    cosmosItemReadMock.mockResolvedValue({
      resource: {
        value: 'fakeValue'
      }
    })
    const state = await CosmosStateStore.init(fakeCosmosResourceCredentials)
    const value = await state._get('fakeKey')
    expect(value).toEqual('fakeValue')
    expect(cosmosItemReadMock).toHaveBeenCalledTimes(1)
    expect(cosmosItemMock).toHaveBeenCalledWith('fakeKey', state._cosmos.partitionKey)
  })
  test('with existing key and value=undefined', async () => {
    cosmosItemReadMock.mockResolvedValue({
      resource: {
        value: undefined
      }
    })
    const state = await CosmosStateStore.init(fakeCosmosResourceCredentials)
    const value = await state._get('fakeKey')
    expect(value).toEqual(undefined)
  })
  test('with non existing key value', async () => {
    cosmosItemReadMock.mockResolvedValue({
      resource: {},
      statusCode: 404
    })
    const state = await CosmosStateStore.init(fakeCosmosResourceCredentials)
    const value = await state._get('fakeKey')
    expect(value).toEqual(undefined)
  })
  test('with error response from provider', async () => {
    const state = await CosmosStateStore.init(fakeCosmosResourceCredentials)
    await testProviderErrorHandling(state._get.bind(state, 'key'), cosmosItemReadMock)
  })
})

describe('_delete', () => {
  const cosmosItemMock = jest.fn()
  const cosmosItemDeleteMock = jest.fn()
  beforeEach(async () => {
    cosmosItemMock.mockReset()
    cosmosItemDeleteMock.mockReset()
    cosmosContainerMock.mockReturnValue({
      item: cosmosItemMock.mockReturnValue({
        delete: cosmosItemDeleteMock.mockResolvedValue({})
      })
    })
  })

  test('with no errors', async () => {
    const state = await CosmosStateStore.init(fakeCosmosResourceCredentials)
    const ret = await state._delete('fakeKey')
    expect(ret).toEqual('fakeKey')
    expect(cosmosItemDeleteMock).toHaveBeenCalledTimes(1)
    expect(cosmosItemMock).toHaveBeenCalledWith('fakeKey', state._cosmos.partitionKey)
  })
  test('with error response from provider', async () => {
    const state = await CosmosStateStore.init(fakeCosmosResourceCredentials)
    await testProviderErrorHandling(state._delete.bind(state, 'key'), cosmosItemDeleteMock)
  })
})

describe('_put', () => {
  const cosmosUpsertMock = jest.fn()
  beforeEach(async () => {
    cosmosUpsertMock.mockReset()
    cosmosContainerMock.mockReturnValue({
      items: {
        upsert: cosmosUpsertMock.mockResolvedValue({})
      }
    })
  })

  test('with default ttl (ttl is always set)', async () => {
    const key = 'fakeKey'
    const value = 'fakeValue'
    const state = await CosmosStateStore.init(fakeCosmosResourceCredentials)
    const ret = await state._put(key, 'fakeValue', { ttl: StateStore.DefaultTTL })
    expect(ret).toEqual(key)
    expect(cosmosUpsertMock).toHaveBeenCalledTimes(1)
    expect(cosmosUpsertMock).toHaveBeenCalledWith({ id: key, partitionKey: state._cosmos.partitionKey, ttl: StateStore.DefaultTTL, value })
  })
  test('with positive ttl', async () => {
    const key = 'fakeKey'
    const value = 'fakeValue'
    const state = await CosmosStateStore.init(fakeCosmosResourceCredentials)
    const ret = await state._put(key, 'fakeValue', { ttl: 99 })
    expect(ret).toEqual(key)
    expect(cosmosUpsertMock).toHaveBeenCalledTimes(1)
    expect(cosmosUpsertMock).toHaveBeenCalledWith({ id: key, partitionKey: state._cosmos.partitionKey, ttl: 99, value })
  })
  test('with negative ttl (converts to -1 always)', async () => {
    const key = 'fakeKey'
    const value = 'fakeValue'
    const state = await CosmosStateStore.init(fakeCosmosResourceCredentials)
    const ret = await state._put(key, 'fakeValue', { ttl: -99 })
    expect(ret).toEqual(key)
    expect(cosmosUpsertMock).toHaveBeenCalledTimes(1)
    expect(cosmosUpsertMock).toHaveBeenCalledWith({ id: key, partitionKey: state._cosmos.partitionKey, ttl: -1, value })
  })
  test('with error response from provider', async () => {
    const state = await CosmosStateStore.init(fakeCosmosResourceCredentials)
    await testProviderErrorHandling(state._put.bind(state, 'key', 'value', {}), cosmosUpsertMock)
  })
})
