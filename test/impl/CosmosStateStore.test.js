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

beforeEach(async () => {
  expect.hasAssertions()
  jest.restoreAllMocks()
})

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

describe('init', () => {
  // eslint-disable-next-line jsdoc/require-jsdoc
  async function testInitWithMissing (object, missing) {
    const args = { ...object, [missing]: undefined }
    await expect(CosmosStateStore.init.bind(CosmosStateStore, args)).toThrowBadArgWithMessageContaining([missing, 'required'])
  }

  describe('init', () => {
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
    })
    describe('with correct args', () => {
      const cosmosDatabaseMock = jest.fn()
      const cosmosContainerMock = jest.fn()
      beforeEach(async () => {
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
