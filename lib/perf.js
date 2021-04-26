const { performance, PerformanceObserver } = require('perf_hooks')

/**
 * Create a Performance Observer.
 *
 * @param {object} [logger=console.log] the logger to use
 */
function createObserver (logger = console.log) {
  new PerformanceObserver((list, observer) => {
    list.getEntries().forEach(entry => {
      // first arg
      entry[0] = entry[0] || ''
      // function or measure
      const name = (entry.entryType === 'function') ? `${entry.name}(${entry[0]})` : entry.name
      // log the duration
      logger(`[${entry.entryType}] ${name} ${entry.duration}`)
    })
    observer.disconnect()
  })
    .observe({ entryTypes: ['function', 'measure'], buffered: true })
}

/**
 * Measure the performance of an async function.
 *
 * @param {string} tag the tag to use as a prefix for the performance measurement
 * @param {Function} asyncFn the async function to measure
 * @returns {object} the result from the async function
 */
async function perfAsyncMeasure (tag, asyncFn) {
  const p = perfMark(tag)
  p.start()
  const retVal = await asyncFn()
  p.end()
  p.measure()
  return retVal
}

/**
 * Performance wrapper for a tag.
 *
 * @param {string} tag the tag to use as a prefix for the performance measurement
 * @returns {object} the object to start/end/measure performance
 */
function perfMark (tag) {
  return {
    start: () => performance.mark(`${tag}-start`),
    end: () => performance.mark(`${tag}-end`),
    measure: () => performance.measure(tag, `${tag}-start`, `${tag}-end`)
  }
}

module.exports = {
  createObserver,
  perfMark,
  perfAsyncMeasure
}
