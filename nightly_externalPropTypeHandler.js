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

// function amendPropTypes(getDescriptor, path, documentation, filepath) {
//   if (!types.ObjectExpression.check(path.node)) {
//     console.log('BAILING', path);
//     // temp error
//     throw new Error('bailing but should not have had to');
//     return;
//   }

//   path.get('properties').each(function(propertyPath) {
//     switch (propertyPath.node.type) {
//       case types.Property.name: {
//         let propPath = propertyPath;
//         if (isExternalNodePath(propertyPath)) {
//           const external = getExternalNodePath(propertyPath);
//           propPath = external.path;
//           // change scope of filepath
//           filepath = external.filepath;
//         }
//         const propName = getPropertyName(propPath);
//         const propDescriptor = getDescriptor(propName);
//         // const propDescriptor = getDescriptor(getPropertyName(propPath));
//         const valuePath = propPath.get('value');
//         const type = isPropTypesExpression(valuePath)
//           ? getPropType(valuePath)
//           : { name: 'custom', raw: printValue(valuePath) };

//         if (type) {
//           propDescriptor.type = type;
//           propDescriptor.required =
//             type.name !== 'custom' && isRequiredPropType(valuePath);

//           if (type.name === 'custom') {
//             console.log('fix me', type.name, JSON.stringify(propDescriptor, null, 2));
//           }
//           if (type.name === 'enum') {
//             // const propValuePath = getPropertyValuePath(path, propName);
//             // console.log('match?', 'propValuePath:', propValuePath, '\n\nvaluePath:', valuePath);

//             // console.log('i am enum valuePath:', valuePath);
//             // const memberExpressionRoot = getMemberExpressionRoot(valuePath);
//             // console.log('i am enum memberExpressionRoot', memberExpressionRoot);
//             // const members = getMembers(valuePath);
//             // console.log('i am enum members', members[0] );


//           // getMemberExpressionRoot,
//           // getMembers,
//           // getMethodDocumentation,
//           // getParameterName,
//           // getPropertyValuePath,

//           }
//           replaceExternalValuesInPropDescriptor(propPath, propDescriptor, filepath);
//         }
//         setPropDescription(documentation, propPath);
//         break;
//       }
//       case types.SpreadElement.name:
//       case types.SpreadProperty.name: {
//         const resolvedValuePath = resolveToValue(propertyPath.get('argument'));
//         switch (resolvedValuePath.node.type) {
//           case types.ObjectExpression.name: // normal object literal
//             amendPropTypes(getDescriptor, resolvedValuePath, documentation, filepath);
//             break;
//         }
//         break;
//       }
//       default: {
//         console.log('amendPropTypes NO CASE', propertyPath.node.type);
//         // temp error
//         throw new Error('amendPropTypes NO CASE, should have had one');
//       }
//     }
//   });
// }

// function amendPropDescriptor()

// function _amendPropType(valuePath, { getDescriptor, documentation }) {
//   const path = valuePath.parentPath;
//   console.log('valuePath', valuePath.parentPath)
//   types.Property.assert(path.node);

//   const propName = getPropertyName(path);
//   const propDescriptor = getDescriptor(propName);
//   // const propDescriptor = getDescriptor(getPropertyName(path));
//   // const valuePath = path.get('value');
//   console.log('amendPropType', isExternalNodePath(path), isExternalNodePath(valuePath), isPropTypesExpression(valuePath))
//   const type = isPropTypesExpression(valuePath)
//     ? getPropType(valuePath)
//     : { name: 'custom', raw: printValue(valuePath) };

//   if (type) {
//     propDescriptor.type = type;
//     propDescriptor.required =
//       type.name !== 'custom' && isRequiredPropType(valuePath);
//   }
//   setPropDescription(documentation, path);

// }
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

function resolveExternalIdentifier(path, filepath, options) {
  types.Identifier.assert(path.node);

  const resolved = resolveIdentifierNameToExternalValue(path.value.name, getRoot(path), filepath);
  console.log('resolveExternalIdentifier', path.value.name, resolved);
  if (!resolved) {
    console.log('NOT RESOLVED', path);
  }
  const external = getExternalNodePath(resolved);
  resolveExternals(external.path, external.filepath, options);
  path.replace(external.path.value);

  // TODO: return { path, filepath, ast } here
  return path;
}

function resolveExternalsInArrayExpression(path, filepath, options) {
  types.ArrayExpression.assert(path.node);
  console.log('resolveExternalsInArrayExpression');

  path.get('elements').each((elPath) => {
    // if (types.Identifier.check(elPath.node)) {
    //   resolveExternalIdentifier(elPath, filepath, options);
    // }
    resolveExternals(elPath, filepath, options);
  });
  return path;
}

function resolveExternalsInCallExpression(path, filepath, options) {
  types.CallExpression.assert(path.node);
  console.log('resolveExternalsInCallExpression');

  path.get('arguments').each((argPath) => {
    // if (types.Identifier.check(argPath.node)) {
    //   resolveExternalIdentifier(argPath, filepath, options);
    // }
    resolveExternals(argPath, filepath, options);
  });

  return path;
}

function resolveExternalsInMemberExpression(path, filepath, options) {
  types.MemberExpression.assert(path.node);

  if (isPropTypesExpression(path)) {
    (['object', 'property']).forEach((key) => {
      const targetPath = path.get(key);
      if (types.Identifier.check(targetPath.node)) {
        return;
      }
      resolveExternals(targetPath, filepath, options);
    });
    return;
  }
  console.log('i am MemberExpression, not PropTypes, valuePath:', path);
  throw new Error('UNHANDLED non-PropTypes MemberExpression');
}

function resolveExternalsInProperty(path, filepath, options) {
  types.Property.assert(path.node);
  console.log('resolveExternalsInProperty TODO: clean me up more');


  const keyPath = path.get('key');
  const valuePath = path.get('value');

  // pretty sure this block is unnecessary
  if (
    !types.Identifier.check(keyPath.node)
    && !types.Literal.check(keyPath.node)
  ) {
    // temp error
    // console.log('property key should have been an identifier', propertyPath.get('key').value);
    console.log('property key should have been an Identifier or Literal', path);
    console.log('additional', filepath, path.get('key'));
    throw new Error('property key was not an identifier')
    return;
  }

  console.log('resolveExternalsInProperty path', keyPath.node.type);

  // console.log('i am enum valuePath:', valuePath);
  const memberExpressionRoot = getMemberExpressionRoot(valuePath);
  // console.log('i am enum memberExpressionRoot', memberExpressionRoot);
  const members = getMembers(valuePath);
  // console.log('i am enum members', members[0] );

  switch(valuePath.node.type) {
    case types.Identifier.name: {
      // console.log('Property value is Identifier', '\n\n', valuePath, '\n\n', valuePath.node.name);
      // console.log('Property value is Identifier code\n', recast.print(valuePath).code, '\n\n', filepath);
      // const resolvedValuePath = resolveIdentifierNameToExternalValue(valuePath.node.name, getRoot(path), filepath);
      // valuePath.replace(resolvedValuePath.value);

      // resolveExternalIdentifier(valuePath, filepath, options);
      resolveExternals(valuePath, filepath, options);      
      break;
    }

    case types.CallExpression.name: {
      // console.log('i am enum or maybe shape valuePath:', valuePath);
      // break;
      const resolved = resolveExternals(valuePath, filepath, options);
      // console.log('resolved i am enum or maybe shape valuePat', resolved);
      break;
    }

    case types.MemberExpression.name: {
      resolveExternals(valuePath, filepath, options);
      // if (isPropTypesExpression(valuePath)) {
      //   // .isRequired matched?
      //   resolveExternals(valuePath.get('property'), filepath, options);
      //   resolveExternals(valuePath.get('object'), filepath, options);
      //   break;
      // }
      // console.log('i am MemberExpression, not PropTypes, valuePath:', valuePath);
      // throw new Error('UNHANDLED non-PropTypes MemberExpression');
      break;
    }

    default: {
      console.log('UNHANDLED valuePath.node.type', valuePath.node.type);
      throw new Error('should not have hit');
      break;
    }
  }

  amendPropType(path, options);

  return path;
}

function resolveExternalsInSpreadProperty(path, filepath, options) {
  types.SpreadProperty.assert(path.node);
  console.log('resolveExternalsInSpreadProperty');

  const argPath = path.get('argument');

  switch(argPath.node.type) {
    case types.Identifier.name: {
      // const { path, ast, filepath } = resolveIdentifierNameToExternalValue(path.node.argument.name, getRoot(path), filepath);
      // resolved = resolveIdentifierNameToExternalValue(path.node.argument.name, getRoot(path), filepath);
      // resolveExternalIdentifier(argPath, filepath, options);
      resolveExternals(argPath, filepath, options);      
      break;
    }
    default: {
      resolveExternals(argPath, filepath, options);
    }
  }

  // overwrite the target value with the recursively processed ObjectExpression
  // propPath.node.argument = resolvedObjectExpression.value;
  types.ObjectExpression.assert(argPath.node);
  return path;
}

function resolveExternalsInObjectExpression(path, filepath, options) {
  types.ObjectExpression.assert(path.node);
  console.log('resolveExternalsInObjectExpression');

  path.get('properties').each((propertyPath) => {
    resolveExternals(propertyPath, filepath, options);
  });

  return path;
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
    case types.Identifier.name: {
      return resolveExternalIdentifier(path, filepath, options);
    }
    case types.ObjectExpression.name: {
      return resolveExternalsInObjectExpression(path, filepath, options);
    }
    case types.ArrayExpression.name: {
      return resolveExternalsInArrayExpression(path, filepath, options);
    }
    // TODO: do SpreadExpression so that path.node.value overwrite is not required
    case types.SpreadProperty.name: {
      // return resolveExternalsInSpreadProperty(path, filepath, options);
      const resolved = resolveExternalsInSpreadProperty(path, filepath, options);
      // path.get('argument').replace(resolved.value);
      // path.node.argument = resolved.value;
      return resolved;
      break;
    }
    case types.Property.name: {
      return resolveExternalsInProperty(path, filepath, options);
    }
    case types.CallExpression.name: {
      return resolveExternalsInCallExpression(path, filepath, options);
    }
    case types.MemberExpression.name: {
      return resolveExternalsInMemberExpression(path, filepath, options);
    }
    // case types.Identifier.name:
    case types.Literal.name: {
      return path;
    }
    default: {
      console.log('resolveExternals UNHANDLED', path.node.type);
      // TODO: temp error
      throw new Error('resolveExternals UNHANDLED: ' + path.node.type);
    }
  }
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

      // return;
      // _amendPropTypes()

      const resolved = resolveExternals(propTypesPath, filepath, { getDescriptor, documentation });

      // console.log('RESOLVED EXTERNALS', filepath, recast.print(propTypesPath).code);

      // amendPropTypes(getDescriptor, propTypesPath, documentation, filepath);
      // amendPropTypes(getDescriptor, resolvedObjectExpression, documentation);



      // take the values and replace them in the original ast
      // then reparse it or however that works
      // find the propTypes on the component

      console.log(recast.print(propTypesPath).code);


      // propTypesPath = resolveToValue(propTypesPath);
      // if (!propTypesPath) {
      //   return;
      // }


      // let getDescriptor;
      // switch (propName) {
      //   case 'childContextTypes':
      //     getDescriptor = documentation.getChildContextDescriptor;
      //     break;
      //   case 'contextTypes':
      //     getDescriptor = documentation.getContextDescriptor;
      //     break;
      //   default:
      //     getDescriptor = documentation.getPropDescriptor;
      // }
      // amendPropTypes(getDescriptor.bind(documentation), propTypesPath);
    };
  }

  // return function(documentation, path) {
  //   console.log('documentation', documentation);
  //   console.log('path', path)
  //   let propTypesPath = getMemberValuePath(path, propName);
  //   if (!propTypesPath) {
  //     return;
  //   }
  //   propTypesPath = resolveToValue(propTypesPath);
  //   if (!propTypesPath) {
  //     return;
  //   }
  //   let getDescriptor;
  //   switch (propName) {
  //     case 'childContextTypes':
  //       getDescriptor = documentation.getChildContextDescriptor;
  //       break;
  //     case 'contextTypes':
  //       getDescriptor = documentation.getContextDescriptor;
  //       break;
  //     default:
  //       getDescriptor = documentation.getPropDescriptor;
  //   }
  //   amendPropTypes(getDescriptor.bind(documentation), propTypesPath);
  // };
}


// function getPropTypeHandler(propName) {
//   return function(documentation, path) {
//     let propTypesPath = getMemberValuePath(path, propName);
//     if (!propTypesPath) {
//       return;
//     }
//     propTypesPath = resolveToValue(propTypesPath);
//     if (!propTypesPath) {
//       return;
//     }
//     let getDescriptor;
//     switch (propName) {
//       case 'childContextTypes':
//         getDescriptor = documentation.getChildContextDescriptor;
//         break;
//       case 'contextTypes':
//         getDescriptor = documentation.getContextDescriptor;
//         break;
//       default:
//         getDescriptor = documentation.getPropDescriptor;
//     }
//     amendPropTypes(getDescriptor.bind(documentation), propTypesPath);
//   };
// }


// export const propTypeHandler = getPropTypeHandler('propTypes');
// export const contextTypeHandler = getPropTypeHandler('contextTypes');
// export const childContextTypeHandler = getPropTypeHandler('childContextTypes');
// module.exports = getPropTypeHandler('propTypes');
module.exports.propTypeHandler = getExternalPropTypeHandler('propTypes');
module.exports.contextTypeHandler = getExternalPropTypeHandler('contextTypes');
module.exports.childContextTypeHandler = getExternalPropTypeHandler('childContextTypes');
