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

// TODO change export assignment in module
const resolveToExternalValue = resolveIdentifierNameToExternalValue.resolveToExternalValue;

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

function replaceExternalValuesInPropDescriptor(propertyPath, propDescriptor, filepath) {
  const { type } = propDescriptor;
  const { name, value, raw, computed } = type;

  if (raw) {
    console.log(name, raw, filepath, JSON.stringify(propDescriptor, null, 2));
    return;
  }

  switch(type.name) {
    case 'custom': {
      console.log(name, 'not raw', filepath, JSON.stringify(propDescriptor, null, 2));
      break;
    }
    case 'enum': {
      if (computed) {
        const values = value.split('.');
        // const resolved = resolveIdentifierNameToExternalValue(values[0], getRoot(propertyPath), filepath);
        // // console.log('propertyPath', getPropertyValuePath(propertyPath));
        // console.log('resolved', name, resolved);

        const valuePath = propertyPath.get('value');
        // console.log('i am enum valuePath:', valuePath);
        const memberExpressionRoot = getMemberExpressionRoot(valuePath);
        // console.log('i am enum memberExpressionRoot', memberExpressionRoot);
        const members = getMembers(valuePath);
        // console.log('i am enum members', members[0] );

        types.CallExpression.assert(valuePath.node);
        const args = valuePath.get('arguments');
        if (args.value.length !== 1) {
          // TODO temp error
          console.log('expected only one argument to computed enum', args);
          throw new Error('expected only one argument to computed enum, got: ' + args.value.length);
        }

        const identifierPath = args.get(0);
        types.Identifier.assert(identifierPath.node);


        // console.log('identifierPath', identifierPath)
        // console.log('identifierPathResolvedValue', resolveToValue(identifierPath))
        // console.log('identifierPathModule', resolveToModule(identifierPath))


        // const resolved = resolveIdentifierNameToExternalValue(getNameOrValue(identifierPath), getRoot(propertyPath), filepath);
        // // console.log('propertyPath', getPropertyValuePath(propertyPath));
        // console.log('resolved', name, resolved);

        // console.log('out resolveToExternalValue', resolveToExternalValue(identifierPath));
          // getMemberExpressionRoot,
          // getMembers,
          // getMethodDocumentation,
          // getParameterName,
          // getPropertyValuePath,
          
        return;
      }
      console.log(name, filepath, JSON.stringify(propDescriptor, null, 2));
      break;
    }
    case 'shape': {
      console.log(name, filepath, JSON.stringify(propDescriptor, null, 2));
      break;
    }
    case 'arrayOf':
    case 'objectOf': {
      console.log(name, filepath, JSON.stringify(propDescriptor, null, 2));
      throw new Error('implement var replacement for ' + name);
      break;
    }
    default: {
      break;
    }
  }
}

function amendPropTypes(getDescriptor, path, documentation, filepath) {
  if (!types.ObjectExpression.check(path.node)) {
    console.log('BAILING', path);
    // temp error
    throw new Error('bailing but should not have had to');
    return;
  }

  path.get('properties').each(function(propertyPath) {
    switch (propertyPath.node.type) {
      case types.Property.name: {
        let propPath = propertyPath;
        if (isExternalNodePath(propertyPath)) {
          const external = getExternalNodePath(propertyPath);
          propPath = external.path;
          // change scope of filepath
          filepath = external.filepath;
        }
        const propName = getPropertyName(propPath);
        const propDescriptor = getDescriptor(propName);
        // const propDescriptor = getDescriptor(getPropertyName(propPath));
        const valuePath = propPath.get('value');
        const type = isPropTypesExpression(valuePath)
          ? getPropType(valuePath)
          : { name: 'custom', raw: printValue(valuePath) };

        if (type) {
          propDescriptor.type = type;
          propDescriptor.required =
            type.name !== 'custom' && isRequiredPropType(valuePath);

          if (type.name === 'custom') {
            console.log('fix me', type.name, JSON.stringify(propDescriptor, null, 2));
          }
          if (type.name === 'enum') {
            // const propValuePath = getPropertyValuePath(path, propName);
            // console.log('match?', 'propValuePath:', propValuePath, '\n\nvaluePath:', valuePath);

            // console.log('i am enum valuePath:', valuePath);
            // const memberExpressionRoot = getMemberExpressionRoot(valuePath);
            // console.log('i am enum memberExpressionRoot', memberExpressionRoot);
            // const members = getMembers(valuePath);
            // console.log('i am enum members', members[0] );


          // getMemberExpressionRoot,
          // getMembers,
          // getMethodDocumentation,
          // getParameterName,
          // getPropertyValuePath,

          }
          replaceExternalValuesInPropDescriptor(propPath, propDescriptor, filepath);
        }
        setPropDescription(documentation, propPath);
        break;
      }
      case types.SpreadElement.name:
      case types.SpreadProperty.name: {
        const resolvedValuePath = resolveToValue(propertyPath.get('argument'));
        switch (resolvedValuePath.node.type) {
          case types.ObjectExpression.name: // normal object literal
            amendPropTypes(getDescriptor, resolvedValuePath, documentation, filepath);
            break;
        }
        break;
      }
      default: {
        console.log('amendPropTypes NO CASE', propertyPath.node.type);
        // temp error
        throw new Error('amendPropTypes NO CASE, should have had one');
      }
    }
  });
}

function resolveExternalsInArrayExpression(path, filepath) {
  types.ArrayExpression.assert(path.node);
  console.log('resolveExternalsInArrayExpression');
}

function resolveExternalsInProperty(path, filepath) {
  types.Property.assert(path.node);
  console.log('resolveExternalsInProperty');

  return;

  const keyPath = path.get('key');

  switch(keyPath.node.type) {
    case types.Identifier.name: // Identifier might break if it is a different reference, but maybe that would be ArrayExpression in that case?
    case types.Literal.name: {
      // break;

      console.log('resolveExternalsInProperty path', keyPath.node.type, path.get('value'));

      const valuePath = path.get('value');
      // console.log('i am enum valuePath:', valuePath);
      const memberExpressionRoot = getMemberExpressionRoot(valuePath);
      // console.log('i am enum memberExpressionRoot', memberExpressionRoot);
      const members = getMembers(valuePath);
      // console.log('i am enum members', members[0] );

      // types.CallExpression.assert(valuePath.node);
      if (!types.CallExpression.check(valuePath.node)) {
        // only deal with enum and shape
        break;
      }
      console.log('i am enum valuePath:', valuePath);

      const args = valuePath.get('arguments');
      if (args.value.length !== 1) {
        // TODO temp error
        console.log('expected only one argument to computed enum', args);
        throw new Error('expected only one argument to computed enum, got: ' + args.value.length);
      }

      const identifierPath = args.get(0);
      types.Identifier.assert(identifierPath.node);

      console.log('identifierPath', identifierPath)
      console.log('identifierPathResolvedValue', resolveToValue(identifierPath))
      console.log('identifierPathModule', resolveToModule(identifierPath))
      console.log('getNameOrValue(identifierPath)', getNameOrValue(identifierPath))


      const resolved = resolveIdentifierNameToExternalValue(getNameOrValue(identifierPath), getRoot(path), filepath);
      // console.log('path', getPropertyValuePath(path));
      console.log('resolved', isExternalNodePath(path), resolved);

      break;
    }
    default: {
      // temp error
      // console.log('property key should have been an identifier', propertyPath.get('key').value);
      console.log('property key should have been an Identifier or Literal', path);
      console.log('additional', filepath, path.get('key'));
      throw new Error('property key was not an identifier')
      break;
    }
  }

  // console.log('path Property', path.get('key').value, '\n\n', path.node.kind, '\n\n', path.get('value'));
  // console.log('path code \n', recast.print(path).code);
  
  // temp logic, unused
  const valuePath = path.get('value');
  const propName = getPropertyName(path);

  const type = isPropTypesExpression(valuePath)
    ? getPropType(valuePath)
    : { name: 'custom', raw: printValue(valuePath) };

  // console.log('path Property', propName, '\n\n', valuePath, '\n\n', type);

  switch(valuePath.node.type) {
    case types.Identifier.name: {
      // break;
      console.log('Property value is Identifier', propName, '\n\n', valuePath, '\n\n', type, valuePath.node.name);
      const resolved = resolveIdentifierNameToExternalValue(valuePath.node.name, getRoot(path), filepath);
      // console.log('resolved', resolved);
      // console.log('resolved code\n', recast.print(resolved).code);
      path.node.value = resolved.value;
      // console.log('prop path\n', path.node.value);
      types.MemberExpression.assert(resolved.node); // ooh could be call expression
      break;
    }
    // case types.MemberExpression.name: {
    //   console.log('Property value is MemberExpression', propName, '\n\n', valuePath, '\n\n', type, valuePath.node.name);
    //   if (!isPropTypesExpression(valuePath)) {
    //     console.log('___is not isPropTypesExpression(valuePath)', resolveToModule(valuePath));
    //     throw new Error('should i throw here?');
    //   }

    //   const _type = getPropType(valuePath);
    //   console.log('type', type)

    //   break;
    // }
    // case types.CallExpression.name: {
    //   console.log('Property value is CallExpression', propName, '\n\n', valuePath, '\n\n', type, valuePath.node.name);
    //   break;
    // }
    default: {
      // console.log('Property value is UNHANDLED type', propName, '\n\n', valuePath, '\n\n', type, valuePath.node.name);
      break;
    }
  }

}

function resolveExternalsInSpreadProperty(path, filepath) {
  types.SpreadProperty.assert(path.node);
  console.log('resolveExternalsInSpreadProperty');


  // console.log('SPREAD_PROPERTY code', recast.print(path).code);
  // console.log('SPREAD_PROPERTY', path, path.get('argument'));

  let resolved;

  switch(path.node.argument.type) {
    case types.Identifier.name: {
      // console.log('SPREAD_PROPERTY Identifier', path.node.argument, path.name);
      resolved = resolveIdentifierNameToExternalValue(path.node.argument.name, getRoot(path), filepath);
      break;
    }
    case types.ObjectExpression.name: {
      resolved = resolveToValue(path).get('argument');
      // console.log('SPREAD_PROPERTY ObjectExpression', propPath.name, resolvedObjectExpression);
      break;
    }
    default: {
      console.log('UNHANDLED SPREAD_PROPERTY argument type', propPath.node.argument.type);
      throw new Error('there should be no unhandled spread_property');
    }
  }
  // recurse to process and external references in the child pbject
  resolveExternals(resolved, filepath);
  // overwrite the target value with the recursively processed ObjectExpression
  // propPath.node.argument = resolvedObjectExpression.value;
  types.ObjectExpression.assert(resolved.node);

  return resolved;
}

function resolveExternalsInObjectExpression(path, filepath) {
  types.ObjectExpression.assert(path.node);
  console.log('resolveExternalsInObjectExpression');

  path.get('properties').each((propertyPath) => {
    // if everything runs through resolveExternals, then this block isn't necessary
    let propPath = propertyPath;
    if (isExternalNodePath(propertyPath)) {
      const external = getExternalNodePath(propertyPath);
      propPath = external.path;
      // change scope of filepath
      filepath = external.filepath;
    }

    switch (propPath.node.type) {
      case types.Property.name: {
        const resolved = resolveExternals(propPath, filepath);
        console.log('resolvedProperty!', resolved);
        // propPath.node.argument = resolved.value;
        break;
      }


      case types.SpreadProperty.name: {
        const resolved = resolveExternals(propPath, filepath);
        propPath.node.argument = resolved.value;
        break;
      }
      default: {
        console.log('UNHANDELED propPath resolveExternalsInObjectExpression', propPath.node.type);
        throw new Error('UNHANDELED resolveExternalsInObjectExpression property type switch');
      }
    }
  });

  return path;
}

function resolveExternals(path, filepath) {
  if (isExternalNodePath(path)) {
    const external = getExternalNodePath(path);
    // change scope of path
    path = external.path;
    // change scope of filepath
    filepath = external.filepath;
  }

  switch(path.node.type) {
    case types.ObjectExpression.name: {
      return resolveExternalsInObjectExpression(path, filepath);
      break;
    }
    case types.ArrayExpression.name: {
      return resolveExternalsInArrayExpression(path, filepath);
      break;
    }
    case types.SpreadProperty.name: {
      return resolveExternalsInSpreadProperty(path, filepath);
      break;
    }
    case types.Property.name: {
      return resolveExternalsInProperty(path, filepath);
      break;
    }
    default: {
      console.log('resolveExternals UNHANDLED', path.node.type);
      throw new Error('resolveExternals UNHANDLED: ' + path.node.type);
    }
  }
}


function getExternalPropTypeHandler(propName) {
  return function getExternalPropTypeHandlerForFilePath(filepath) {
    // console.log('getExternalPropTypeHandler', propName, filepath);
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
        // console.log('I AM AN IDENTIFIER', filepath);
        // console.log('out resolveToExternalValue', resolveToExternalValue(propTypesPath, filepath));
        // return;
        // console.log('in code', recast.print(propTypesPath).code);
        const resolved = resolveIdentifierNameToExternalValue(propTypesPath.node.name, getRoot(propTypesPath), filepath);
        // console.log('out resolveIdentifierNameToExternalValue', resolved);
        const { code } = recast.print(resolved.value);
        // console.log('out resolveIdentifierNameToExternalValue', code);

        // maybe don't need this assert
        types.AssignmentExpression.assert(propTypesPath.parentPath.node);

        propTypesPath.parentPath.value.right = resolved.value;
        // console.log('passed assert', resolveToValue(propTypesPath.parentPath));

        propTypesPath = resolveToValue(propTypesPath.parentPath);
      } else {
        // console.log('NOT IDENTIFIER!', propTypesPath);
        propTypesPath = resolveToValue(propTypesPath);
      }

      if (!propTypesPath) {
        console.log('why did this return', propTypesPath);
        return;
      }

      // return;
      // _amendPropTypes()

      const resolved = resolveExternals(propTypesPath, filepath);

      // console.log('RESOLVED EXTERNALS', filepath, recast.print(propTypesPath).code);

      amendPropTypes(getDescriptor, propTypesPath, documentation, filepath);
      // amendPropTypes(getDescriptor, resolvedObjectExpression, documentation);



      // take the values and replace them in the original ast
      // then reparse it or however that works
      // find the propTypes on the component

      // console.log(recast.print(propTypesPath).code);


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
