// MODIFYING react-docgen/src/handlers/propTypeHandler.js
// import getPropType from '../utils/getPropType';
// import getPropertyName from '../utils/getPropertyName';
// import getMemberValuePath from '../utils/getMemberValuePath';
// import isReactModuleName from '../utils/isReactModuleName';
// import isRequiredPropType from '../utils/isRequiredPropType';
// import printValue from '../utils/printValue';
// // import recast from 'recast';
// import resolveToModule from '../utils/resolveToModule';
// import resolveToValue from '../utils/resolveToValue';

const fs = require('fs');
const { resolve, dirname } = require('path');
const recast = require('recast')
const docgen = require('react-docgen');
const babylon = require('react-docgen/dist/babylon').default
const setPropDescription = require('react-docgen/dist/utils/setPropDescription').default
const isRequiredPropType = require('react-docgen/dist/utils/isRequiredPropType').default

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
} = recast;

function isPropTypesExpression(path) {
  const moduleName = resolveToModule(path);
  if (moduleName) {
    return isReactModuleName(moduleName) || moduleName === 'ReactPropTypes';
  }
  return false;
}

function getImportedValuePath() {}

// we will amend this method to follow imports
// function amendPropTypes(getDescriptor, path) {
function amendPropTypes(getDescriptor, documentation, path, filepath) {
  console.log('amendPropTypes', filepath, path.get('properties'));

  if (!types.ObjectExpression.check(path.node)) {
    console.log('amendPropTypes bailing', filepath, path.node);
    return;
  }

  path.get('properties').each(function(propertyPath) {
    // console.log('amendPropTypes properties iter', filepath, propertyPath);
    switch (propertyPath.node.type) {
      case types.Property.name: {
        const propDescriptor = getDescriptor(getPropertyName(propertyPath));
        const valuePath = propertyPath.get('value');
        const type = isPropTypesExpression(valuePath)
          ? getPropType(valuePath)
          : { name: 'custom', raw: printValue(valuePath) };
        console.log('property name type', getPropertyName(propertyPath), type);
        if (type) {
          propDescriptor.type = type;
          propDescriptor.required =
            type.name !== 'custom' && isRequiredPropType(valuePath);
        }
        setPropDescription(documentation, propertyPath);
        break;
      }
      case types.SpreadElement.name: {
        throw new Error('FOUND SPREAD ELEMENT');
        const resolvedValuePath = resolveToValue(propertyPath.get('argument'));
        switch (resolvedValuePath.node.type) {
          case types.ObjectExpression.name: // normal object literal
            amendPropTypes(getDescriptor, documentation, resolvedValuePath, filepath);
            break;
          // case types.ImportDeclaration.name:
          //   throw 'yep, that was the spread';
          //   break;
        }
        break;
      }
      case types.SpreadProperty.name: {
        const variableName = getNameOrValue(propertyPath.get('argument'));
        console.log('propertyPath: HANDLE SPREAD PROPERTY', propertyPath);
        console.log('TODO: HANDLE SPREAD PROPERTY', variableName);
        console.log('propertyPath', filepath, propertyPath.get('argument').get('id'))
        // const externalPropTypesPaths = resolveToImportedPaths(propertyPath.parentPath.parentPath, filepath);
        const externalPropTypesPaths = resolveToImportedPaths(path, filepath);
        externalPropTypesPaths.forEach(
          ({ moduleTargetPath, moduleFilePath }) => {
            console.log('external', moduleFilePath);
            amendPropTypes(getDescriptor, documentation, resolveToValue(moduleTargetPath), moduleFilePath);
          }
        );

        // console.log('TODO: HANDLE SPREAD PROPERTY', propertyPath.get('argument').get('id'));
        break;
      }
      default: {
        console.log('NO CASE', propertyPath.node.type);
      }
    }
  });
}

/**
 * Accepts absolute path of a source file and returns the file source as string.
 * @method getSrc
 * @param  {String} filepath  File path of the component
 * @return {String} Source code of the given file if file exist else returns empty
 */
function getSrc(filepath) {
  if (fs.existsSync(filepath) === false) return;
  return fs.readFileSync(filepath, 'utf-8');
}

function getAST(src) {
  return recast.parse(src, {
    source: 'module',
    esprima: babylon,
  });
}

function getImportsForLocalVariablesFromAST(ast) {
  const specifiers = createObject(null);

  recast.visit(ast, {
    visitImportDeclaration: path => {
      // import { foo } from '<name>'
      const name = path.node.source.value;
      path.node.specifiers.forEach(node => {
        specifiers[node.local.name] = {
          modulePath: name,
          target: node.imported && node.imported.name || node.local.name,
        };
      });
      return false;
    },
  });

  return specifiers;
}

/**
 * Resolves propTypes source file path relative to current component,
 * which resolves only file extension of type .js or .jsx
 *
 * @method resolveImportModulePath
 * @param  {String} filepath  Relative file path of the component
 * @param  {String} modulePath Relative file path of a dependent component
 * @return {String} Resolved file path if file exist else null
 */
function resolveImportModuleFilePath(filepath, modulePath) {
  const regEx = /\.(js|jsx)$/;
  const srcPath = resolve(dirname(filepath), modulePath);

  if (regEx.exec(srcPath)) return srcPath;

  const extensions = ['js', 'jsx'];

  for (let ext of extensions) {
    if (fs.existsSync(`${srcPath}.${ext}`)) {
      return `${srcPath}.${ext}`;
    }
  }

  // if (fs.existsSync(`${srcPath}.js`)) return 
  // extension = 
  // return `${srcPath}`
  // if (regEx.exec(srcPath)) {
  //   return srcPath
  // } else {
  //   srcPath += fs.existsSync(`${srcPath}.js`) ? '.js' : '.jsx'
  //   return srcPath
  // }
}

/**
 * Filters the list of identifier node values or node paths from a given AST.
 *
 * @method getIdentifiers
 * @param  {Object} ast Root AST node of a component
 * @return {Object} Which holds identifier relative file path as `key` and identifier name as `value`
 */
function getIdentifiers(ast) {
  const identifiers = createObject(null);

  recast.visit(ast, {
    visitVariableDeclarator(path) {
      const node = path.node
      const nodeType = node.init.type

      if (nodeType === types.Identifier.name) {
        if (identifiers[node.init.name]) {
          identifiers[node.init.name].push(node.init.name);
        } else {
          identifiers[node.init.name] = [node.init.name];
        }
      } else if (nodeType === types.Literal.name) {
        if (identifiers[node.id.name]) {
          identifiers[node.id.name].push(node.init.value);
        } else {
          identifiers[node.id.name] = [node.init.value];
        }
      } else if (nodeType === types.ArrayExpression.name) {
        if (identifiers[node.id.name]) {
          identifiers[node.id.name].push(node.init.elements);
        } else {
          identifiers[node.id.name] = node.init.elements;
        }
      } else if (nodeType === types.ObjectExpression.name) {
        if (identifiers[node.id.name]) {
          identifiers[node.id.name].push({
            path,
            value: node.init.properties,
          })
        } else {
          identifiers[node.id.name] = {
            path,
            value: node.init.properties,
          }
        }
      }

      this.traverse(path);
    }
  });

  return identifiers;
}

function resolveToImportedPaths(path, filepath) {
  console.log('resolveToImportedValue', filepath, path);

  const variableNames = [];
  const paths = [];

  switch (path.node.type) {
    case types.ObjectExpression.name: {
      path.get('properties').each(propertyPath => {
        if (!types.SpreadProperty.check(propertyPath.value)) {
          // paths.push(propertyPath);
          return;
        };
        const variableName = getNameOrValue(resolveToValue(propertyPath).get('argument')); // local variable name
        variableNames.push(variableName);
      });
      break;
    }
    case types.Identifier.name: {
      variableNames.push(getNameOrValue(path)); // gives local variable name when literal assignment
      // console.log('TODO: IDENTIFIER resolveToImportedValue', filepath);
      break;
    }
    default: {
      console.log('UNHANDELED resolveToImportedPaths', path.node)
    }
  }

  console.log('variableNames', variableNames);

  const ast = path.scope.getGlobalScope().node;
  const imports = getImportsForLocalVariablesFromAST(ast);
  console.log('imports', imports);

  const importedPaths = variableNames.reduce((memo, variableName) => {
    if (!HOP.call(imports, variableName)) {
      return memo;
    }
    const { modulePath, target } = imports[variableName];
    // only process relative imports (not node_modules dependencies)
    if (modulePath.startsWith('./')) {
      const moduleFilePath = resolveImportModuleFilePath(filepath, modulePath);
      const moduleSrc = getSrc(moduleFilePath);
      const moduleAST = getAST(moduleSrc);
      const moduleTarget = getIdentifiers(moduleAST)[target];
      if (!moduleTarget) {
        // TODO: better error, or none at all
        throw new Error('no moduleTarget');
      }
      const moduleTargetPath = resolveToValue(moduleTarget.path);

      memo.push({ moduleTargetPath, moduleFilePath });
      console.log('moduleTargetPath', moduleTargetPath);
      // TEMP
      // memo.push(resolveToImportedPaths(targetPath, moduleFilePath));
    }
    return memo;
  }, []);
  console.log('importedPaths', importedPaths);
  return paths.concat(importedPaths);
}

function getExternalPropTypeHandler(propName) {
  return function getExternalPropTypeHandlerForFilePath(filepath) {
    console.log('getExternalPropTypeHandler', propName, filepath);
    return function externalPropTypeHandler(documentation, path) {
      console.log('documentation', documentation);
      let propTypesPath = getMemberValuePath(path, propName);
      if (!propTypesPath) {
        return;
      }
      console.log('propTypesPath', propTypesPath)
      // propTypesPath = resolveToValue(propTypesPath);
      const externalPropTypesPaths = resolveToImportedPaths(propTypesPath, filepath);
      // console.log('paths', paths);
      // if (!propTypesPath) {
      //   return;
      // }
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
      // amendPropTypes(getDescriptor.bind(documentation), propTypesPath, filepath);
      externalPropTypesPaths.forEach(
        ({ moduleTargetPath, moduleFilePath }) =>
          amendPropTypes(
            getDescriptor.bind(documentation),
            documentation,
            resolveToValue(moduleTargetPath),
            moduleFilePath),
      );
      // amendPropTypes(getDescriptor.bind(documentation), propTypesPath, filepath);
    }
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


// export const propTypeHandler = getPropTypeHandler('propTypes');
// export const contextTypeHandler = getPropTypeHandler('contextTypes');
// export const childContextTypeHandler = getPropTypeHandler('childContextTypes');
// module.exports = getPropTypeHandler('propTypes');
module.exports.propTypeHandler = getExternalPropTypeHandler('propTypes');
module.exports.contextTypeHandler = getExternalPropTypeHandler('contextTypes');
module.exports.childContextTypeHandler = getExternalPropTypeHandler('childContextTypes');
