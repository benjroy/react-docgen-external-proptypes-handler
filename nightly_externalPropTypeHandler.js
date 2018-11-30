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

console.log('nightly external');

// function isPropTypesExpression(path) {
//   const moduleName = resolveToModule(path);
//   if (moduleName) {
//     // console.log('isPropTypesExpression moduleName', moduleName)
//     return isReactModuleName(moduleName) || moduleName === 'ReactPropTypes';
//   }
//   return false;
// }

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
  // console.log('resolveMemberExpressionExternals', memberName);
  types.MemberExpression.assert(path.node);

  const objectPath = path.get('object');
  const propertyPath = path.get('property');

  if (types.CallExpression.check(objectPath.node)) {
    return { path, filepath, ast, externalProps };
  }

  const key = propertyPath.node.name;
  // const external = (types.MemberExpression.check(objectPath.node));
  //   ? resolveMemberExpressionExternals({ path: objectPath, filepath, ast, externalProps });
  //   : resolveToValueExternal(objectPath, { ast,filepath });
  //   // : resolveIdentifierNameToExternalValue(objectPath.value.name, { ast,filepath });

  // const external = resolveToValueExternal(objectPath, { ast,filepath })
  const external = resolveExternals({
    externalProps,
    ...resolveToValueExternal(objectPath, { ast,filepath })
  });

  console.log('External', external.path.node)

  if (
    types.CallExpression.check(external.path.node) ||
    types.MemberExpression.check(external.path.node)
  ) {
    return external;
  }

  const valuePath = getMemberValuePath(external.path, key);

  console.log('External valuePath', key, valuePath)

  // const valuePath = (types.MemberExpression.check(external.path.node))
  //   ? getMemberExpressionValuePath(external.path, key)
  //   : getMemberValuePath(external.path, key);

  // let valuePath;
  // if (types.MemberExpression.check(external.path.node)) {
  //   console.log('MemberExpression external.path.node', external.path.node);
  //   console.log('MemberExpression external.path.node. CODE', recast.print(external.path.node).code);

  //   valuePath = getMemberExpressionValuePath(external.path, key)
  // } else {
  //   valuePath = getMemberValuePath(external.path, key);
  // }

  return resolveExternals({
    ...external,
    externalProps,
    path: valuePath
  });
}

// TODO: externalProps collector {} should turn into callback interface
function resolveExternals({ path, filepath, ast, externalProps }) {
  // console.log('resolve externals', path.node.type);
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
      // console.log('resolveExternals Identifier', path.value.name);
      // const externalValue = resolveToValueExternal(path, { ast,filepath });
      // const externalValue = resolveIdentifierNameToExternalValue(path.value.name, { ast,filepath });
      // console.log('resolveExternals Identifier externalValue', externalValue);
      const resolved = resolveExternals({
        externalProps,
        // resolve variable and spread ...{ path, ast, filepath }
        // ...resolveIdentifierNameToExternalValue(path.value.name, { ast,filepath }),
        // ...externalValue,
        ...resolveToValueExternal(path, { ast,filepath }),
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
        // // path.replace(resolved.path.value);
        // const resolved = resolveToValueExternal(path, { ast, filepath });
        // // console.log('resolved MEMBEREXPRESSION', resolved.path.node);
        // console.log('resolved MEMBEREXPRESSION', resolved.filepath, recast.print(resolved.path.node).code);
        // console.log('1 resolved MEMBEREXPRESSION', filepath, recast.print(path.node).code);
        // console.log('22 resolved MEMBEREXPRESSION', resolved.filepath, resolved.path.node.type);
        // console.log('333 matches component?', {
        //   isReactComponentClass: isReactComponentClass(resolved.path),
        //   isReactCreateClassCall: isReactCreateClassCall(resolved.path),
        //   isReactComponentMethod: isReactComponentMethod(resolved.path),
        //   isStatelessComponent: isStatelessComponent(resolved.path),
        // });

        // return resolved;
        // return resolveExternals({
        //   externalProps,
        //   ...resolved,
        // });
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
      console.log('3 resolveExternals UNHANDLED CODE', recast.print(path.node).code);
      // TODO: temp error
      // throw new Error('resolveExternals UNHANDLED: ' + path.node.type);
    }
  }

  return { path, filepath, ast, externalProps };
}


function getExternalPropTypeHandler(propName) {
  // console.log('getExternalPropTypeHandler', propName);
  return function getExternalPropTypeHandlerForFilePath(filepath) {
    // console.log('getExternalPropTypeHandlerForFilePath', filepath);

    if (!filepath.startsWith('/')) {
      filepath = resolve(process.cwd(), filepath);
    }

    return function externalPropTypeHandler(documentation, path) {
      // console.log('externalPropTypeHandler', filepath, path);
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
      // console.log('getting memberValuePath', propName);
      let propTypesPath = getMemberValuePath(path, propName);
      if (!propTypesPath) {
        return;
      }
      // console.log('got memberValuePath', propName);

      const resolved = resolveExternals({
        path: propTypesPath,
        filepath,
        ast: propTypesPath.scope.getGlobalScope().node,
        externalProps: {},
      });
      // console.log(recast.print(propTypesPath).code);
      const externalProps = resolved.externalProps;
      // console.log('at end externalProps', { externalProps });

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
