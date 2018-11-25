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
// const {
//   // createExternalNodePath,
//   // isExternalNodePath,
//   getExternalNodePath,
// } = require('./lib/utils/externalNodePath');

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

function amendPropType(propName, valuePath, getDescriptor) {
  const propDescriptor = getDescriptor(propName);
  const type = isPropTypesExpression(valuePath)
    ? getPropType(valuePath)
    : { name: 'custom', raw: printValue(valuePath) };

  if (type) {
    propDescriptor.type = type;
    propDescriptor.required =
      type.name !== 'custom' && isRequiredPropType(valuePath);
  }
}

// TODO: ast is undefined from other side
function resolveExternals({ path, filepath, ast, propExternals }) {
  // console.log('resolveExternals', path);
  if (!propExternals) {
    throw new Error('not here');
  }

  let external = {
    path,
    filepath,
    ast,
    propExternals,
  };

  switch(path.node.type) {
    case types.Literal.name: {
      break;
    }
    case types.Property.name: {
      const resolvedExt = resolveExternals({
            ...external,
            path: path.get('value'),
          });
      if (isPropTypesExpression(resolvedExt.path)) {
        const propName = getPropertyName(path);
        console.log('isPropTypesExpression', propName);

        Object.assign(external.propExternals, {
          ...resolvedExt.propExternals,
          // [key]: resolvedExt,
          [propName]: {
            // resolvedExt,
            propertyPath: path,
            valuePath: resolvedExt.path,
          }
        });
        // break;
      }

      // amendPropType(path, options);
      break;
    }
    case types.Identifier.name: {
      external = resolveIdentifierNameToExternalValue(path.value.name, {
        ast: getRoot(path),
        filepath
      });

      // external = resolveExternals({
      const resolvedExternal = resolveExternals({
            ...external,
            propExternals,
          });
      // path.replace(external.path.value);
      path.replace(resolvedExternal.path.value);
      return resolvedExternal;
      // break;
    }
    case types.SpreadProperty.name: {
      external = resolveExternals({
            ...external,
            path: path.get('argument'),
          });
      break;
    }
    case types.ObjectExpression.name: {
      path.get('properties').each((propertyPath) => {
        resolveExternals({
            ...external,
            path: propertyPath,
          });
      });
      break;
    }
    case types.ArrayExpression.name: {
      path.get('elements').each((elPath) => {
        resolveExternals({
            ...external,
            path: elPath,
          });
      });
      break;
    }
    case types.CallExpression.name: {
      path.get('arguments').each((argPath) => {
        resolveExternals({
            ...external,
            path: argPath,
          });
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
          resolveExternals({
            ...external,
            path: targetPath,
          });
        });
      } else {
        console.log('i am MemberExpression, not PropTypes, valuePath:', path);
        // TODO: temp throw erropr
        throw new Error('UNHANDLED non-PropTypes MemberExpression');
      }
      break;
    }
    default: {
      console.log('resolveExternals UNHANDLED', path.node);
      console.log('2 resolveExternals UNHANDLED', path.node.type);
      // TODO: temp error
      throw new Error('resolveExternals UNHANDLED: ' + path.node.type);
    }
  }


  return external;

  // const out = {
  //   ...external,
  // }

  // return out;
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

      const resolved = resolveExternals({
        path: propTypesPath,
        filepath,
        ast: undefined,
        propExternals: {},
      });
      console.log('at end propExternals', resolved);
      // console.log(recast.print(propTypesPath).code);
      const propExternals = resolved.propExternals;

      Object.keys(propExternals).forEach(
        (propName) => {
          const { propertyPath, valuePath } = propExternals[propName];

          amendPropType(propName, valuePath, getDescriptor);
          setPropDescription(documentation, propertyPath);
        }
      );

    };
  }
}


module.exports.propTypeHandler = getExternalPropTypeHandler('propTypes');
module.exports.contextTypeHandler = getExternalPropTypeHandler('contextTypes');
module.exports.childContextTypeHandler = getExternalPropTypeHandler('childContextTypes');
