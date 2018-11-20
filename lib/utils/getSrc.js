const fs = require('fs');

/**
 * Accepts absolute path of a source file and returns the file source as string.
 * @method getSrc
 * @param  {String} filepath  File path of the component
 * @return {String} Source code of the given file if file exist else returns empty
 */
module.exports = function getSrc(filepath) {
  if (fs.existsSync(filepath) === false) return;
  return fs.readFileSync(filepath, 'utf-8');
}
