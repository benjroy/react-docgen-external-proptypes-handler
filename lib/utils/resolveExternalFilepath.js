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

  for (const ext of extensions) {
    if (fs.existsSync(`${srcPath}.${ext}`)) {
      return `${srcPath}.${ext}`;
    }
  }

  throw new Error(`Could not resolve one of filepaths: \n\t${extensions.map(ext => `${srcPath}.${ext}`).join('\n\t')}`);
}

// Thanks for the inspiration, @pasupuletics  https://github.com/pasupuletics/learning/blob/37d10ba5d2a9decb2d33e66441976e92910c7e26/react-docgen-external-proptypes-handler.js#L111
// and thanks for publishing, @siddharthkp    https://github.com/reactjs/react-docgen/issues/33#issuecomment-388288992