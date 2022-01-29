if (process.env.CYPRESS_INTERNAL_ENV !== 'production') {
  require('../ts/register')
}

module.exports = require('./lib')
