const fs = require('fs');
const { resolve, dirname } = require('path');
const recast = require('recast')
const docgen = require('react-docgen');
const babylon = require('react-docgen/dist/babylon').default
const setPropDescription = require('react-docgen/dist/utils/setPropDescription').default
const isRequiredPropType = require('react-docgen/dist/utils/isRequiredPropType').default
const getMemberExpressionValuePath = require('react-docgen/dist/utils/getMemberExpressionValuePath').default
const resolveToValueExternal = require('./lib/utils/resolveToValueExternal');
const isPropTypesExpression = require('./lib/utils/isPropTypesExpression');



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
  // more appended
  isReactComponentClass,
  isReactCreateClassCall,
  isReactComponentMethod,
  isStatelessComponent,

} = docgen.utils;


const {
  types: { namedTypes: types },
  builders: b,
} = recast;


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


// TODO: shouldn't need externalProps
function resolveExternals({ path, filepath, ast, externalProps }) {
  switch(path.node.type) {
    case types.Property.name: {
      const resolved = resolveToValueExternal(path.get('value'), { ast, filepath });
      resolveExternals({ ...resolved, externalProps });

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
      const resolved = resolveToValueExternal(path, { ast,filepath });
      resolveExternals({ ...resolved, externalProps });
      path.replace(resolved.path.value);
      break;
    }
    case types.SpreadProperty.name: {
      resolveExternals({ path: path.get('argument'), filepath, ast, externalProps });
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
        if (types.CallExpression.check(path.node.object)) {
          break;
        }

        const external = resolveToValueExternal(path.get('object'), { ast,filepath });

        if (
          types.CallExpression.check(external.path.node) ||
          types.MemberExpression.check(external.path.node)
        ) {
          // return external;
          break;
        }

        const valuePath = getMemberValuePath(external.path, getNameOrValue(path.get('property')));

        resolveExternals({
          ...external,
          externalProps,
          path: valuePath
        });
        break;
      }
      break;
    }
    default: {
      break;
    }
  }

  return { path, filepath, ast, externalProps };
}


function getExternalPropTypeHandler(propName) {
  return function getExternalPropTypeHandlerForFilePath(filepath) {
    // relative filepaths are resolved to current working directory
    if (!filepath.startsWith('/')) {
      filepath = resolve(process.cwd(), filepath);
    }

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

      const externalProps = {};

      const resolved = resolveExternals({
        path: propTypesPath,
        filepath,
        ast: propTypesPath.scope.getGlobalScope().node,
        externalProps
      });

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
