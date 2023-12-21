const cloneDeep = require('lodash.clonedeep')

/**
 * Replaces any hidden field values with the string '<hidden>'
 *
 * @param {object} sourceObj the object to needs fields hidden
 * @param {Array<string>} fieldsToHide the fields that need the value hidden
 * @returns {object} the source object but with the specified fields hidden
 */
function withHiddenFields (sourceObj, fieldsToHide) {
  if (!sourceObj || !Array.isArray(fieldsToHide)) {
    return sourceObj
  }

  const copyConfig = cloneDeep(sourceObj)
  fieldsToHide.forEach(f => {
    const keys = f.split('.')
    const lastKey = keys.slice(-1)[0]

    // keep last key
    const traverse = keys
      .slice(0, -1)
      .reduce((obj, k) => obj && obj[k], copyConfig)

    if (traverse && traverse[lastKey]) {
      traverse[lastKey] = '<hidden>'
    }
  })
  return copyConfig
}

module.exports = {
  withHiddenFields
}
