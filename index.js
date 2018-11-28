const handler = require('./nightly_externalPropTypeHandler');

module.exports = handler;

// const path = require('path')
// const fs = require('fs')
// const recast = require('recast')

// /**
//  * Re-using few private methods of react-docgen to avoid code dupilcation
//  */
// const isRequiredPropType = require(`react-docgen/dist/utils/isRequiredPropType`).default
// const setPropDescription = require(`react-docgen/dist/utils/setPropDescription`).default
// const babylon = require(`react-docgen/dist/babylon`).default
// const docgen = require('react-docgen');

// // const handlers = docgen.handlers;
// // console.log('handlers', handlers);
// const utils = docgen.utils
// const types = recast.types.namedTypes
// const HOP = Object.prototype.hasOwnProperty
// const createObject = Object.create

// function isPropTypesExpression(path) {
//   const moduleName = utils.resolveToModule(path)
//   // console.log('isPropTypesExpression', moduleName, path);
//   if (moduleName) {
//     return utils.isReactModuleName(moduleName) || moduleName === 'ReactPropTypes'
//   }

//   return false
// }

// /**
//  * Amends the documentation object with propTypes information.
//  * @method amendPropTypes
//  * @param  {Object} documentation  documentation obejct
//  * @param  {Object} path  node path reference of propTypes property
//  */
// function amendPropTypes(documentation, path) {
//   if (!types.ObjectExpression.check(path.node)) {
//     console.log('NOT AMENDING THIS', path)
//     throw new Error('NOT AMENDIONG THIS');
//     return
//   }
//   // console.log('amendPropTypes', path, path.get('properties'));
//   path.get('properties').each(propertyPath => {
//     let propDescriptor, valuePath, type, resolvedValuePath

//     const nodeType = propertyPath.node.type

//     if (nodeType === types.Property.name) {
//       propDescriptor = documentation.getPropDescriptor(utils.getPropertyName(propertyPath))
//       valuePath = propertyPath.get('value')
//       // console.log('VALUE', valuePath);
//       type = isPropTypesExpression(valuePath)
//         ? utils.getPropType(valuePath)
//         : {
//             name: 'custom',
//             raw: utils.printValue(valuePath)
//           }
//       if (type) {
//         propDescriptor.type = type
//         propDescriptor.required = type.name !== 'custom' && isRequiredPropType(valuePath)
//       }
//     } else if (nodeType === types.SpreadProperty.name) {
//       resolvedValuePath = utils.resolveToValue(propertyPath.get('argument'))
//       // normal object literal
//       if (resolvedValuePath.node.type === types.ObjectExpression.name) {
//         amendPropTypes(documentation, resolvedValuePath)
//       }
//     }

//     if (types.Property.check(propertyPath.node)) {
//       setPropDescription(documentation, propertyPath)
//     }
//   })
// }

// /**
//  * Accepts absolute path of a source file and returns the file source as string.
//  * @method getSrc
//  * @param  {String} filePath  File path of the component
//  * @return {String} Source code of the given file if file exist else returns empty
//  */
// function getSrc(filePath) {
//   let src

//   if (fs.existsSync(filePath)) {
//     src = fs.readFileSync(filePath, 'utf-8')
//   }

//   return src
// }

// function getAST(src) {
//   return recast.parse(src, {
//     source: 'module',
//     esprima: babylon
//   })
// }

// /**
//  * Resolves propTypes source file path relative to current component,
//  * which resolves only file extension of type .js or .jsx
//  *
//  * @method resolveFilePath
//  * @param  {String} componentPath  Relative file path of the component
//  * @param  {String} importedFilePath Relative file path of a dependent component
//  * @return {String} Resolved file path if file exist else null
//  */
// function resolveFilePath(componentPath, importedFilePath) {
//   const regEx = /\.(js|jsx)$/
//   let srcPath = path.resolve(path.dirname(componentPath), importedFilePath)

//   if (regEx.exec(srcPath)) {
//     return srcPath
//   } else {
//     srcPath += fs.existsSync(`${srcPath}.js`) ? '.js' : '.jsx'
//     return srcPath
//   }
// }

// /**
//  * Method which returns actual values from the AST node of type specifiers.
//  *
//  * @method getSpecifiersOfNode
//  */
// function getSpecifiersOfNode(specifiers) {
//   const specifier = []

//   specifiers.forEach(node => {
//     specifier.push(node.local.name)
//   })

//   return specifier
// }

// /**
//  * Filters the list of identifier node values or node paths from a given AST.
//  *
//  * @method getIdentifiers
//  * @param  {Object} ast Root AST node of a component
//  * @return {Object} Which holds identifier relative file path as `key` and identifier name as `value`
//  */
// function getIdentifiers(ast) {
//   const identifiers = createObject(null)

//   recast.visit(ast, {
//     visitVariableDeclarator(path) {
//       const node = path.node
//       const nodeType = node.init.type

//       if (nodeType === types.Identifier.name) {
//         if (identifiers[node.init.name]) {
//           identifiers[node.init.name].push(node.init.name)
//         } else {
//           identifiers[node.init.name] = [node.init.name]
//         }
//       } else if (nodeType === types.Literal.name) {
//         if (identifiers[node.id.name]) {
//           identifiers[node.id.name].push(node.init.value)
//         } else {
//           identifiers[node.id.name] = [node.init.value]
//         }
//       } else if (nodeType === types.ArrayExpression.name) {
//         if (identifiers[node.id.name]) {
//           identifiers[node.id.name].push(node.init.elements)
//         } else {
//           identifiers[node.id.name] = node.init.elements
//         }
//       } else if (nodeType === types.ObjectExpression.name) {
//         if (identifiers[node.id.name]) {
//           identifiers[node.id.name].push({
//             path,
//             value: node.init.properties
//           })
//         } else {
//           identifiers[node.id.name] = {
//             path,
//             value: node.init.properties
//           }
//         }
//       }

//       this.traverse(path)
//     }
//   })

//   return identifiers
// }

// /**
//  * Traverse through given AST and filters named and default export declarations.
//  *
//  * @method getExports
//  * @param  {Object} ast Root AST node of a component
//  * @return {Array} which holds list of named identifiers
//  */
// function getExports(ast) {
//   const exports = []

//   recast.visit(ast, {
//     visitExportNamedDeclaration(path) {
//       const node = path.node
//       const specifiers = getSpecifiersOfNode(node.specifiers)
//       const declarations = Object.keys(getIdentifiers(ast))

//       exports.push(...new Set(specifiers.concat(declarations)))
//       this.traverse(path)
//     },
//     visitExportDefaultDeclaration(path) {
//       const node = path.node

//       if (node.declaration.type === types.Identifier.name) {
//         exports.push(node.declaration.name)
//       }
//       /* Commenting it for now, this might needed for further enchancements.
//       else if (nodeType === types.Literal.name) {
//         varDeclarators.push(node.init.value);
//       } else if (nodeType === types.ArrayExpression.name) {
//         computedPropNodes[node.id.name] = node.init.elements;
//       }*/
//       this.traverse(path)
//     }
//   })

//   return exports
// }

// /**
//  * Method to list all specifiers of es6 `import` of a given file(AST)
//  *
//  * @method getImports
//  * @param  {Object} ast Root AST node of a component
//  * @return {Object/Boolean} if Object: Holds import module name or file path as `key`
//  *                          and identifier as `value`, else return false
//  */
// function getImports(ast) {
//   const specifiers = createObject(null)

//   recast.visit(ast, {
//     visitImportDeclaration: path => {
//       const name = path.node.source.value
//       const specifier = getSpecifiersOfNode(path.node.specifiers)

//       if (!specifiers[name]) {
//         specifiers[name] = specifier
//       } else {
//         specifiers[name].push(...specifier)
//       }

//       return false
//     }
//   })

//   return specifiers
// }

// // TODO: refactor into getSpecifiersOfNode
// // function getBaseSpecifiersOfNode(specifiers) {
// //   const specifier = []

// //   specifiers.forEach(node => {
// //     specifier.push({
// //       local: node.local.name,
// //       imported: node.imported && node.imported.name,
// //     });
// //   })

// //   return specifier
// // }

// // TODO: refactor getImports
// function getImportSpecifiersForVariable(ast) {
//   const specifiers = createObject(null)

//   recast.visit(ast, {
//     visitImportDeclaration: path => {
//       // import { foo } from '<name>'
//       const name = path.node.source.value
//       path.node.specifiers.forEach(node => {
//         specifiers[node.local.name] = {
//           path: name,
//           imported: node.imported && node.imported.name,
//         }
//       })
//       // const specifier = getBaseSpecifiersOfNode(path.node.specifiers)
//       // // console.log('getImportsDict', name, specifier);
//       // if (!specifiers[name]) {
//       //   specifiers[name] = specifier
//       // } else {
//       //   specifiers[name].push(...specifier)
//       // }

//       return false
//     }
//   })

//   return specifiers
// }

// /**
//  * Method to resolve all dependent values(computed values, which are from external files).
//  *
//  * @method resolveImportedDepedencies
//  * @param  {Object} ast Root AST node of the component
//  * @param  {Object} srcFilePath Absolute path of a dependent file
//  * @return {Object} Holds export identifier as `key` and respective AST node path as value
//  */
// function resolveImportedDepedencies(ast, srcFilePath) {
//   const filteredItems = createObject(null)
//   const importSpecifiers = getImports(ast)

//   let identifiers, reolvedNodes

//   if (importSpecifiers && Object.keys(importSpecifiers).length) {
//     reolvedNodes = resolveDependencies(importSpecifiers, srcFilePath)
//   }

//   const exportSpecifiers = getExports(ast)

//   if (exportSpecifiers && exportSpecifiers.length) {
//     identifiers = getIdentifiers(ast)
//   }

//   if (reolvedNodes) {
//     Object.assign(identifiers, ...reolvedNodes)
//   }

//   for (const identifier in identifiers) {
//     if (HOP.call(identifiers, identifier) && exportSpecifiers.indexOf(identifier) > -1) {
//       filteredItems[identifier] = identifiers[identifier]
//     }
//   }

//   return filteredItems
// }

// /**
//  * Method to resolve all the external depedencies of the component propTypes
//  *
//  * @method resolveDependencies
//  * @param  {Array} filePaths List of files to resolve
//  * @param  {String} componentPath Absolute path of the component in case `propTypes` are declared in a component file or
//  *                  absolute path to the file where `propTypes` is declared.
//  */
// function resolveDependencies(filePaths, componentPath) {
//   const importedNodes = []

//   for (const importedFilePath in filePaths) {
//     if (HOP.call(filePaths, importedFilePath)) {
//       const srcPath = resolveFilePath(componentPath, importedFilePath)

//       if (!srcPath) {
//         return
//       }

//       const src = getSrc(srcPath)

//       if (src) {
//         const ast = getAST(src)
//         importedNodes.push(resolveImportedDepedencies(ast, srcPath))
//       }
//     }
//   }

//   return importedNodes
// }

// /**
//  * Method to filter computed props(which are declared out side of the component and used in propTypes object).
//  *
//  * @method filterSpecifiers
//  * @param  {Object} specifiers  List which holds all the values of external depedencies
//  * @return {Object} computedPropNames  List which holds all the computed values from `propTypes` property
//  */
// function filterSpecifiers(specifiers, computedPropNames) {
//   const filteredSpecifiers = createObject(null)

//   for (const cp in computedPropNames) {
//     if (HOP.call(computedPropNames, cp)) {
//       for (const sp in specifiers) {
//         if (HOP.call(specifiers, sp) && specifiers[sp].indexOf(cp) > -1) {
//           filteredSpecifiers[sp] ? filteredSpecifiers[sp].push(cp) : (filteredSpecifiers[sp] = [cp])
//         }
//       }
//     }
//   }

//   return filteredSpecifiers
// }

// /**
//  * Method to parse and get computed nodes from a document object
//  *
//  * @method getComputedPropValuesFromDoc
//  * @param  {Object} doc  react-docgen document object
//  * @return {Object/Boolean} Object with computed property identifer as `key` and AST node path as `value`,
//  *                          If documnet object have any computed properties else return false.
//  */

// function getComputedPropValuesFromDoc(doc) {
//   let flag
//   const computedProps = createObject(null)
//   const props = doc.toObject().props

//   flag = false

//   if (props) {
//     for (const prop in props) {
//       if (HOP.call(props, prop)) {
//         const o = props[prop]
//         if (o.type && o.type.name === 'enum' && o.type.computed) {
//           flag = true
//           computedProps[o.type.value] = o
//         }
//       }
//     }
//     return flag ? computedProps : false
//   } else {
//     return false
//   }
// }

// /**
//  * Method to update the document object computed values with actual values to generate doc for external dependent values.
//  *
//  * @method amendDocs
//  * @param  {Object} doc  react-docgen document object
//  * @param  {Object} path  AST node path of component `propTypes`
//  * @param  {Object} props  list of actula values of computed properties
//  */
// function amendDocs(doc, path, props) {
//   const propsToPatch = path.get('properties')

//   function getComputedPropVal(name) {
//     for (let i = 0; i < props.length; i++) {
//       if (props[i][name]) {
//         return props[i][name]
//       }
//     }
//   }

//   propsToPatch.each(propertyPath => {
//     const propDescriptor = doc.getPropDescriptor(utils.getPropertyName(propertyPath))

//     if (propDescriptor.type.name === 'enum' && propDescriptor.type.computed) {
//       const oldVal = propDescriptor.type.value
//       const newVal = getComputedPropVal(propDescriptor.type.value) || oldVal
//       propDescriptor.type.value = newVal
//       propDescriptor.type.computed = false
//     }
//   })
// }


// function isImportedVariable({ ast, variableName }) {
//   const importSpecifiers = getImportSpecifiersForVariable(ast)
//   return !!importSpecifiers[variableName];
// }

// function resolveImportedVariableNameToAstPath({ filepath, ast, variableName, document, path }) {
//   console.log('resolveImportedVariableNameToAstPath', { variableName, filepath });

//   // get map of import paths to local and remote variable names
//   const importSpecifiers = getImportSpecifiersForVariable(ast)
//   // pick the path to the targeted file
//   const importTarget = importSpecifiers[variableName];
//   console.log('resolveImportedVariableNameToAstPath importTarget', importTarget)

//   if (!importTarget) {
//     throw new Error(`Cannot find target to import for variableName: ${variableName} in ${filepath}`);
//   }

//   const importedFilepath = resolveFilePath(filepath, importTarget.path); // slightly altered
//   const importedSrc = getSrc(importedFilepath) //altered
//   const importedAST = getAST(importedSrc) // altered
//   const importedPropTypes = getIdentifiers(importedAST)[importTarget.imported || variableName]; // slightly altered

//   if (!importedPropTypes) {
//     // TODO: better error
//     throw 'no imported proptypes'
//   }
//   // console.log('resolveImportedVariableNameToAstPathimportedPropTypes', importedPropTypes);
//   const importedPropTypesPath = utils.resolveToValue(importedPropTypes.path)

//   return { path: importedPropTypesPath, filepath: importedFilepath, ast: importedAST };
// }

// /**
//  * Initilizer of react-docgen custom handler.
//  *
//  * @method createImportHandler
//  * @param  {String} componentPath  Absolute path of the react component
//  */
// function createImportHandler(componentPath) {
//   const filepath = componentPath;
//   return function handleExternalImports(doc, path) {
//     // TODO: rename root
//     const root = path.scope.getGlobalScope().node;
//     let propTypesPath, propTypesFilePath, propTypesAST;
//     console.log('handleExternalImports doc', doc);
//     // console.log('handleExternalImports path', path);
//     propTypesAST = root;
//     const ast = root;
//     propTypesFilePath = componentPath;

//     propTypesPath = utils.getMemberValuePath(path, 'propTypes');
//     if (!propTypesPath) return;
//     console.log('got getMemberValuePath', componentPath);
//     // propTypesPath = utils.resolveToValue(propTypesPath);
//     // if (!propTypesPath) return;
//     // console.log('got resolveToValue', propTypesPath);
//     // OH WOW REMOVE THOSE THREE LINES ABOVE

//     // utils.getNameOrValue(propTypesPath); // gives local variable name when literal assignment

//     // const isObjectExpression = types.ObjectExpression.check(propTypesPath.node);
//     // console.log('before condition', isObjectExpression);


//     // gather all proptype variable names to import
//     // follow them through all the files to find the target in the end
//     // then we have a map of local names to ast paths for the objects in their external files


//     const importedVariableNames = [];

//     // deal with literal assignments
//     if (types.ObjectExpression.check(propTypesPath.node) === false) {
//       console.log('PROPTYPESPATH', propTypesPath)
//       // if (!isImportedVariable({ ast, variableName: propTypesPath.node.name })) return;
//       // importedVariableNames.push(propTypesPath.node.name);
//       const variableName = utils.getNameOrValue(propTypesPath); // gives local variable name when literal assignment
//       if (!isImportedVariable({ ast, variableName })) return;
//       importedVariableNames.push(variableName);
//     }
//     // deal with spread variables
//     if (types.ObjectExpression.check(propTypesPath.node) === true) {
//       propTypesPath.get('properties').each(propertyPath => {
//         if (!types.SpreadProperty.check(propertyPath.value)) return;
//         console.log('propertyPath resolved to value', utils.resolveToValue(propertyPath));
//         if (!isImportedVariable({ ast, variableName: propertyPath.node.argument.name })) return;
//         importedVariableNames.push(propertyPath.node.argument.name);
//       });
//     }

//     importedVariableNames
//       // follow them through all the files to find the target in the end
//       .map(variableName => resolveImportedVariableNameToAstPath({ variableName, ast, filepath }))
//       // process the values into documentation props
//       .forEach(resolvedImportedVariable => amendPropTypes(doc, resolvedImportedVariable.path));

//     // importedVariableNames.forEach(variableName => {
//     //   const resolved = resolveImportedVariableNameToAstPath({ variableName, ast, filepath });
//     //   //updating doc object with external props
//     //   amendPropTypes(doc, resolved.path);
//     // });

//     const computedPropNames = getComputedPropValuesFromDoc(doc)
//     console.log('computedPropNames', computedPropNames)
//     if (!computedPropNames) {
//       return
//     }

//     const importSpecifiers = getImports(propTypesAST)
//     console.log('importSpecifiers', importSpecifiers)
//     if (!importSpecifiers) {
//       return
//     }

//     const filteredProps = filterSpecifiers(importSpecifiers, computedPropNames)
//     console.log('filteredProps', filteredProps)
//     if (!Object.keys(filteredProps).length) {
//       return
//     }

//     const resolvedImports = resolveDependencies(filteredProps, propTypesFilePath)
//     console.log('resolvedImports', resolvedImports)

//     if (!resolvedImports.length) {
//       return
//     }
//     amendDocs(doc, propTypesPath, resolvedImports)
//   }
//   // return function handleExternalImports(doc, path) {
//   //   const root = path.scope.getGlobalScope().node
//   //   let propTypesPath, propTypesFilePath, propTypesAST

//   //   propTypesPath = utils.getMemberValuePath(path, 'propTypes')
//   //   propTypesAST = root
//   //   propTypesFilePath = componentPath

//   //   if (!propTypesPath) {
//   //     return
//   //   }
//   //   // console.log('propTypesPath', propTypesFilePath);
//   //   // TEMP CODE HERE
//   //   // END TEMP CODE HERE

//   //   // const propsNameIdentifier = propTypesPath.node.name
//   //   let propsNameIdentifier = propTypesPath.node.name
//   //   propTypesPath = utils.resolveToValue(propTypesPath)
//   //   // console.log('propsNameIdentifier', propsNameIdentifier);
//   //   if (!propTypesPath) {
//   //     return
//   //   }
//   //   // console.log('2 propTypesPath', propTypesPath);

//   //   if (!types.ObjectExpression.check(propTypesPath.node)) {
//   //     // console.log('propTypesPath.node.source.value', propTypesPath.node.source);
//   //     //First resolve dependencies against component path
//   //     propTypesFilePath = resolveFilePath(componentPath, propTypesPath.node.source.value)
//   //     const propTypesSrc = getSrc(propTypesFilePath)
//   //     propTypesAST = getAST(propTypesSrc)
//   //     const importedPropTypes = getIdentifiers(propTypesAST)[propsNameIdentifier]

//   //     if (!importedPropTypes) {
//   //       return
//   //     }
//   //     // console.log('importedPropTypes', propTypesFilePath);
//   //     propTypesPath = utils.resolveToValue(importedPropTypes.path)

//   //     //updating doc object with external props
//   //     amendPropTypes(doc, propTypesPath)
//   //   } else {
//   //     console.log('I AM AN OBJECT EXPRESSION');
//   //     // console.log(propTypesPath);
//   //     propTypesPath.get('properties').each(propertyPath => {

//   //       if (!types.SpreadProperty.check(propertyPath.value)) return;
//   //       // console.log('propertyPath.node', Object.keys(propertyPath.node), propertyPath.node);

//   //       const variableNameToSpread = propertyPath.node.argument.name;
//   //       console.log('variableNameToSpread', variableNameToSpread);

//   //       // get map of import paths to local and remote variable names
//   //       const importSpecifiers = getImportSpecifiersForVariable(propTypesAST)
//   //       // console.log('spread importSpecifiers', importSpecifiers)

//   //       // pick the path to the targeted file
//   //       const importTarget = importSpecifiers[variableNameToSpread];
//   //       console.log('importTarget', importTarget)

//   //       if (!importTarget) {
//   //         return;
//   //       }

//   //       const _propsNameIdentifier = importTarget.imported || variableNameToSpread;
//   //       // lots duplicated from here
//   //       const _propTypesFilePath = resolveFilePath(componentPath, importTarget.path); // slightly altered
//   //       const propTypesSrc = getSrc(_propTypesFilePath) //altered
//   //       const _propTypesAST = getAST(propTypesSrc) // altered
//   //       const importedPropTypes = getIdentifiers(_propTypesAST)[_propsNameIdentifier]; // slightly altered

//   //       if (!importedPropTypes) {
//   //         return
//   //       }
//   //       console.log('importedPropTypes', propTypesFilePath);
//   //       propTypesPath = utils.resolveToValue(importedPropTypes.path)

//   //       //updating doc object with external props
//   //       amendPropTypes(doc, propTypesPath)

//   //     });

//   //   }

//   //   const computedPropNames = getComputedPropValuesFromDoc(doc)
//   //   console.log('computedPropNames', computedPropNames)
//   //   if (!computedPropNames) {
//   //     return
//   //   }

//   //   const importSpecifiers = getImports(propTypesAST)
//   //   console.log('importSpecifiers', importSpecifiers)
//   //   if (!importSpecifiers) {
//   //     return
//   //   }

//   //   const filteredProps = filterSpecifiers(importSpecifiers, computedPropNames)

//   //   if (!Object.keys(filteredProps).length) {
//   //     return
//   //   }

//   //   const resolvedImports = resolveDependencies(filteredProps, propTypesFilePath)

//   //   if (!resolvedImports.length) {
//   //     return
//   //   }

//   //   amendDocs(doc, propTypesPath, resolvedImports)
//   // }
// }

// module.exports = createImportHandler