const fs = require('fs');
const { resolve, dirname } = require('path');
const recast = require('recast')
const docgen = require('react-docgen');
const babylon = require('react-docgen/dist/babylon').default
const setPropDescription = require('react-docgen/dist/utils/setPropDescription').default
const isRequiredPropType = require('react-docgen/dist/utils/isRequiredPropType').default
const resolveIdentifierNameToExternalValue = require('./lib/utils/resolveIdentifierNameToExternalValue');
const getRoot = require('./lib/utils/getRoot');
const getAst = require('./lib/utils/getAst');
const {
  createExternalNodePath,
  isExternalNodePath,
  getExternalNodePath,
} = require('./lib/utils/externalNodePath');

const {
  getPropType,
  getPropertyName,
  getMemberValuePath,
  isReactModuleName,
  printValue,
  resolveToModule,
  resolveToValue,
  // appended
  getNameOrValue,
  getMemberExpressionRoot,
  getMembers,
  getMethodDocumentation,
  getParameterName,
  getPropertyValuePath,

} = docgen.utils;


const HOP = Object.prototype.hasOwnProperty
const createObject = Object.create


const {
  types: { namedTypes: types },
  builders: b,
} = recast;

function isPropTypesExpression(path) {
  const moduleName = resolveToModule(path);
  if (moduleName) {
    // console.log('isPropTypesExpression moduleName', moduleName)
    return isReactModuleName(moduleName) || moduleName === 'ReactPropTypes';
  }
  return false;
}

function amendPropType(path, { getDescriptor, documentation }) {
  types.Property.assert(path.node);

  const propName = getPropertyName(path);
  const propDescriptor = getDescriptor(propName);
  // const propDescriptor = getDescriptor(getPropertyName(path));
  const valuePath = path.get('value');
  // const valuePath = isExternalNodePath(path.get('value'))
  //   ? getExternalNodePath(path.get('value')).path
  //   : path.get('value');

  console.log('amendPropType', isExternalNodePath(path), isExternalNodePath(valuePath))
  const type = resolveExternalPropType(valuePath);

  // const type = isExternalPropTypesExpression(valuePath)
  //   ? getPropType(valuePath)
  //   : { name: 'custom', raw: printValue(valuePath) };

  if (type) {
    propDescriptor.type = type;
    propDescriptor.required =
      type.name !== 'custom' && isRequiredPropType(valuePath);
  }
  setPropDescription(documentation, path);

}


function resolveExternalPropType(path, options) {
  if (isExternalNodePath(path)) {
    const external = getExternalNodePath(path);
    // change scope
    console.log('I AM EXTERNAL', path)
    // TODO: not this way
    path = external.path;
    // return resolveExternalPropType(external.path, external.filepath, options);
  }

  const type = isPropTypesExpression(path)
    ? getPropType(path)
    : { name: 'custom', raw: printValue(path) };

  return type;
}


function resolveExternals(path, filepath, options) {
  // console.log('resolveExternals', path);
  if (isExternalNodePath(path)) {
    const external = getExternalNodePath(path);
    // change scope of path
    path = external.path;
    // change scope of filepath
    filepath = external.filepath;

    // return resolveExternals(external.path, external.filepath);
  }

  switch(path.node.type) {
    case types.Literal.name: {
      break;
    }
    case types.Property.name: {
      resolveExternals(path.get('value'), filepath, options);
      amendPropType(path, options);
      break;
    }
    case types.Identifier.name: {
      const resolved = resolveIdentifierNameToExternalValue(path.value.name, getRoot(path), filepath);
      const external = getExternalNodePath(resolved);
      resolveExternals(external.path, external.filepath, options);
      path.replace(external.path.value);
      break;
    }
    case types.SpreadProperty.name: {
      resolveExternals(path.get('argument'), filepath, options);
      break;
    }
    case types.ObjectExpression.name: {
      path.get('properties').each((propertyPath) => {
        resolveExternals(propertyPath, filepath, options);
      });
      break;
    }
    case types.ArrayExpression.name: {
      path.get('elements').each((elPath) => {
        resolveExternals(elPath, filepath, options);
      });
      break;
    }
    case types.CallExpression.name: {
      path.get('arguments').each((argPath) => {
        resolveExternals(argPath, filepath, options);
      });
      break;
    }
    case types.MemberExpression.name: {
      if (isPropTypesExpression(path)) {
        (['object', 'property']).forEach((key) => {
          const targetPath = path.get(key);
          if (types.Identifier.check(targetPath.node)) {
            return;
          }
          resolveExternals(targetPath, filepath, options);
        });
      } else {
        console.log('i am MemberExpression, not PropTypes, valuePath:', path);
        // TODO: temp throw erropr
        throw new Error('UNHANDLED non-PropTypes MemberExpression');
      }
      break;
    }
    default: {
      console.log('resolveExternals UNHANDLED', path.node.type);
      // TODO: temp error
      throw new Error('resolveExternals UNHANDLED: ' + path.node.type);
    }
  }

  return path;
}


function getExternalPropTypeHandler(propName) {
  return function getExternalPropTypeHandlerForFilePath(filepath) {
    return function externalPropTypeHandler(documentation, path) {
      let getDescriptor;
      switch (propName) {
        case 'childContextTypes':
          getDescriptor = documentation.getChildContextDescriptor;
          break;
        case 'contextTypes':
          getDescriptor = documentation.getContextDescriptor;
          break;
        default:
          getDescriptor = documentation.getPropDescriptor;
      }
      getDescriptor = getDescriptor.bind(documentation);

      let propTypesPath = getMemberValuePath(path, propName);
      if (!propTypesPath) {
        return;
      }

      if (types.Identifier.check(propTypesPath.node)) {
        const resolved = resolveIdentifierNameToExternalValue(propTypesPath.node.name, getRoot(propTypesPath), filepath);
        const { code } = recast.print(resolved.value);
        // maybe don't need this assert
        types.AssignmentExpression.assert(propTypesPath.parentPath.node);

        propTypesPath.parentPath.value.right = resolved.value;
        propTypesPath = resolveToValue(propTypesPath.parentPath);
      } else {
        propTypesPath = resolveToValue(propTypesPath);
      }

      if (!propTypesPath) {
        console.log('why did this return', propTypesPath);
        return;
      }


      const resolved = resolveExternals(propTypesPath, filepath, { getDescriptor, documentation });


      // console.log(recast.print(propTypesPath).code);

    };
  }
}


module.exports.propTypeHandler = getExternalPropTypeHandler('propTypes');
module.exports.contextTypeHandler = getExternalPropTypeHandler('contextTypes');
module.exports.childContextTypeHandler = getExternalPropTypeHandler('childContextTypes');
