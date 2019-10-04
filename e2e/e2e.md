# Adobe I/O Lib State E2E tests

## Requirements

- To run the test you'll need two OpenWhisk namespaces. Please set the credentials for those in the following env
  variables:
  - `TEST_NAMESPACE_1, TEST_AUTH_1, TEST_NAMESPACE_2, TEST_AUTH_2`

## Run

`npm run e2e`

## Test overview

Here is a quick overview of what is tested in [e2e.js](./e2e.js):

- init using bad credentials, auth is valid but namespace is not
  - `expect to throw ERROR_BAD_CREDENTIALS`
- key-value test, value is a string, uses 1 namespace
  - init using valid
  - test getting a non existing key:
    - `get(k) => expect undefined`
  - test getting an existing key:
    - `put(k,v)`
    - `get(k) => expect objectContaining({ value: v})`
  - test getting a deleted key:
    - `delete(k)`
    - `get(k) => expect undefined`
- key-value test, value is a multi layer object, uses 1 namespace
  - same assertions as above but with an object as value
- time-to-live test, value is an object, uses 1 namespace
  - init using valid credentials
  - test default ttl is set (86000s):
    - `put(k,v) ttl=undefined`
    - `get(k) => expect objectContaining({ expiration: Date + 86000s })`
  - test infinite ttl is set:
    - `put(k,v) ttl=-1`
    - `get(k) => expect objectContaining({ expiration: null })`
  - test object deletion after ttl:
    - `put(k,v) ttl=2s`
    - `get(k) => expect !undefined`
    - `waitFor(3s)`
    - `get => expect undefined`
- isolation test, uses two namespaces
  - init for ns1
  - init for ns2
  - test that ns2 cannot get state in ns1:
    - `put(k,v1) in ns1`
    - `get(k) in ns2 => expect undefined`
  - test that ns2 cannot update state in ns1:
    - `put(k,v2) in ns2`
    - `get(k) in ns1 => expect objectContaining({ value: v1 })`
  - test that ns1 cannot delete state in ns2:
    - `delete(k) in ns1`
    - `get(k) in ns2 => expect objectContaining({ value: v2 })`
  - cleanup:
  - `delete(k) in ns2`
- payload too large test, uses 1 namespace
  - test value > 2MB:
    - `put(k, bigValue) => expect to throw ERROR_PAYLOAD_TOO_LARGE`
