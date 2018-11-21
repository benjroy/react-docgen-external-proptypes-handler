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

function amendPropTypes(getDescriptor, path, documentation) {
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
          propPath = getExternalNodePath(propertyPath).path;
        }
        const propDescriptor = getDescriptor(getPropertyName(propPath));
        const valuePath = propPath.get('value');
        const type = isPropTypesExpression(valuePath)
          ? getPropType(valuePath)
          : { name: 'custom', raw: printValue(valuePath) };

        if (type) {
          propDescriptor.type = type;
          propDescriptor.required =
            type.name !== 'custom' && isRequiredPropType(valuePath);
        }
        setPropDescription(documentation, propPath);
        break;
      }
      case types.SpreadElement.name:
      case types.SpreadProperty.name: {
        const resolvedValuePath = resolveToValue(propertyPath.get('argument'));
        switch (resolvedValuePath.node.type) {
          case types.ObjectExpression.name: // normal object literal
            amendPropTypes(getDescriptor, resolvedValuePath, documentation);
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


// TODO: externalize
function resolveExternalsInObjectExpression(path, filepath) {
  types.ObjectExpression.assert(path.node);
  console.log('resolveExternalsInObjectExpression', path.node.type);

  path.get('properties').each((propertyPath) => {
    switch (propertyPath.node.type) {
      case types.Property.name: {
        const keyPath = propertyPath.get('key');

        switch(keyPath.node.type) {
          case types.Identifier.name: // Identifier might break if it is a different reference, but maybe that would be ArrayExpression in that case?
          case types.Literal.name: {
            break;
          }
          default: {
            // temp error
            // console.log('property key should have been an identifier', propertyPath.get('key').value);
            console.log('property key should have been an Identifier or Literal', propertyPath);
            console.log('additional', filepath, propertyPath.get('key'));
            throw new Error('property key was not an identifier')
            break;
          }
        }

        // console.log('propertyPath Property', propertyPath.get('key').value, '\n\n', propertyPath.node.kind, '\n\n', propertyPath.get('value'));
        // console.log('propertyPath code \n', recast.print(propertyPath).code);
        
        // temp logic, unused
        const valuePath = propertyPath.get('value');
        const propName = getPropertyName(propertyPath);

        const type = isPropTypesExpression(valuePath)
          ? getPropType(valuePath)
          : { name: 'custom', raw: printValue(valuePath) };

        // console.log('propertyPath Property', propName, '\n\n', valuePath, '\n\n', type);

        switch(valuePath.node.type) {
          case types.Identifier.name: {
            // console.log('Property value is Identifier', propName, '\n\n', valuePath, '\n\n', type, valuePath.node.name);
            const resolved = resolveIdentifierNameToExternalValue(valuePath.node.name, getRoot(propertyPath), filepath);
            // console.log('resolved', resolved);
            // console.log('resolved code\n', recast.print(resolved).code);
            propertyPath.node.value = resolved.value;
            // console.log('prop path\n', propertyPath.node.value);
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
        break;
      }
      /*
      case types.Property.name: {
        const propDescriptor = getDescriptor(getPropertyName(propertyPath));
        const valuePath = propertyPath.get('value');
        const type = isPropTypesExpression(valuePath)
          ? getPropType(valuePath)
          : { name: 'custom', raw: printValue(valuePath) };

        if (type) {
          propDescriptor.type = type;
          propDescriptor.required =
            type.name !== 'custom' && isRequiredPropType(valuePath);
        }
        setPropDescription(documentation, propertyPath);
        break;
      }
      */
      case types.SpreadProperty.name: {
        // console.log('SPREAD_PROPERTY code', recast.print(propertyPath).code);
        // console.log('SPREAD_PROPERTY', propertyPath, propertyPath.get('argument'));

        let resolvedObjectExpression;

        switch(propertyPath.node.argument.type) {
          case types.Identifier.name: {
            // console.log('SPREAD_PROPERTY Identifier', propertyPath.node.argument, propertyPath.name);
            resolvedObjectExpression = resolveIdentifierNameToExternalValue(propertyPath.node.argument.name, getRoot(propertyPath), filepath);
            break;
          }
          case types.ObjectExpression.name: {
            resolvedObjectExpression = resolveToValue(propertyPath).get('argument');
            // console.log('SPREAD_PROPERTY ObjectExpression', propertyPath.name, resolvedObjectExpression);
            break;
          }
          default: {
            console.log('UNHANDLED SPREAD_PROPERTY argument type', propertyPath.node.argument.type);
            throw new Error('there should be no unhandled spread_property');
          }
        }
        // recurse to process and external references in the child pbject
        resolveExternalsInObjectExpression(resolvedObjectExpression, filepath);
        // overwrite the target value with the recursively processed ObjectExpression
        propertyPath.node.argument = resolvedObjectExpression.value;

        break;
      }
      default: {
        console.log('UNHANDELED propertyPath resolveExternalsInObjectExpression', propertyPath.node.type);
        throw new Error('UNHANDELED resolveExternalsInObjectExpression property type switch');
      }
    }

  });

  return path;
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

      const resolved = resolveExternalsInObjectExpression(propTypesPath, filepath);
      // const resolvedObjectExpression = resolveExternalsInObjectExpressionNode(propTypesPath.node, filepath);

      // console.log('RESOLVED EXTERNALS', resolvedObjectExpression);
      console.log('RESOLVED EXTERNALS', filepath, recast.print(propTypesPath).code);

      amendPropTypes(getDescriptor, propTypesPath, documentation);
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
