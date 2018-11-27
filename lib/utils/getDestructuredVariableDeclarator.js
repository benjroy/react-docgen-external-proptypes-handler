const recast = require('recast');
const { utils: { getNameOrValue }} = require('react-docgen');

const {
  types: { namedTypes: types },
} = recast;

// TODO: call this resolveDestructuredVariableDeclarator or whatever the right vocabulary is
function getDestructuredVariableDeclarator(identifierPath) {
  types.Identifier.assert(identifierPath.node);
  let path = identifierPath.parentPath;
  while(path) {
    switch (path.node.type) {
      case types.Property.name:
      case types.ObjectPattern.name: {
        // continue loop
        path = path.parentPath;
        break;
      }
      case types.VariableDeclarator.name: {
        return path;
      }
      default: {
        // no other types should exist in the destructured object variable assignment
        return;
      }
    }
  }
}

module.exports = getDestructuredVariableDeclarator;

function _getDestructuredVariableDeclarator(identifierPath) {
  types.Identifier.assert(identifierPath.node);
  let path = identifierPath.parentPath;
  const keys = [];
  while(path) {
    switch (path.node.type) {
      case types.Property.name: {
        // continue loop
        console.log('keyPath', path.node)
        keys.push(getNameOrValue(path.get('key')));
        path = path.parentPath;
        break;        
      }
      case types.ObjectPattern.name: {
        // continue loop
        path = path.parentPath;
        break;
      }
      case types.VariableDeclarator.name: {
        // return path;
        return { path, keys };
      }
      default: {
        // no other types should exist in the destructured object variable assignment
        return;
      }
    }
  }
}


module.exports._getDestructuredVariableDeclarator = _getDestructuredVariableDeclarator;


