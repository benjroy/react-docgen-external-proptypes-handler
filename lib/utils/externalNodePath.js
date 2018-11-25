const recast = require('recast');

const {
  types: {
    namedTypes: types,
    NodePath,
  },
} = recast;

const HOP = Object.prototype.hasOwnProperty

const EXTERNAL_NODEPATH_KEYNAME = '___external___';

function isExternalNodePath(path) {
  if (!path instanceof NodePath) return false;
  if (!path.value) {
    console.trace('NO PATH.VALUE', path);
    // TODO: remove this debug block
  }
  if (!HOP.call(path.value, EXTERNAL_NODEPATH_KEYNAME)) return false;
  return true;
}

function createExternalNodePath(path, { ast, filepath }) {
  if (!path instanceof NodePath) {
    throw new Error('path must be a NodePath instance');
  }

  path.value[EXTERNAL_NODEPATH_KEYNAME] = { path, ast, filepath };

  if (types.ObjectExpression.check(path.node)) {
    path.get('properties').each(propertyPath => createExternalNodePath(propertyPath, { ast, filepath }));
    // path.get('properties').each(propertyPath => {
    //   console.log('IS EXTERNALIZED NODE PATH?', isExternalNodePath(propertyPath));
    //   // createExternalNodePath(propertyPath, { ast, filepath });
    //   // propertyPath.replace(externalizedPropertyPath);
    // });
  }
  return path;

  // return { path, ast, filepath };
}

// TODO: call all getExternalPath & ...
function getExternalNodePath(path) {
  return path.value[EXTERNAL_NODEPATH_KEYNAME];
}

module.exports.createExternalNodePath = createExternalNodePath;
module.exports.isExternalNodePath = isExternalNodePath;
module.exports.getExternalNodePath = getExternalNodePath