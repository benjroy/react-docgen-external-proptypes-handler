const fs = require('fs');
const { resolve, dirname } = require('path');
const recast = require('recast')
const docgen = require('react-docgen');
const babylon = require('react-docgen/dist/babylon').default
const setPropDescription = require('react-docgen/dist/utils/setPropDescription').default
const isRequiredPropType = require('react-docgen/dist/utils/isRequiredPropType').default
const resolveIdentifierNameToExternalValue = require('./lib/utils/resolveIdentifierNameToExternalValue');

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

function resolveMemberExpressionExternals({ path, filepath, ast, externalProps }, memberName) {
  console.log('resolveMemberExpressionExternals', memberName);
  types.MemberExpression.assert(path.node);

  const objectPath = path.get('object');
  const propertyPath = path.get('property');

  if (types.CallExpression.check(objectPath.node)) {
    return { path, filepath, ast, externalProps };
  }

  const key = propertyPath.node.name;
  const external = (types.MemberExpression.check(objectPath.node))
    ? resolveMemberExpressionExternals({ path: objectPath, filepath, ast, externalProps })
    : resolveIdentifierNameToExternalValue(objectPath.value.name, { ast,filepath });

  const valuePath = getMemberValuePath(external.path, key);

  return resolveExternals({
    ...external,
    externalProps,
    path: valuePath
  });
}

// TODO: externalProps collector {} should turn into callback interface
function resolveExternals({ path, filepath, ast, externalProps }) {
  switch(path.node.type) {
    case types.Property.name: {
      const resolved = resolveExternals({ path: path.get('value'), filepath, ast, externalProps });

      if (isPropTypesExpression(resolved.path)) {
        const propName = getPropertyName(path);

        Object.assign(externalProps, {
          [propName]: {
            propertyPath: path,
            valuePath: resolved.path,
          }
        });
      }
      break;
    }
    case types.Identifier.name: {
      console.log('resolveExternals Identifier', path.value.name);
      const externalValue = resolveIdentifierNameToExternalValue(path.value.name, { ast,filepath });
      console.log('resolveExternals Identifier externalValue', externalValue);
      const resolved = resolveExternals({
        externalProps,
        // resolve variable and spread ...{ path, ast, filepath }
        // ...resolveIdentifierNameToExternalValue(path.value.name, { ast,filepath }),
        ...externalValue,
      });
      path.replace(resolved.path.value);
      return resolved;
    }
    case types.SpreadProperty.name: {
      return resolveExternals({ path: path.get('argument'), filepath, ast, externalProps });
      break;
    }

    case types.ObjectExpression.name: {
      path.get('properties').each((propertyPath) => {
        resolveExternals({ path: propertyPath, filepath, ast, externalProps });
      });
      break;
    }
    case types.ArrayExpression.name: {
      path.get('elements').each((elPath) => {
        resolveExternals({ path: elPath, filepath, ast, externalProps });
      });
      break;
    }
    case types.CallExpression.name: {
      console.log('resolveExternalsCallExpression', path);
      path.get('arguments').each((argPath) => {
        resolveExternals({ path: argPath, filepath, ast, externalProps });
      });
      break;
    }

    case types.MemberExpression.name: {
      if (isPropTypesExpression(path)) {
        ([path.get('object'), path.get('property')]).forEach((targetPath) => {
          if (!types.Identifier.check(targetPath.node)) {
            // recurse into .oneOf([ ... ]), .shape({ ... })
            // and other PropTypes CallExpressions
            resolveExternals({ path: targetPath, filepath, ast, externalProps });
          }
        });
      } else {
        const resolved = resolveMemberExpressionExternals({ path, filepath, ast, externalProps });
        path.replace(resolved.path.value);
      }
      break;
    }

    case types.ArrowFunctionExpression.name:
    case types.Literal.name: {
      break;
    }
    default: {
      console.log('resolveExternals UNHANDLED', path.node);
      console.log('2 resolveExternals UNHANDLED', path.node.type);
      // TODO: temp error
      throw new Error('resolveExternals UNHANDLED: ' + path.node.type);
    }
  }

  return { path, filepath, ast, externalProps };
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
        ast: propTypesPath.scope.getGlobalScope().node,
        externalProps: {},
      });
      console.log('at end externalProps', resolved);
      // console.log(recast.print(propTypesPath).code);
      const externalProps = resolved.externalProps;

      Object.keys(externalProps).forEach(
        (propName) => {
          const { propertyPath, valuePath } = externalProps[propName];

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
