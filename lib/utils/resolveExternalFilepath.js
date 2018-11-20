const fs = require('fs');
const { resolve, dirname } = require('path');

/**
 * Resolves propTypes source file path relative to current component,
 * which resolves only file extension of type .js or .jsx
 *
 * @method resolveExternalFilepath
 * @param  {String} filepath  Relative file path of the component
 * @param  {String} modulePath Relative file path of a dependent component
 * @return {String} Resolved file path if file exist else null
 */
module.exports = function resolveExternalFilepath(filepath, modulePath) {
  const regEx = /\.(js|jsx)$/;
  const srcPath = resolve(dirname(filepath), modulePath);

  if (regEx.exec(srcPath)) return srcPath;

  const extensions = ['js', 'jsx'];

  for (let ext of extensions) {
    if (fs.existsSync(`${srcPath}.${ext}`)) {
      return `${srcPath}.${ext}`;
    }
  }

  // if (fs.existsSync(`${srcPath}.js`)) return 
  // extension = 
  // return `${srcPath}`
  // if (regEx.exec(srcPath)) {
  //   return srcPath
  // } else {
  //   srcPath += fs.existsSync(`${srcPath}.js`) ? '.js' : '.jsx'
  //   return srcPath
  // }
}
