'use strict'

const isTravis = () => process.env.TRAVIS === 'true'
const isCircle = () => process.env.CIRCLECI === 'true'
const isAppVeyor = () => Boolean(process.env.APPVEYOR)
const isGitHubActions = () => process.env.GITHUB_ACTIONS === 'true'

/**
 * Returns true if the Travis CI is building a pull request from
 * a remote repository fork. This means the environment variables
 * are NOT set.
 *
 * @see https://docs.travis-ci.com/user/environment-variables/
 */
const isForkPrTravis = () => {
  if (process.env.TRAVIS !== 'true') {
    return false
  }

  // for pull requests, Travis sets a number. Otherwise it has value "false"
  if (process.env.TRAVIS_PULL_REQUEST === 'false') {
    return false
  }
  return process.env.TRAVIS_REPO_SLUG !== process.env.TRAVIS_PULL_REQUEST_SLUG
}

const isString = s => typeof s === 'string'
const isStringTruthy = s => isString(s) && (s === '1' || s === 'true')

/**
 * Returns true if this is CircleCI building forked PR from another repo.
 *
 * @see https://circleci.com/docs/2.0/env-vars/
 */
const isForkPrCircle = () => {
  if (process.env.CIRCLECI !== 'true') {
    return false
  }

  if (!process.env.CIRCLE_PR_NUMBER) {
    return false
  }
  return (
    isString(process.env.CIRCLE_PR_USERNAME) &&
    isString(process.env.CIRCLE_PR_REPONAME)
  )
}

/**
 * Returns true if this is AppVeyor building forked PR from another repo.
 *
 * @see https://github.com/bahmutov/is-fork-pr/issues/87
 */
const isForkPrAppVeyor = () => {
  const {
    APPVEYOR,
    APPVEYOR_REPO_NAME,
    APPVEYOR_PULL_REQUEST_HEAD_REPO_NAME
  } = process.env

  if (
    !APPVEYOR ||
    !APPVEYOR_REPO_NAME ||
    !APPVEYOR_PULL_REQUEST_HEAD_REPO_NAME
  ) {
    return false
  }

  return APPVEYOR_REPO_NAME !== APPVEYOR_PULL_REQUEST_HEAD_REPO_NAME
}

/**
 * Returns true if running on GitHub Actions
 * and the current build is from forked repository pull request.
 * @see https://help.github.com/en/articles/virtual-environments-for-github-actions#environment-variables
 */
const isForkGitHubActions = () => {
  if (!isGitHubActions()) {
    return false
  }
  const { GITHUB_EVENT_NAME, GITHUB_HEAD_REF, GITHUB_BASE_REF } = process.env
  return (
    GITHUB_EVENT_NAME === 'pull_request' && GITHUB_HEAD_REF && GITHUB_BASE_REF
  )
}

/**
 * Fallback - if the user has set env variable IS_FORK_PR to "1" or "true",
 * we should assume this is a forked pull request.
 */
const isForkEnvVariableSet = () => isStringTruthy(process.env.IS_FORK_PR)

const isForkPr = () =>
  isForkPrTravis() ||
  isForkPrCircle() ||
  isForkPrAppVeyor() ||
  isForkGitHubActions() ||
  isForkEnvVariableSet()

/**
 * Returns the name of the detected supported CI.
 * If cannot detect a supported CI, returned undefined
 */
const getCiName = () => {
  if (isTravis()) {
    return 'Travis'
  }

  if (isCircle()) {
    return 'Circle'
  }

  if (isAppVeyor()) {
    return 'AppVeyor'
  }

  if (isGitHubActions()) {
    return 'GitHub Actions'
  }
}

module.exports = { getCiName, isForkPr }
