#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const semver = require('semver')
const debug = require('debug')('catfood')
var install = require('npm-install-package')

if (process.env.NODE_ENV !== 'production') {
  // get dependencies from ssb-server
  const fullPath = path.join(__dirname, 'package.json')
  debug('getting dependencies from %s', fullPath)
  const pkg = JSON.parse(fs.readFileSync(fullPath))
  const parent = Object.assign({}, pkg.dependencies, pkg.devDependencies)

  debug('parent dependencies: %O', parent)

  // initialize empty array for new deps needed
  const needDeps = []

  // get dependencies from dep directories
  Object.keys(parent).forEach(moduleName => {
    const fullPath = path.join(__dirname, 'node_modules', moduleName, 'package.json')
    debug('getting dependencies from %s', fullPath)
    const module = JSON.parse(fs.readFileSync(fullPath))
    const moduleDeps = module.devDependencies || {}

    debug('module dependencies: %O', moduleDeps)

    Object.entries(moduleDeps).forEach(e => {
      const [ depName, depRange ] = e

      debug({ depName, depRange })
      if (Object.keys(parent).includes(depName)) {
        if (depName !== pkg.name) {
          if (needDeps[depName] == null) {
            debug('new dependency from %s: %o', moduleName, {
              name: depName, range: depRange
            })
            needDeps[depName] = depRange
          } else {
            // We want to ensure that the this range is compatible with both:
            //
            // - the parent dependency
            // - the needed dependency
            const pairs = [
              [needDeps[depName], depRange],
              [parent[depName], depRange]
            ]

            debug(depName, pairs)

            pairs.forEach(pair => {
              if (semver.intersects(pair[0], pair[1]) === false) {
                throw new Error('plugins have incompatible devDependencies, for:' + depName + ' ' + pair.join(' '))
              }
            })
          }
        }
      }
    })
  })

  const devDeps = Object.entries(needDeps).map(e => [e[0], e[1]].join('@'))

  if (devDeps.length > 0) {
    debug('installing: %O', devDeps)
    var opts = { saveDev: true, cache: true }

    debug.enabled = true
    debug('installing new plugin devDependencies')
    install(devDeps, opts, function (err) {
      if (err) throw err
      // avoid tests passing via Travis CI if dependencies are out-of-date
      debug('done! please re-run tests with these new dependencies')
      process.exit(1)
    })
  } else {
    debug('plugin devDeps look great!')
  }
}
