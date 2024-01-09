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

/* eslint-disable jsdoc/require-jsdoc */

process.on('unhandledRejection', error => {
  throw error
})

global.mockLogDebug = jest.fn()
global.mockLogError = jest.fn()
// must be mocked before any require that uses aio-lib-core-logging (doMock)
jest.doMock('@adobe/aio-lib-core-logging', function () {
  return function () {
    return {
      debug: global.mockLogDebug,
      error: global.mockLogError
    }
  }
})

beforeEach(() => {
  jest.restoreAllMocks()
  global.mockLogDebug.mockReset()
  global.mockLogError.mockReset()
})

global.expectToThrowCustomError = async (func, code, words, expectedErrorDetails) => {
  let err
  try {
    await func()
  } catch (e) {
    expect({ name: e.name, code: e.code, sdkDetails: e.sdkDetails, message: e.message }).toEqual(expect.objectContaining({
      name: 'StateLibError',
      code,
      sdkDetails: expectedErrorDetails
    }))

    words.concat([code, 'StateLib'])
    words.forEach(w => expect(e.message).toEqual(expect.stringContaining(w)))
    err = e
  }
  // eslint-disable-next-line jest/no-standalone-expect
  expect(err).toBeInstanceOf(Error)
  // eslint-disable-next-line jest/no-standalone-expect
  expect(global.mockLogError).toHaveBeenCalledWith(JSON.stringify(err, null, 2))
  // here we make sure that the internal error was correctly stringified and that it gets logged
  if (expectedErrorDetails._internal instanceof Error) {
  // eslint-disable-next-line jest/no-standalone-expect
    expect(global.mockLogError).toHaveBeenCalledWith(expect.stringContaining(expectedErrorDetails._internal.message))
  }
}

global.expectToThrowBadArg = async (received, words, expectedErrorDetails) => global.expectToThrowCustomError(received, 'ERROR_BAD_ARGUMENT', words, expectedErrorDetails)
global.expectToThrowBadRequest = async (received, words, expectedErrorDetails) => global.expectToThrowCustomError(received, 'ERROR_BAD_REQUEST', words, expectedErrorDetails)
global.expectToThrowForbidden = async (received, expectedErrorDetails) => global.expectToThrowCustomError(received, 'ERROR_BAD_CREDENTIALS', ['cannot', 'access', 'credentials'], expectedErrorDetails)
global.expectToThrowFirewall = async (received, expectedErrorDetails) => global.expectToThrowCustomError(received, 'ERROR_FIREWALL', ['your', 'IP', 'blocked', 'firewall'], expectedErrorDetails)
global.expectToThrowInternalWithStatus = async (received, status, expectedErrorDetails) => global.expectToThrowCustomError(received, 'ERROR_INTERNAL', ['' + status], expectedErrorDetails)
global.expectToThrowInternal = async (received, expectedErrorDetails) => global.expectToThrowCustomError(received, 'ERROR_INTERNAL', ['unknown'], expectedErrorDetails)
global.expectToThrowNotImplemented = async (received, methodName) => global.expectToThrowCustomError(received, 'ERROR_NOT_IMPLEMENTED', ['not', 'implemented', methodName], {})
global.expectToThrowTooLarge = async (received, expectedErrorDetails) => global.expectToThrowCustomError(received, 'ERROR_PAYLOAD_TOO_LARGE', ['payload', 'is', 'too', 'large'], expectedErrorDetails)
global.expectToThrowRequestRateTooHigh = async (received, expectedErrorDetails) => global.expectToThrowCustomError(received, 'ERROR_REQUEST_RATE_TOO_HIGH', ['Request', 'rate', 'too', 'high'], expectedErrorDetails)
