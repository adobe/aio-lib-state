## Classes

<dl>
<dt><a href="#StateStore">StateStore</a></dt>
<dd><p>Cloud State Management</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#init">init([config])</a> ⇒ <code><a href="#StateStore">Promise.&lt;StateStore&gt;</a></code></dt>
<dd><p>Initializes and returns the key-value-store SDK.</p>
<p>To use the SDK you must either provide your
<a href="#OpenWhiskCredentials">OpenWhisk credentials</a> in
<code>config.ow</code> or your own
<a href="#AzureCosmosMasterCredentials">Azure Cosmos credentials</a> in <code>config.cosmos</code>.</p>
<p>OpenWhisk credentials can also be read from environment variables <code>__OW_NAMESPACE</code> and <code>__OW_API_KEY</code>.</p>
</dd>
</dl>

## Typedefs

<dl>
<dt><a href="#OpenWhiskCredentials">OpenWhiskCredentials</a> : <code>object</code></dt>
<dd><p>An object holding the OpenWhisk credentials</p>
</dd>
<dt><a href="#AzureCosmosPartitionResourceCredentials">AzureCosmosPartitionResourceCredentials</a> : <code>object</code></dt>
<dd><p>An object holding the Azure Cosmos resource credentials with permissions on a single partition and container</p>
</dd>
<dt><a href="#AzureCosmosMasterCredentials">AzureCosmosMasterCredentials</a> : <code>object</code></dt>
<dd><p>An object holding the Azure Cosmos account master key</p>
</dd>
<dt><a href="#StateStorePutOptions">StateStorePutOptions</a> : <code>object</code></dt>
<dd><p>StateStore put options</p>
</dd>
<dt><a href="#StateStoreGetReturnValue">StateStoreGetReturnValue</a> : <code>object</code></dt>
<dd><p>StateStore get return object</p>
</dd>
<dt><a href="#StateLibErrors">StateLibErrors</a> : <code>object</code></dt>
<dd><p>State lib custom errors.
<code>e.sdkDetails</code> provides additional context for each error (e.g. function parameter)</p>
</dd>
</dl>

<a name="StateStore"></a>

## *StateStore*
Cloud State Management

**Kind**: global abstract class  

* *[StateStore](#StateStore)*
    * *[.get(key)](#StateStore+get) ⇒ [<code>Promise.&lt;StateStoreGetReturnValue&gt;</code>](#StateStoreGetReturnValue)*
    * *[.getAllKeys()](#StateStore+getAllKeys) ⇒ <code>Array.&lt;string&gt;</code>*
    * *[.put(key, value, [options])](#StateStore+put) ⇒ <code>Promise.&lt;string&gt;</code>*
    * *[.delete(key)](#StateStore+delete) ⇒ <code>Promise.&lt;string&gt;</code>*
    * *[._get(key)](#StateStore+_get) ⇒ [<code>Promise.&lt;StateStoreGetReturnValue&gt;</code>](#StateStoreGetReturnValue)*
    * *[._getAllKeys()](#StateStore+_getAllKeys) ⇒ <code>Array.&lt;string&gt;</code>*
    * *[._put(key, value, options)](#StateStore+_put) ⇒ <code>Promise.&lt;string&gt;</code>*
    * *[._delete(key)](#StateStore+_delete) ⇒ <code>Promise.&lt;string&gt;</code>*

<a name="StateStore+get"></a>

### *stateStore.get(key) ⇒ [<code>Promise.&lt;StateStoreGetReturnValue&gt;</code>](#StateStoreGetReturnValue)*
Retrieves the state value for given key.
If the key doesn't exist returns undefined.

**Kind**: instance method of [<code>StateStore</code>](#StateStore)  
**Returns**: [<code>Promise.&lt;StateStoreGetReturnValue&gt;</code>](#StateStoreGetReturnValue) - get response holding value and additional info  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | state key identifier |

<a name="StateStore+getAllKeys"></a>

### *stateStore.getAllKeys() ⇒ <code>Array.&lt;string&gt;</code>*
Retrieves the keys of all stored values.
If there are no keys returns undefined.

**Kind**: instance method of [<code>StateStore</code>](#StateStore)  
**Returns**: <code>Array.&lt;string&gt;</code> - Array with all the keys  
<a name="StateStore+put"></a>

### *stateStore.put(key, value, [options]) ⇒ <code>Promise.&lt;string&gt;</code>*
Creates or updates a state key-value pair

**Kind**: instance method of [<code>StateStore</code>](#StateStore)  
**Returns**: <code>Promise.&lt;string&gt;</code> - key  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| key | <code>string</code> |  | state key identifier |
| value | <code>any</code> |  | state value |
| [options] | [<code>StateStorePutOptions</code>](#StateStorePutOptions) | <code>{}</code> | put options |

<a name="StateStore+delete"></a>

### *stateStore.delete(key) ⇒ <code>Promise.&lt;string&gt;</code>*
Deletes a state key-value pair

**Kind**: instance method of [<code>StateStore</code>](#StateStore)  
**Returns**: <code>Promise.&lt;string&gt;</code> - key of deleted state or `null` if state does not exists  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | state key identifier |

<a name="StateStore+_get"></a>

### *stateStore.\_get(key) ⇒ [<code>Promise.&lt;StateStoreGetReturnValue&gt;</code>](#StateStoreGetReturnValue)*
**Kind**: instance method of [<code>StateStore</code>](#StateStore)  
**Returns**: [<code>Promise.&lt;StateStoreGetReturnValue&gt;</code>](#StateStoreGetReturnValue) - get response holding value and additional info  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | state key identifier |

<a name="StateStore+_getAllKeys"></a>

### *stateStore.\_getAllKeys() ⇒ <code>Array.&lt;string&gt;</code>*
**Kind**: instance method of [<code>StateStore</code>](#StateStore)  
**Returns**: <code>Array.&lt;string&gt;</code> - Array with all the keys  
<a name="StateStore+_put"></a>

### *stateStore.\_put(key, value, options) ⇒ <code>Promise.&lt;string&gt;</code>*
**Kind**: instance method of [<code>StateStore</code>](#StateStore)  
**Returns**: <code>Promise.&lt;string&gt;</code> - key  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | state key identifier |
| value | <code>any</code> | state value |
| options | <code>object</code> | state put options |

<a name="StateStore+_delete"></a>

### *stateStore.\_delete(key) ⇒ <code>Promise.&lt;string&gt;</code>*
**Kind**: instance method of [<code>StateStore</code>](#StateStore)  
**Returns**: <code>Promise.&lt;string&gt;</code> - key of deleted state or `null` if state does not exists  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | state key identifier |

<a name="init"></a>

## init([config]) ⇒ [<code>Promise.&lt;StateStore&gt;</code>](#StateStore)
Initializes and returns the key-value-store SDK.

To use the SDK you must either provide your
[OpenWhisk credentials](#OpenWhiskCredentials) in
`config.ow` or your own
[Azure Cosmos credentials](#AzureCosmosMasterCredentials) in `config.cosmos`.

OpenWhisk credentials can also be read from environment variables `__OW_NAMESPACE` and `__OW_API_KEY`.

**Kind**: global function  
**Returns**: [<code>Promise.&lt;StateStore&gt;</code>](#StateStore) - A StateStore instance  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [config] | <code>object</code> | <code>{}</code> | used to init the sdk |
| [config.ow] | [<code>OpenWhiskCredentials</code>](#OpenWhiskCredentials) |  | [OpenWhiskCredentials](#OpenWhiskCredentials). Set those if you want to use ootb credentials to access the state management service. OpenWhisk namespace and auth can also be passed through environment variables: `__OW_NAMESPACE` and `__OW_API_KEY` |
| [config.cosmos] | [<code>AzureCosmosMasterCredentials</code>](#AzureCosmosMasterCredentials) \| [<code>AzureCosmosPartitionResourceCredentials</code>](#AzureCosmosPartitionResourceCredentials) |  | [Azure Cosmos resource credentials](#AzureCosmosPartitionResourceCredentials) or [Azure Cosmos account credentials](#AzureCosmosMasterCredentials) |
| [config.tvm] | <code>object</code> |  | tvm configuration, applies only when passing OpenWhisk credentials |
| [config.tvm.apiUrl] | <code>string</code> |  | alternative tvm api url. |
| [config.tvm.cacheFile] | <code>string</code> |  | alternative tvm cache file, set to `false` to disable caching of temporary credentials. |

<a name="OpenWhiskCredentials"></a>

## OpenWhiskCredentials : <code>object</code>
An object holding the OpenWhisk credentials

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| namespace | <code>string</code> | user namespace |
| auth | <code>string</code> | auth key |

<a name="AzureCosmosPartitionResourceCredentials"></a>

## AzureCosmosPartitionResourceCredentials : <code>object</code>
An object holding the Azure Cosmos resource credentials with permissions on a single partition and container

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| endpoint | <code>string</code> | cosmosdb resource endpoint |
| resourceToken | <code>string</code> | cosmosdb resource token restricted to the partitionKey |
| databaseId | <code>string</code> | id for cosmosdb database |
| containerId | <code>string</code> | id for cosmosdb container within database |
| partitionKey | <code>string</code> | key for cosmosdb partition within container authorized by resource token |

<a name="AzureCosmosMasterCredentials"></a>

## AzureCosmosMasterCredentials : <code>object</code>
An object holding the Azure Cosmos account master key

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| endpoint | <code>string</code> | cosmosdb resource endpoint |
| masterKey | <code>string</code> | cosmosdb account masterKey |
| databaseId | <code>string</code> | id for cosmosdb database |
| containerId | <code>string</code> | id for cosmosdb container within database |
| partitionKey | <code>string</code> | key for cosmosdb partition where data will be stored |

<a name="StateStorePutOptions"></a>

## StateStorePutOptions : <code>object</code>
StateStore put options

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| ttl | <code>number</code> | time-to-live for key-value pair in seconds, defaults to 24 hours (86400s). Set to < 0 for no expiry. A value of 0 sets default. |

<a name="StateStoreGetReturnValue"></a>

## StateStoreGetReturnValue : <code>object</code>
StateStore get return object

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| expiration | <code>string</code> \| <code>null</code> | ISO date string of expiration time for the key-value pair, if the ttl is infinite expiration=null |
| value | <code>any</code> | the value set by put |

<a name="StateLibErrors"></a>

## StateLibErrors : <code>object</code>
State lib custom errors.
`e.sdkDetails` provides additional context for each error (e.g. function parameter)

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| ERROR_BAD_ARGUMENT | <code>StateLibError</code> | this error is thrown when an argument is missing or has invalid type |
| ERROR_NOT_IMPLEMENTED | <code>StateLibError</code> | this error is thrown when a method is not implemented or when calling methods directly on the abstract class (StateStore). |
| ERROR_PAYLOAD_TOO_LARGE | <code>StateLibError</code> | this error is thrown when the state key, state value or underlying request payload size exceeds the specified limitations. |
| ERROR_BAD_CREDENTIALS | <code>StateLibError</code> | this error is thrown when the supplied init credentials are invalid. |
| ERROR_INTERNAL | <code>StateLibError</code> | this error is thrown when an unknown error is thrown by the underlying DB provider or TVM server for credential exchange. More details can be found in `e.sdkDetails._internal`. |

