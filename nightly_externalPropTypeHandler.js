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

function resolveMemberExpressionExternals({ path, filepath, ast, propExternals }, memberName) {
  console.log('resolveMemberExpressionExternals', memberName);
  types.MemberExpression.assert(path.node);

  const objectPath = path.get('object');
  const propertyPath = path.get('property');

  console.log(' property', propertyPath);

  if (!types.Identifier.check(propertyPath.node)) {
    console.log('found object?', { objectPath, propertyPath });
    throw "what is this";
  }

  const key = propertyPath.node.name;
  console.log('do it', key, objectPath);

  if (types.MemberExpression.check(objectPath.node)) {
    const resolvedMemberExpression = resolveMemberExpressionExternals(
      { path: objectPath, filepath, ast, propExternals }
    );
    // console.log('recursive resolved targetPath', key);
    console.log('recursive resolved targetPath', key, recast.print(resolvedMemberExpression.ast).code);
    // return { ...resolved };
    const valuePath = getMemberValuePath(resolvedMemberExpression.path, key);
    const resolved = resolveExternals({
      ...resolvedMemberExpression,
      // propExternals,
      path: valuePath
    });
    console.log('recursive resolved valuePath', key);
    console.log('recursive resolved valuePath', recast.print(resolved.path).code);
    // console.log('recursive resolved valuePath', key, valuePath);
    // return valuePath;
    return resolved;
  } else {
    // return;
    let external = resolveIdentifierNameToExternalValue(objectPath.value.name, { ast,filepath });
    if (types.Identifier.check(external.path.node)) {
      // TODO: this is brittle af
      external = resolveIdentifierNameToExternalValue(external.path.value.name, external);
    }

    // temo try to trigger this
    if (types.Identifier.check(external.path.node)) {
      throw 'hit it';
    }


    // const external = resolveIdentifierNameToExternalValue(objectPath.value.name, { ast,filepath });
    console.log('found external', key, memberName, external);
    console.log('found external code', key, memberName, recast.print(external.ast).code);
    // const valuePath = memberName
    //   ? getMemberValuePath(external.path, key)
    //   : external.path;
    const valuePath = getMemberValuePath(external.path, key);
    console.log('found valuePath', memberName, key, valuePath);
    console.log('found valuePath code', recast.print(valuePath).code);
    const resolved = resolveExternals({
      ...external,
      propExternals,
      path: valuePath
    });
    // console.log('found resolved valuePath', memberName, resolved);
    console.log('found resolved valuePath code', recast.print(resolved.path).code);

    return { ...resolved,
      path: resolved.path,
    };
  }
}

function resolveExternals({ path, filepath, ast, propExternals }) {
  // console.log('resolveExternals', path);
  if (!propExternals) {
    throw new Error('not here');
  }

  switch(path.node.type) {
    case types.Property.name: {
      const resolvedExt = resolveExternals({ path: path.get('value'), filepath, ast, propExternals });

      if (isPropTypesExpression(resolvedExt.path)) {
        const propName = getPropertyName(path);
        console.log('isPropTypesExpression', propName);

        Object.assign(propExternals, {
          ...resolvedExt.propExternals,
          [propName]: {
            propertyPath: path,
            valuePath: resolvedExt.path,
          }
        });
      }
      break;
    }
    case types.Identifier.name: {
      const resolved = resolveExternals({
        propExternals,
        // resolve variable and spread ...{ path, ast, filepath }
        ...resolveIdentifierNameToExternalValue(path.value.name, { ast,filepath }),
      });
      path.replace(resolved.path.value);
      return resolved;
    }
    case types.SpreadProperty.name: {
      return resolveExternals({ path: path.get('argument'), filepath, ast, propExternals });
      break;
    }

    case types.ObjectExpression.name: {
      path.get('properties').each((propertyPath) => {
        resolveExternals({ path: propertyPath, filepath, ast, propExternals });
      });
      break;
    }
    case types.ArrayExpression.name: {
      path.get('elements').each((elPath) => {
        resolveExternals({ path: elPath, filepath, ast, propExternals });
      });
      break;
    }
    case types.CallExpression.name: {
      path.get('arguments').each((argPath) => {
        resolveExternals({ path: argPath, filepath, ast, propExternals });
      });
      break;
    }

    case types.MemberExpression.name: {
      if (isPropTypesExpression(path)) {
        ([path.get('object'), path.get('property')]).forEach((targetPath) => {
          if (!types.Identifier.check(targetPath.node)) {
            // recurse into .oneOf([ ... ]), .shape({ ... })
            // and other PropTypes CallExpressions
            resolveExternals({ path: targetPath, filepath, ast, propExternals });
          }
        });
      } else {
        console.log('i am MemberExpression, not PropTypes, valuePath:', path);
        const resolved = resolveMemberExpressionExternals({ path, filepath, ast, propExternals });
        console.log('out resolveMemberExpressionExternals', resolved);
        // TODO: temp throw erropr
        // throw new Error('UNHANDLED non-PropTypes MemberExpression');
        path.replace(resolved.path.value);
      }
      break;
    }

    case types.ArrowFunctionExpression.name:
    case types.Literal.name: {
      break;
    }
    case types.ImportDeclaration.name: {
      console.log('ImportDeclaration', path);
      // break;
    }
    default: {
      console.log('resolveExternals UNHANDLED', path.node);
      console.log('2 resolveExternals UNHANDLED', path.node.type);
      // TODO: temp error
      throw new Error('resolveExternals UNHANDLED: ' + path.node.type);
    }
  }

  return { path, filepath, ast, propExternals };
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
