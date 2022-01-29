if (process.env.CYPRESS_ENV !== 'production') {
  require('../ts/register')
}

module.exports = require('./lib')
