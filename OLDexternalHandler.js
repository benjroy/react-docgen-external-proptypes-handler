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
const recast = require('recast');
const { NodePath } = require('ast-types');
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
  types: {
    namedTypes: types,
    builders,
  },
} = recast;

// console.log('types', types);
// console.log('builders', builders);

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
  console.log('amendPropTypes', filepath, path);

  if (!types.ObjectExpression.check(path.node)) {
    console.log('amendPropTypes bailing', filepath, path.node);
    return;
  }

  path.get('properties').each(function(propertyPath) {
    console.log('amendPropTypes properties iter', filepath, propertyPath.node.type, propertyPath);
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
        // console.log('propertyPath: HANDLE SPREAD PROPERTY', propertyPath);
        // console.log('TODO: HANDLE SPREAD PROPERTY', variableName);
        // const resolvedValuePath = resolveToValue(propertyPath.get('argument'));
        // const resolvedValuePaths = resolveToValueFollowImports(propertyPath, { filepath, ast: propertyPath.scope.getGlobalScope().node });
        // console.log('TODO: HANDLE SPREAD PROPERTY resolvedValuePaths', resolvedValuePaths);

        // console.log('propertyPath', filepath, propertyPath.get('argument').get('id'))
        const externalPropTypesPaths = resolveToImportedPaths(propertyPath.parentPath.parentPath, filepath);
        // const externalPropTypesPaths = resolveToImportedPaths(path, filepath);
        externalPropTypesPaths.forEach(
          ({ moduleTargetPath, moduleFilePath }) => {
            console.log('external', moduleFilePath);
            amendPropTypes(getDescriptor, documentation, resolveToValue(moduleTargetPath), moduleFilePath);
          }
        );

        // console.log('TODO: HANDLE SPREAD PROPERTY', propertyPath.get('argument').get('id'));
        break;
      }
      case types.ObjectExpression.name: {
        console.log('propertyPath: HANDLE ObjectExpression PROPERTY', propertyPath.parentPath.parentPath);
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
function getIdentifierNodes(ast) {
  const identifiers = createObject(null);

  recast.visit(ast, {
    // visitExportNamedDeclaration(path) {
    //   console.log('getIdentifiers visitExportNamedDeclaration', path);
    //   // throw new Error('visitExportNamedDeclaration');
    //   this.traverse(path);
    // },
    // visitExportDeclaration(path) {
    //   console.log('getIdentifiers visitExportDeclaration', path);
    //   throw new Error('visitExportDeclaration')
    //   this.traverse(path);
    // },
    // visitVariableDeclaration(path) {
    //   console.log('getIdentifiers visitVariableDeclaration', path);
    //   console.log('2 getIdentifiers visitVariableDeclaration', path.value.declarations);
    //   // throw new Error('visitVariableDeclaration')
    //   this.traverse(path);
    // },
    visitVariableDeclarator(path) {
      // console.log('getIdentifiers visitVariableDeclarator', path);
      const node = path.node
      const nodeType = node.init.type

      // if (!HOP.call(identifiers, node.id.name)) {
      //   identifiers[node.id.name] = [];
      // }
      if (HOP.call(identifiers, node.id.name)) {
        console.log('already exists', identifiers);
        throw new Error(`${node.id.name} already exists in identifiers`);
      }

      // identifiers[node.id.name].push(node.init);
      // console.log('node.id.name', node.id.name, node.init);
      // console.log('node.id.name path', node.id.name, path);
      // identifiers[node.id.name] = node.init;
      identifiers[node.id.name] = {
        path,
        value: node.init,
      }
      // console.log('getIdentifiers visitVariableDeclarator name', node.id.name);

      this.traverse(path);
      return;




      switch(node.init.type) {
        case types.Identifier.name: {
          console.log('getIdentifiers resolveToModule', node.id);
          // console.log('2 getIdentifiers resolveToModule', resolveToModule(resolveToValue(node.id)));
          // if (identifiers[node.init.name]) {
          //   identifiers[node.init.name].push(node.init.name);
          // } else {
          //   identifiers[node.init.name] = [node.init.name];
          // }
          identifiers[node.id.name].push[node.init.value];
          break;
        }
        case types.Literal.name: {
          if (identifiers[node.id.name]) {
            identifiers[node.id.name].push(node.init.value);
          } else {
            identifiers[node.id.name] = [node.init.value];
          }
          break;
        }
        case types.ArrayExpression.name: {
          if (identifiers[node.id.name]) {
            identifiers[node.id.name].push(node.init.elements);
          } else {
            identifiers[node.id.name] = node.init.elements;
          }
          break;
        }
        case types.ObjectExpression.name: {
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
          break;
        }
        default: {
          console.log('getIdentifiers unhandled', path.node);
          // throw new Error('getIdentifiers unhandled');
        }
      }

      // if (nodeType === types.Identifier.name) {
      //   console.log('getIdentifiers resolveToModule', node.id);
      //   // console.log('2 getIdentifiers resolveToModule', resolveToModule(resolveToValue(node.id)));
      //   if (identifiers[node.init.name]) {
      //     identifiers[node.init.name].push(node.init.name);
      //   } else {
      //     identifiers[node.init.name] = [node.init.name];
      //   }
      // } else if (nodeType === types.Literal.name) {
      //   if (identifiers[node.id.name]) {
      //     identifiers[node.id.name].push(node.init.value);
      //   } else {
      //     identifiers[node.id.name] = [node.init.value];
      //   }
      // } else if (nodeType === types.ArrayExpression.name) {
      //   if (identifiers[node.id.name]) {
      //     identifiers[node.id.name].push(node.init.elements);
      //   } else {
      //     identifiers[node.id.name] = node.init.elements;
      //   }
      // } else if (nodeType === types.ObjectExpression.name) {
      //   if (identifiers[node.id.name]) {
      //     identifiers[node.id.name].push({
      //       path,
      //       value: node.init.properties,
      //     })
      //   } else {
      //     identifiers[node.id.name] = {
      //       path,
      //       value: node.init.properties,
      //     }
      //   }
      // } else {
      //   console.log('getIdentifiers unhandled', path);
      // }

      // this.traverse(path);
    }
  });

  return identifiers;
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
      console.log('getIdentifiers visitVariableDeclarator', path);
      const node = path.node
      const nodeType = node.init.type

      if (nodeType === types.Identifier.name) {
        console.log('getIdentifiers resolveToModule', node.id);
        // console.log('2 getIdentifiers resolveToModule', resolveToModule(resolveToValue(node.id)));
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
      } else {
        console.log('getIdentifiers unhandled', path);
      }

      this.traverse(path);
    }
  });

  return identifiers;
}

/**
 * Method to parse and get computed nodes from a document object
 *
 * @method getComputedPropValuesFromDoc
 * @param  {Object} doc  react-docgen document object
 * @return {Object/Boolean} Object with computed property identifer as `key` and AST node path as `value`,
 *                          If documnet object have any computed properties else return false.
 */

function getComputedPropValueNamesFromDoc(doc, output = []) {
  let flag;
  // const computedProps = createObject(null);
  const props = doc.toObject().props;

  flag = false

  if (!props) return false;

  for (const prop in props) {
    console.log('prop', prop);
    if (!HOP.call(props, prop)) continue;
    gatherComputedPropValues(props[prop].type, output);
    continue;
  }
  if (output.length === 0) return false;
  return output;
}

function gatherComputedPropValues(docPropType, output = []) {
  const type = docPropType;
  if (!type) return output;
  if (Array.isArray(type.value)) {
    type.value.forEach(propValueType => gatherComputedPropValues(propValueType, output));
    // return output;
  }
  if (type.computed) {
    output.push(type.value);
  }
  return output;

  // if (type.name === 'enum' && type.computed) {
  //   output.push = type.value;

  // } 

  // if (type.name !== 'enum') return output;
  // if (Array.isArray(type.value)) {
  //   gather
  //   return output;
  // }
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
      // throw new Error('UNHANDELED resolveToImportedPaths');
    }
  }

  console.log('variableNames', variableNames);

  const ast = path.scope.getGlobalScope().node;
  const imports = getImportsForLocalVariablesFromAST(ast);
  console.log('imports', imports);

  const importedPaths = variableNames.reduce((memo, variableName) => {
    // const temp = resolveValueForImportedVariable(variableName, { ast, imports, filepath });
    // console.log('temptemptemp', temp);

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
      // console.log('moduleTargetPath', moduleTargetPath);
      // TEMP
      // memo.push(resolveToImportedPaths(targetPath, moduleFilePath));
    }
    return memo;
  }, []);
  console.log('importedPaths', importedPaths);
  return paths.concat(importedPaths);
}

function appendPropertyNodePathToObjectExpressionBuilder(objectExpressionBuilder, propertyPath) {
  console.log('appendPropertyNodePathToObjectExpressionBuilder', propertyPath.value);
  objectExpressionBuilder.properties.push(propertyPath.value);
}

// NEW NEW NEW
// function resolveToValueFollowImports(path, { ast, filepath }, outputObjectExpression = builders.objectExpression([])) {
function resolveToValueFollowImports(path, { ast, filepath }, outputObjectExpression = builders.objectExpression([])) {
  // console.log('resolveToValueFollowImports', filepath, path);
  // console.log('resolveToValueFollowImports outputObjectExpression', outputObjectExpression)

  // const ast = path.scope.getGlobalScope().node;
  const imports = getImportsForLocalVariablesFromAST(ast);

  const variableNames = [];
  const paths = [];

  switch (path.node.type) {
    case types.ObjectExpression.name: {
      path.get('properties').each(propertyPath => {
      // path.node.properties.forEach(propertyPath => {
        if (!types.SpreadProperty.check(propertyPath.value)) {
          // console.log('NOT SPREADING', propertyPath.value);
          // console.log('pushing propertypath', propertyPath);
          appendPropertyNodePathToObjectExpressionBuilder(outputObjectExpression, propertyPath);
          // outputObjectExpression.properties.push(propertyPath)
          // paths.push(propertyPath);
          return;
        };
        resolveToValueFollowImports(propertyPath, { ast, filepath }, outputObjectExpression);

        // const target = resolveToValue(propertyPath).get('argument');
        // const resolvedPath = resolvePathFollowingImports(resolveToValue(propertyPath), { ast, imports, filepath });
        // console.log('SPREAD PROPERTY', propertyPath);
        // console.log('SPREAD PROPERTY RESOLVED', resolvedPath);
        // const variableName = getNameOrValue(resolveToValue(propertyPath).get('argument')); // local variable name
        // variableNames.push(variableName);
      });
      break;
    }
    case types.SpreadProperty.name: {
      // console.log('SPREAD PROPERTY', path);
      const identifier = resolveToValue(path).get('argument');
      // sanity check
      types.Identifier.assert(identifier.value);
      // console.log('SPREAD PROPERTY IDENTIFIER', identifier);
      const resolved = resolveIdentifierPathToValuesFollowingImports(identifier, { ast, imports, filepath });
      console.log('SPREAD PROPERTY resolvedPaths', resolved);

      if (!resolved) break;

      resolved.properties.forEach(propertyPath => {
        // console.log('pushing propertypath', propertyPath);
        // outputObjectExpression.properties.push(propertyPath);
        appendPropertyNodePathToObjectExpressionBuilder(outputObjectExpression, propertyPath);        
      });
      // resolved.properties.forEach(p => resolveToValueFollowImports(p, { ast, filepath }, outputObjectExpression));
      // resolveToValueFollowImports({ node: resolved }, { ast, filepath }, outputObjectExpression);
      break;
    }
    case types.VariableDeclarator.name: {
      // console.log('VARIABLEDECLARATOR PROPERTY', path);
      // sanity check
      types.Identifier.assert(path.value.id);
      // console.log('2 VARIABLEDECLARATOR PROPERTY', resolveToValue(path));
      resolveToValueFollowImports(resolveToValue(path), { ast, filepath }, outputObjectExpression);
      // resolvedPaths.forEach(p => resolveToValueFollowImports(p, { ast, filepath }, outputObjectExpression));
      break;
    }
    case types.Identifier.name: {
      variableNames.push(getNameOrValue(path)); // gives local variable name when literal assignment
      console.log('TODO: IDENTIFIER resolveToImportedValue', filepath);
      break;
    }
    default: {
      console.log('UNHANDELED resolveToValueFollowImports', path.node)
      // throw new Error('UNHANDELED resolveToImportedPaths');
    }
  }

  const importedPaths = [];

  console.log('output props', outputObjectExpression);

  // return paths.concat(importedPaths);
  return outputObjectExpression;
}


function resolveIdentifierPathToValuesFollowingImports(identifierPath, { ast, imports, filepath }) {
  const variableName = getNameOrValue(identifierPath); // local variable name

  console.log('resolvePathFollowingImports', variableName);
  if (!HOP.call(imports, variableName)) {
    // TODO: aggregate properties from local values
    return;
  }
  const { modulePath, target } = imports[variableName];
  // only process relative imports (not node_modules dependencies)
  if (!modulePath.startsWith('./')) {
    return;
  }

  const moduleFilePath = resolveImportModuleFilePath(filepath, modulePath);
  const moduleSrc = getSrc(moduleFilePath);
  const moduleAST = getAST(moduleSrc);
  console.log('imports[variableName]', imports[variableName]);
  const moduleIdentifiers = getIdentifierNodes(moduleAST)
  console.log('moduleIdentifiers', moduleIdentifiers);
  const moduleTarget = moduleIdentifiers[target];

  if (!moduleTarget) {
    // TODO: better error, or none at all
    throw new Error('no moduleTarget');
  }

  // const moduleTargetPath = resolveToValue(moduleTarget.path);
  const moduleTargetPath = moduleTarget.path;
  console.log('moduleTarget resolveIdentifierPathToValuesFollowingImports', moduleTargetPath);

  return resolveToValueFollowImports(moduleTargetPath, { ast: moduleAST, filepath: moduleFilePath });
  // return moduleTarget.path;

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

      getDescriptor = getDescriptor.bind(documentation);

      const internalPropTypesPath = resolveToValue(propTypesPath);
      if (internalPropTypesPath) {
        amendPropTypes(getDescriptor, documentation, internalPropTypesPath, filepath);
      }

      const externalPropTypesPaths = resolveToImportedPaths(propTypesPath, filepath);

      externalPropTypesPaths.forEach(
        ({ moduleTargetPath, moduleFilePath }) =>
          amendPropTypes(
            // getDescriptor.bind(documentation),
            getDescriptor,
            documentation,
            resolveToValue(moduleTargetPath),
            moduleFilePath),
      );
// return;
      // // console.log(JSON.stringify(documentation, null, 2));
      // const _the_value = resolveToValueFollowImports(propTypesPath, { filepath, ast: path.scope.getGlobalScope().node });

      // console.log('_the_value', _the_value);

      // // const computedPropValueNames = getComputedPropValueNamesFromDoc(documentation);
      // // console.log('computedPropValueNames', computedPropValueNames);
      // // // const identifiers = __getIdentifiers(path.scope.getGlobalScope().node);

      // // // console.log('identifiers', identifiers);
      // const propTypesPathValue = resolveToValue(propTypesPath);
      // const outputNodePath = new NodePath(_the_value, propTypesPathValue.parentPath, propTypesPathValue.name);

      // // console.log('astTypes', NodePath);
      // console.log('outputNodePath', outputNodePath);
      //   // console.log('internal PropTypesPath', internalPropTypesPath);

      // // amendPropTypes(getDescriptor, documentation, resolveToValue(outputNodePath), filepath);
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
