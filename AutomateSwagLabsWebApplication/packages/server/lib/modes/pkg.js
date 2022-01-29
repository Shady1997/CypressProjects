const Promise = require('bluebird')
const pkg = require('../../../root')

module.exports = () => {
  return Promise.resolve(pkg)
}
