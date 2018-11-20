const recast = require('recast');
const babylon = require('react-docgen/dist/babylon').default;

module.exports = function getAst(src) {
  return recast.parse(src, {
    source: 'module',
    esprima: babylon,
  });
}
