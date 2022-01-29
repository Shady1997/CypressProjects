#!/usr/bin/env node

const { getCiName, isForkPr } = require('..')

if (getCiName()) {
  console.log('detected CI', getCiName())
}
if (isForkPr()) {
  console.log('forked PR detected')
} else {
  console.log('NOT a forked PR')
}
