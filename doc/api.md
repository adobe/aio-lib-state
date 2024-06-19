## Classes

<dl>
<dt><a href="#AdobeState">AdobeState</a></dt>
<dd><p>Cloud State Management</p>
</dd>
</dl>

## Members

<dl>
<dt><a href="#MAX_TTL_SECONDS">MAX_TTL_SECONDS</a> : <code>number</code></dt>
<dd><p>Max supported TTL, 365 days in seconds</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#validate">validate(schema, data)</a> ⇒ <code>object</code></dt>
<dd><p>Validates json according to a schema.</p>
</dd>
<dt><a href="#handleResponse">handleResponse(response, params)</a> ⇒ <code>void</code></dt>
<dd><p>Handle a network response.</p>
</dd>
<dt><a href="#init">init([config])</a> ⇒ <code><a href="#AdobeState">Promise.&lt;AdobeState&gt;</a></code></dt>
<dd><p>Initializes and returns the key-value-store SDK.</p>
<p>To use the SDK you must either provide your
<a href="#OpenWhiskCredentials">OpenWhisk credentials</a> in
<code>config.ow</code> or your own</p>
<p>OpenWhisk credentials can also be read from environment variables <code>__OW_NAMESPACE</code> and <code>__OW_API_KEY</code>.</p>
</dd>
</dl>

## Typedefs

<dl>
<dt><a href="#AdobeStateCredentials">AdobeStateCredentials</a> : <code>object</code></dt>
<dd><p>AdobeStateCredentials</p>
</dd>
<dt><a href="#AdobeStatePutOptions">AdobeStatePutOptions</a> : <code>object</code></dt>
<dd><p>AdobeState put options</p>
</dd>
<dt><a href="#AdobeStateGetReturnValue">AdobeStateGetReturnValue</a> : <code>object</code></dt>
<dd><p>AdobeState get return object</p>
</dd>
<dt><a href="#OpenWhiskCredentials">OpenWhiskCredentials</a> : <code>object</code></dt>
<dd><p>An object holding the OpenWhisk credentials</p>
</dd>
<dt><a href="#AdobeStateLibError">AdobeStateLibError</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#AdobeStateLibErrors">AdobeStateLibErrors</a> : <code>object</code></dt>
<dd><p>Adobe State lib custom errors.
<code>e.sdkDetails</code> provides additional context for each error (e.g. function parameter)</p>
</dd>
</dl>

<a name="AdobeState"></a>

## *AdobeState*
Cloud State Management

**Kind**: global abstract class  

* *[AdobeState](#AdobeState)*
    * *[.getRegionalEndpoint(endpoint, region)](#AdobeState+getRegionalEndpoint) ⇒ <code>string</code>*
    * *[.get(key)](#AdobeState+get) ⇒ [<code>Promise.&lt;AdobeStateGetReturnValue&gt;</code>](#AdobeStateGetReturnValue)*
    * *[.put(key, value, [options])](#AdobeState+put) ⇒ <code>Promise.&lt;string&gt;</code>*
    * *[.delete(key)](#AdobeState+delete) ⇒ <code>Promise.&lt;string&gt;</code>*
    * *[.deleteAll()](#AdobeState+deleteAll) ⇒ <code>Promise.&lt;boolean&gt;</code>*
    * *[.any()](#AdobeState+any) ⇒ <code>Promise.&lt;boolean&gt;</code>*
    * *[.stats()](#AdobeState+stats) ⇒ <code>Promise.&lt;({bytesKeys: number, bytesValues: number, keys: number}\|boolean)&gt;</code>*
    * *[.list(options)](#AdobeState+list) ⇒ <code>AsyncGenerator.&lt;{keys: Array.&lt;string&gt;}&gt;</code>*

<a name="AdobeState+getRegionalEndpoint"></a>

### *adobeState.getRegionalEndpoint(endpoint, region) ⇒ <code>string</code>*
Gets the regional endpoint for an endpoint.

**Kind**: instance method of [<code>AdobeState</code>](#AdobeState)  
**Returns**: <code>string</code> - the endpoint, with the correct region  

| Param | Type | Description |
| --- | --- | --- |
| endpoint | <code>string</code> | the endpoint to test |
| region | <code>string</code> | the region to set |

<a name="AdobeState+get"></a>

### *adobeState.get(key) ⇒ [<code>Promise.&lt;AdobeStateGetReturnValue&gt;</code>](#AdobeStateGetReturnValue)*
Retrieves the state value for given key.
If the key doesn't exist returns undefined.

**Kind**: instance method of [<code>AdobeState</code>](#AdobeState)  
**Returns**: [<code>Promise.&lt;AdobeStateGetReturnValue&gt;</code>](#AdobeStateGetReturnValue) - get response holding value and additional info  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | state key identifier |

<a name="AdobeState+put"></a>

### *adobeState.put(key, value, [options]) ⇒ <code>Promise.&lt;string&gt;</code>*
Creates or updates a state key-value pair

**Kind**: instance method of [<code>AdobeState</code>](#AdobeState)  
**Returns**: <code>Promise.&lt;string&gt;</code> - key  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | state key identifier |
| value | <code>string</code> | state value |
| [options] | [<code>AdobeStatePutOptions</code>](#AdobeStatePutOptions) | put options |

<a name="AdobeState+delete"></a>

### *adobeState.delete(key) ⇒ <code>Promise.&lt;string&gt;</code>*
Deletes a state key-value pair

**Kind**: instance method of [<code>AdobeState</code>](#AdobeState)  
**Returns**: <code>Promise.&lt;string&gt;</code> - key of deleted state or `null` if state does not exist  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | state key identifier |

<a name="AdobeState+deleteAll"></a>

### *adobeState.deleteAll() ⇒ <code>Promise.&lt;boolean&gt;</code>*
Deletes all key-values

**Kind**: instance method of [<code>AdobeState</code>](#AdobeState)  
**Returns**: <code>Promise.&lt;boolean&gt;</code> - true if deleted, false if not  
<a name="AdobeState+any"></a>

### *adobeState.any() ⇒ <code>Promise.&lt;boolean&gt;</code>*
There exists key-values.

**Kind**: instance method of [<code>AdobeState</code>](#AdobeState)  
**Returns**: <code>Promise.&lt;boolean&gt;</code> - true if exists, false if not  
<a name="AdobeState+stats"></a>

### *adobeState.stats() ⇒ <code>Promise.&lt;({bytesKeys: number, bytesValues: number, keys: number}\|boolean)&gt;</code>*
Get stats.

**Kind**: instance method of [<code>AdobeState</code>](#AdobeState)  
**Returns**: <code>Promise.&lt;({bytesKeys: number, bytesValues: number, keys: number}\|boolean)&gt;</code> - namespace stats or false if not exists  
<a name="AdobeState+list"></a>

### *adobeState.list(options) ⇒ <code>AsyncGenerator.&lt;{keys: Array.&lt;string&gt;}&gt;</code>*
List keys, returns an iterator. Every iteration returns a batch of
approximately `countHint` keys.

**Kind**: instance method of [<code>AdobeState</code>](#AdobeState)  
**Returns**: <code>AsyncGenerator.&lt;{keys: Array.&lt;string&gt;}&gt;</code> - an async generator which yields a
  { keys } object at every iteration.  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>object</code> | list options |
| options.match | <code>string</code> | a glob pattern that supports '*' to filter   keys. |
| options.countHint | <code>number</code> | an approximate number on how many items   to return per iteration. Default: 100, min: 10, max: 1000. |

**Example**  
```js
for await (const { keys } of state.list({ match: 'abc*' })) {
   console.log(keys)
 }
```
<a name="MAX_TTL_SECONDS"></a>

## MAX\_TTL\_SECONDS : <code>number</code>
Max supported TTL, 365 days in seconds

**Kind**: global variable  
<a name="validate"></a>

## validate(schema, data) ⇒ <code>object</code>
Validates json according to a schema.

**Kind**: global function  
**Returns**: <code>object</code> - the result  

| Param | Type | Description |
| --- | --- | --- |
| schema | <code>object</code> | the AJV schema |
| data | <code>object</code> | the json data to test |

<a name="handleResponse"></a>

## handleResponse(response, params) ⇒ <code>void</code>
Handle a network response.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>Response</code> | a fetch Response |
| params | <code>object</code> | the params to the network call |

<a name="init"></a>

## init([config]) ⇒ [<code>Promise.&lt;AdobeState&gt;</code>](#AdobeState)
Initializes and returns the key-value-store SDK.

To use the SDK you must either provide your
[OpenWhisk credentials](#OpenWhiskCredentials) in
`config.ow` or your own

OpenWhisk credentials can also be read from environment variables `__OW_NAMESPACE` and `__OW_API_KEY`.

**Kind**: global function  
**Returns**: [<code>Promise.&lt;AdobeState&gt;</code>](#AdobeState) - An AdobeState instance  

| Param | Type | Description |
| --- | --- | --- |
| [config] | <code>object</code> | used to init the sdk |
| [config.ow] | [<code>OpenWhiskCredentials</code>](#OpenWhiskCredentials) | [OpenWhiskCredentials](#OpenWhiskCredentials). Set those if you want to use ootb credentials to access the state management service. OpenWhisk namespace and auth can also be passed through environment variables: `__OW_NAMESPACE` and `__OW_API_KEY` |

<a name="AdobeStateCredentials"></a>

## AdobeStateCredentials : <code>object</code>
AdobeStateCredentials

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| namespace | <code>string</code> | the state store namespace |
| apikey | <code>string</code> | the state store api key |
| region | <code>&#x27;amer&#x27;</code> \| <code>&#x27;apac&#x27;</code> \| <code>&#x27;emea&#x27;</code> | the region for the Adobe State Store. defaults to 'amer' |

<a name="AdobeStatePutOptions"></a>

## AdobeStatePutOptions : <code>object</code>
AdobeState put options

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| ttl | <code>number</code> | time-to-live for key-value pair in seconds, defaults to 24 hours (86400s). Set to < 0 for max ttl of one year. A value of 0 sets default. |

<a name="AdobeStateGetReturnValue"></a>

## AdobeStateGetReturnValue : <code>object</code>
AdobeState get return object

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| expiration | <code>string</code> | the ISO-8601 date string of the expiration time for the key-value pair |
| value | <code>string</code> | the value set by put |

<a name="OpenWhiskCredentials"></a>

## OpenWhiskCredentials : <code>object</code>
An object holding the OpenWhisk credentials

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| namespace | <code>string</code> | user namespace |
| auth | <code>string</code> | auth key |

<a name="AdobeStateLibError"></a>

## AdobeStateLibError : <code>object</code>
**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| message | <code>string</code> | The message for the Error |
| code | <code>string</code> | The code for the Error |
| sdk | <code>string</code> | The SDK associated with the Error |
| sdkDetails | <code>object</code> | The SDK details associated with the Error |

<a name="AdobeStateLibErrors"></a>

## AdobeStateLibErrors : <code>object</code>
Adobe State lib custom errors.
`e.sdkDetails` provides additional context for each error (e.g. function parameter)

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| ERROR_BAD_ARGUMENT | [<code>AdobeStateLibError</code>](#AdobeStateLibError) | this error is thrown when an argument is missing, has invalid type, or includes invalid characters. |
| ERROR_BAD_REQUEST | [<code>AdobeStateLibError</code>](#AdobeStateLibError) | this error is thrown when an argument has an illegal value. |
| ERROR_PAYLOAD_TOO_LARGE | [<code>AdobeStateLibError</code>](#AdobeStateLibError) | this error is thrown when the state key, state value or underlying request payload size exceeds the specified limitations. |
| ERROR_BAD_CREDENTIALS | [<code>AdobeStateLibError</code>](#AdobeStateLibError) | this error is thrown when the supplied init credentials are invalid. |
| ERROR_UNAUTHORIZED | [<code>AdobeStateLibError</code>](#AdobeStateLibError) | this error is thrown when the credentials are unauthorized to access the resource |
| ERROR_INTERNAL | [<code>AdobeStateLibError</code>](#AdobeStateLibError) | this error is thrown when an unknown error is thrown by the underlying DB provider or TVM server for credential exchange. More details can be found in `e.sdkDetails._internal`. |
| ERROR_REQUEST_RATE_TOO_HIGH | [<code>AdobeStateLibError</code>](#AdobeStateLibError) | this error is thrown when the request rate for accessing state is too high. |

