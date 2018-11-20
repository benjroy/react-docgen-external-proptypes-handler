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
    return isReactModuleName(moduleName) || moduleName === 'ReactPropTypes';
  }
  return false;
}

function amendPropTypes(getDescriptor, path, documentation) {
  if (!types.ObjectExpression.check(path.node)) {
    console.log('BAILING', path);
    return;
  }

  path.get('properties').each(function(propertyPath) {
    switch (propertyPath.node.type) {
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
      case types.SpreadElement.name: {
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
        // console.log('propertyPath Property', propertyPath.node.key.value, propertyPath.node.kind, propertyPath.node.value);
        // console.log('propertyPath code', recast.print(propertyPath).code);
        break;
      }
      case types.SpreadProperty.name: {
        // console.log('SPREAD_PROPERTY code', recast.print(propertyPath).code);
        // console.log('SPREAD_PROPERTY', propertyPath, propertyPath.get('argument'));

        let resolvedObjectExpression;

        switch(propertyPath.node.argument.type) {
          case types.Identifier.name: {
            // console.log('SPREAD_PROPERTY Identifier', propertyPath.node.argument, propertyPath.name);
            resolvedObjectExpression = resolveIdentifierNameToExternalValue(propertyPath.node.argument.name, getRoot(propertyPath), filepath);
            // console.log('resolvedObjectExpression', resolvedObjectExpression);
            // resolveExternalsInObjectExpression(resolvedObjectExpression, filepath);

            // // propertyPath.parentPath.value[propertyPath.name] = resolvedObjectExpression.value;
            // propertyPath.node.argument = resolvedObjectExpression.value;
            break;
          }
          case types.ObjectExpression.name: {
            resolvedObjectExpression = resolveToValue(propertyPath).get('argument');
            // console.log('SPREAD_PROPERTY ObjectExpression', propertyPath.name, resolvedObjectExpression);

            // resolveExternalsInObjectExpression(resolvedObjectExpression, filepath);
            // console.log('2 SPREAD_PROPERTY ObjectExpression', propertyPath.name, propertyPath.parentPath);
            // // propertyPath.parentPath.value[propertyPath.name] = resolvedObjectExpression.value;
            // propertyPath.node.argument = resolvedObjectExpression.value;
            break;
          }
          default: {
            console.log('UNHANDLED SPREAD_PROPERTY argument type', propertyPath.node.argument.type);
            throw new Error('there should be no unhandled spread_property');
          }
        }
        resolveExternalsInObjectExpression(resolvedObjectExpression, filepath);

        // propertyPath.parentPath.value[propertyPath.name] = resolvedObjectExpression.value;
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
        // console.log('I AM AN IDENTIFIER', filepath, propTypesPath.parentPath);
        console.log('I AM AN IDENTIFIER', filepath);
        console.log('in code', recast.print(propTypesPath).code);
        // console.log('getRoot', getRoot(propTypesPath));
        // const identifier = resolveIdentifierNameToExternalValue(propTypesPath.node.name, getRoot(propTypesPath), filepath);
        const resolved = resolveIdentifierNameToExternalValue(propTypesPath.node.name, getRoot(propTypesPath), filepath);
        console.log('out resolveIdentifierNameToExternalValue', resolved);
        const { code } = recast.print(resolved.value);
        // const ast = getAst(code);
        console.log('out resolveIdentifierNameToExternalValue', code);

        // maybe don't need this assert
        types.AssignmentExpression.assert(propTypesPath.parentPath.node);

        propTypesPath.parentPath.value.right = resolved.value;
        // console.log('resolved', resolveToValue(propTypesPath.parentPath))

        // recast.visit(identifier, {
        //   visitIdentifier(path) {
        //     console.log('VISITED IDENTIFIER', filepath, path);
        //     this.traverse(path);
        //   },
        // });

        // amendPropTypes(getDescriptor, resolveToValue(propTypesPath.parentPath), documentation);
        propTypesPath = resolveToValue(propTypesPath.parentPath);
        return;
      } else {
        console.log('NOT IDENTIFIER!', propTypesPath);
        propTypesPath = resolveToValue(propTypesPath);
      }

      if (!propTypesPath) {
        return;
      }

      const resolved = resolveExternalsInObjectExpression(propTypesPath, filepath);
      // const resolvedObjectExpression = resolveExternalsInObjectExpressionNode(propTypesPath.node, filepath);

      // console.log('RESOLVED EXTERNALS', resolvedObjectExpression);
      console.log('RESOLVED EXTERNALS', recast.print(propTypesPath).code);

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
