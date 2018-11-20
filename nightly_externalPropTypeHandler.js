const fs = require('fs');
const { resolve, dirname } = require('path');
const recast = require('recast')
const docgen = require('react-docgen');
const babylon = require('react-docgen/dist/babylon').default
const setPropDescription = require('react-docgen/dist/utils/setPropDescription').default
const isRequiredPropType = require('react-docgen/dist/utils/isRequiredPropType').default
const findIdentifier = require('./lib/visitors/findIdentifier');
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
        console.log('I AM AN IDENTIFIER', filepath, propTypesPath.parentPath);
        console.log('in code', recast.print(propTypesPath).code);
        // console.log('getRoot', getRoot(propTypesPath));
        const identifier = findIdentifier(propTypesPath.node.name, getRoot(propTypesPath), filepath);
        // console.log('out findIdentifier', identifier);
        const { code } = recast.print(identifier);
        // const ast = getAst(code);
        console.log('out findIdentifier', code);

        // maybe don't need this assert
        types.AssignmentExpression.assert(propTypesPath.parentPath.node);

        propTypesPath.parentPath.value.right = identifier;
        console.log('resolved', resolveToValue(propTypesPath.parentPath))

        // recast.visit(identifier, {
        //   visitIdentifier(path) {
        //     console.log('VISITED IDENTIFIER', filepath, path);
        //     this.traverse(path);
        //   },
        // });

        amendPropTypes(getDescriptor, resolveToValue(propTypesPath.parentPath), documentation);
        return;
      }

      // take the values and replace them in the original ast
      // then reparse it or however that works
      // find the propTypes on the component

      // console.log(propTypesPath);
      // console.log(recast.print(propTypesPath).code);


      propTypesPath = resolveToValue(propTypesPath);
      if (!propTypesPath) {
        return;
      }


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
