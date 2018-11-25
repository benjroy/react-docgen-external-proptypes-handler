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
  // createExternalNodePath,
  // isExternalNodePath,
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

// function amendPropType(path, { getDescriptor, documentation }) {
//   types.Property.assert(path.node);

//   const propName = getPropertyName(path);
//   const propDescriptor = getDescriptor(propName);
//   // const propDescriptor = getDescriptor(getPropertyName(path));
//   const valuePath = path.get('value');
//   // const valuePath = isExternalNodePath(path.get('value'))
//   //   ? getExternalNodePath(path.get('value')).path
//   //   : path.get('value');

//   console.log('amendPropType', isExternalNodePath(path), isExternalNodePath(valuePath))
//   const type = resolveExternalPropType(valuePath);

//   // const type = isExternalPropTypesExpression(valuePath)
//   //   ? getPropType(valuePath)
//   //   : { name: 'custom', raw: printValue(valuePath) };

//   if (type) {
//     propDescriptor.type = type;
//     propDescriptor.required =
//       type.name !== 'custom' && isRequiredPropType(valuePath);
//   }
//   setPropDescription(documentation, path);

// }


// function resolveExternalPropType(path, options) {
//   if (isExternalNodePath(path)) {
//     const external = getExternalNodePath(path);
//     // change scope
//     console.log('I AM EXTERNAL', path)
//     // TODO: not this way
//     path = external.path;
//     // return resolveExternalPropType(external.path, external.filepath, options);
//   }

//   const type = isPropTypesExpression(path)
//     ? getPropType(path)
//     : { name: 'custom', raw: printValue(path) };

//   return type;
// }

function _amendPropType(propName, valuePath, getDescriptor) {
  // types.Property.assert(path.node);

  // console.log('amendPropTypeExternal', path.get('key').node.value, filepath);

  // const propName = getPropertyName(path);
  const propDescriptor = getDescriptor(propName);
  // const propDescriptor = getDescriptor(getPropertyName(path));
  // const valuePath = path.get('value');
  // const valuePath = isExternalNodePath(path.get('value'))
  //   ? getExternalNodePath(path.get('value')).path
  //   : path.get('value');

  // console.log('amendPropType', isExternalNodePath(path), isExternalNodePath(valuePath))
  // const type = resolveExternalPropType(valuePath);

  const type = isPropTypesExpression(valuePath)
    ? getPropType(valuePath)
    : { name: 'custom', raw: printValue(valuePath) };

  if (type) {
    propDescriptor.type = type;
    propDescriptor.required =
      type.name !== 'custom' && isRequiredPropType(valuePath);
  }
  // setPropDescription(documentation, path);
}

// function resolveExternalIdentifier(path, filepath, options) {

//   const resolved = resolveIdentifierNameToExternalValue(path.value.name, getRoot(path), filepath);
//   // console.log('resolved identifier', resolved);
//   // const external = getExternalNodePath(resolved);
//   external = getExternalNodePath(resolved);
//   resolveExternals(external.path, external.filepath, options);
//   path.replace(external.path.value);

// }

function resolveExternals(ext) {
  // console.log('resolveExternals', path);
  if (!ext.propExternals) {
    throw new Error('not here');
  }


  // let external = { path, filepath, ast: undefined, propExternals };
  let external = {
    path: ext.path,
    filepath: ext.filepath,
    ast: ext.ast,
    propExternals: ext.propExternals,
  };

  const propExternals = external.propExternals;

  console.log('external propext', external.propExternals);

  // temp temp
  const path = external.path;
  const filepath = external.filepath;


  // if (isExternalNodePath(path)) {
  //   const _external = getExternalNodePath(path);
  //   // change scope of path
  //   path = _external.path;
  //   // change scope of filepath
  //   filepath = _external.filepath;

  //   // return resolveExternals(external.path, external.filepath);
  // }
  // console.log('resolveExternals', path.node.type);


  switch(path.node.type) {
    case types.Literal.name: {
      break;
    }
    case types.Property.name: {
      // imagine this is a callback here

      // if (isPropTypesExpression(path.get('value'))) {
      //   console.log('isPropTypesExpression');
      //   amendPropTypeExternal(path, { filepath, ast: undefined }, options);
      //   break;
      // }
      // external = resolveExternals(path.get('value'), filepath, options);
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

        // setPropDescription(options.documentation, path);


        // propExternals[key] = resolvedExt;
        // console.log('resolvedExt.propExternals', key, resolvedExt.path.node.type, resolvedExt.propExternals);
        // console.log('propExternals', propExternals);
        // amendPropTypeExternal(path, { filepath, ast: undefined }, options);
        break;
      }

      // amendPropType(path, options);
      break;
    }
    case types.Identifier.name: {
      const resolved = resolveIdentifierNameToExternalValue(path.value.name, getRoot(path), filepath);
      // console.log('resolved identifier', resolved);
      // const external = getExternalNodePath(resolved);
      external = getExternalNodePath(resolved);
      external = resolveExternals({
            ...external,
            propExternals,
          });
      path.replace(external.path.value);
      break;
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
        // TODO: check for prop-types expression here?
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

  // return path;
  // return external;

  // console.log('propext', propExternals);

  const out = {
    ...external,
    // propExternals,
    // propExternals: {
    //   ...external.propExternals,
    //   ...propExternals,
    // },
  }

  return out;
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
          _amendPropType(propName, valuePath, getDescriptor);
          setPropDescription(documentation, propertyPath);
        }
      );

    };
  }
}


module.exports.propTypeHandler = getExternalPropTypeHandler('propTypes');
module.exports.contextTypeHandler = getExternalPropTypeHandler('contextTypes');
module.exports.childContextTypeHandler = getExternalPropTypeHandler('childContextTypes');
