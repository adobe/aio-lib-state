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
const { KVSError } = require('../lib/KeyValueStoreError')

process.on('unhandledRejection', error => {
  throw error
})

async function toThrowWithCodeAndMessageContains (received, code, words, checkErrorType = true) {
  function checkErrorCode (e, code) {
    if (!(e instanceof KVSError)) {
      return { message: () => `expected error to be instanceof "KVSError", instead received "${e.constructor.name}" with message: "${e.message}"`, pass: false }
    }
    if (e.code !== code) {
      return { message: () => `expected error code to be "${code}", instead received "${e.code}" with message: "${e.message}"`, pass: false }
    }
  }
  function checkErrorMessageContains (message, words) {
    message = message.toLowerCase()
    if (typeof words === 'string') words = [words]
    for (let i = 0; i < words.length; ++i) {
      let a = words[i].toLowerCase()
      if (message.indexOf(a) < 0) {
        return { message: () => `expected error message "${message}" to contain "${a}"`, pass: false }
      }
    }
  }
  try {
    await received()
  } catch (e) {
    if (checkErrorType) {
      const res = checkErrorCode(e, code)
      if (res) return res
    }
    const res = checkErrorMessageContains(e.message, words)
    if (res) return res
    return { pass: true }
  }
  return { message: () => 'function should have thrown', pass: false }
}
expect.extend({
  toThrowWithCodeAndMessageContains,
  toThrowBadArgWithMessageContaining: (received, words, checkErrorType = true) => toThrowWithCodeAndMessageContains(received, KVSError.codes.BadArgument, words, checkErrorType),
  toThrowForbidden: (received) => toThrowWithCodeAndMessageContains(received, KVSError.codes.Forbidden, ['forbidden', 'credentials']),
  toThrowInternalWithStatus: (received, status) => toThrowWithCodeAndMessageContains(received, KVSError.codes.Internal, ['' + status, 'unknown']),
  toThrowInternal: (received) => toThrowWithCodeAndMessageContains(received, KVSError.codes.Internal, ['unknown']),
  toThrowNotImplemented: (received, methodName) => toThrowWithCodeAndMessageContains(received, KVSError.codes.NotImplemented, ['not implemented', methodName])
})
