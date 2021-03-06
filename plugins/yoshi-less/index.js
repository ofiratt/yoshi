'use strict';

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const gulp = require('gulp');
const nodeLess = require('less');
const {writeFile, ensureDir} = require('fs-promise');

function writeFileIntoDir(filepath, content) {
  return ensureDir(path.dirname(filepath)).then(() => writeFile(filepath, content));
}

function readDir(pattern) {
  return glob.sync(pattern).filter(file => path.basename(file)[0] !== '_');
}

function renderLess(fileContent, options) {
  return new Promise((resolve, reject) =>
    nodeLess.render(fileContent, options, (err, result) => err ? reject(err) : resolve(result))
  );
}

function renderFile(file, outputDirs) {
  const options = {
    paths: ['.', 'node_modules', path.dirname(file)],
    filename: path.basename(file),
  };

  // @import "~foo/bar"; should import "node_modules/foo/bar.less".
  // this syntax is required by the less webpack loader. When using
  // this task for transpiling, dropping the ~.

  const fileContent = fs.readFileSync(file, 'utf-8')
    .replace(/(^@import.*)(~)/gm, '$1');

  return renderLess(fileContent, options)
    .then(result => Promise.all(
      outputDirs.map(dir => writeFileIntoDir(path.resolve(dir, file), result.css))
    )).catch(err => {
      throw `[${err.filename}] ${err.message}`;
    });
}

module.exports = ({logIf, watch, base, projectConfig}) => {
  const pattern = `${base()}/**/*.less`;

  const outputDirs = ['dist'];

  if (projectConfig.isEsModule() && !watch) {
    outputDirs.push('dist/es');
  }

  function less() {
    if (watch) {
      gulp.watch(pattern, () => transpile(pattern));
    }

    return transpile(pattern);
  }

  function transpile() {
    return Promise.all(readDir(pattern).map(file => renderFile(file, outputDirs)));
  }

  return logIf(less, () => readDir(pattern).length > 0);
};
