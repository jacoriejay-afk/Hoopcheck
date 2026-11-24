// Metro 0.83 expects the legacy callable CommonJS export and synchronous paths.
const { readFileSync } = require('node:fs');
const upstream = require('./dist/cjs/index.js');
function imageSize(input) {
  return upstream.imageSize(typeof input === 'string' ? readFileSync(input) : input);
}
module.exports = Object.assign(imageSize, upstream, { default: imageSize });
