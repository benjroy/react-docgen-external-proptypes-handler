const docgen = require('react-docgen');
const resolveExportDeclaration = require('react-docgen/dist/utils/resolveExportDeclaration').default
const recast = require('recast');
const types = require('recast').types;
const resolveExternalFilepath = require('./resolveExternalFilepath');
const getSrc = require('./getSrc');
const getAst = require('./getAst');
const getRoot = require('./getRoot');
const getDestructuredVariableDeclarator = require('./getDestructuredVariableDeclarator');
// const {
//   // createExternalNodePath,
//   isExternalNodePath,
//   getExternalNodePath,
// } = require('./externalNodePath');


// const n = types.namedTypes;
const {
  namedTypes: n,
  builders: b,
} = types;

// const {
//   // getPropType,
//   // getPropertyName,
//   // getMemberValuePath,
//   // isReactModuleName,
//   // printValue,
//   resolveToModule,
//   resolveToValue,
//   // // appended
//   // getNameOrValue,
// } = docgen.utils;
const {
  getPropType,
  getPropertyName,
  getMemberValuePath,
  isReactModuleName,
  printValue,
  resolveToModule,
  resolveToValue,
  // appended
  isExportsOrModuleAssignment,
  getNameOrValue,
  getMemberExpressionRoot,
  getMembers,
  getMethodDocumentation,
  getParameterName,
  getPropertyValuePath,

} = docgen.utils;

// function findExport(variable, ast, filepath) {
//   console.log('findExport', variable);

//   var result = false;

//   types.visit(ast, {
//     visitDeclareModuleExports: function(path) {
//        console.log('DeclareModuleExports', path);
//        this.traverse(path);
//     },
//     visitDeclareExportDeclaration: function(path) {
//        console.log('DeclareExportDeclaration', path);
//        this.traverse(path);
//     },
//     visitExportSpecifier: function(path) {
//        console.log('ExportSpecifier', path);
//        this.traverse(path);
//     },
//     visitExportBatchSpecifier: function(path) {
//        console.log('ExportBatchSpecifier', path);
//        this.traverse(path);
//     },
//     visitDeclareExportAllDeclaration: function(path) {
//        console.log('DeclareExportAllDeclaration', path);
//        this.traverse(path);
//     },
//     visitExportDeclaration: function(path) {
//        console.log('ExportDeclaration', path);
//        this.traverse(path);
//     },
//     visitExportDefaultDeclaration: function(path) {
//        console.log('ExportDefaultDeclaration', path);
//        this.traverse(path);
//     },
//     visitExportNamedDeclaration: function(path) {
//        // console.log('ExportNamedDeclaration', path);
//        console.log('ExportNamedDeclaration Identifier');
//        if (n.Identifier.check(path.value.declaration.declarations[0].id)) {
//         result = path.value.declaration.declarations[0].id;
//        }
//        this.traverse(path);
//     },
//     visitExportNamespaceSpecifier: function(path) {
//        console.log('ExportNamespaceSpecifier', path);
//        this.traverse(path);
//     },
//     visitExportDefaultSpecifier: function(path) {
//        console.log('ExportDefaultSpecifier', path);
//        this.traverse(path);
//     },
//     visitExportAllDeclaration: function(path) {
//        console.log('ExportAllDeclaration', path);
//        this.traverse(path);
//     },
//   });

//   return result;
// };

// function createExternalNodePath(path, { ast, filepath }) {
//   return { path, ast, filepath };
// }

function resolveExternalImportDeclarationPath(importDeclarationPath, filepath) {
  n.ImportDeclaration.assert(importDeclarationPath.node);
  const source = importDeclarationPath.node.source;
  n.Literal.assert(source);
  const extFilepath = resolveExternalFilepath(filepath, source.value);
  const extAst = getAst(getSrc(extFilepath));
  return {
    filepath: extFilepath,
    ast: extAst,
  };
}

const __EXPORTS__ = '__EXPORTS__';
function resolveExternalNamespaceImport(importDeclarationPath, filepath) {
// function resolveExternalNamespaceCjs(importDeclarationPath, filepath) {
  const external = resolveExternalImportDeclarationPath(importDeclarationPath, filepath);

  console.log('resolveExternalNamespaceImport', external.filepath);

  const namespace = [];

  let defaultModuleExports;

  const addNamespaceExport = (key, valuePath) => {
    // console.log('addNamespaceExport', key, valuePath);
    namespace.push([key, valuePath]);
  }

  types.visit(external.ast, {
    visitAssignmentExpression(path) {
      let leftPath = path.get('left');
      let keys = [];
      let valuePath;

      while (n.MemberExpression.check(leftPath.node)) {
        if (
          leftPath.node.object.name === 'module'
          && leftPath.node.property.name === 'exports'
        ) {
          if (n.MemberExpression.check(leftPath.parentPath.node)) {
            const key = leftPath.parentPath.get('property').node.name;
            keys.push(key);
          }
          valuePath = path.get('right');
          break;
        }
        leftPath = leftPath.get('object');
        // const key = leftPath.parentPath
        // keys.push(leftPath.get('property').node.name);
      }

      if (valuePath) {
        // module.exports = { ... }
        if (!keys.length) {
          defaultModuleExports = valuePath;
        }
        // module.exports.foo = ...;
        else if (keys.length === 1) {
          // namespace.push([keys[0], valuePath]);
          addNamespaceExport(keys[0], valuePath);
        }
        // don't process module.exports.foo.bar... = ...;
      }
      this.traverse(path);
    },
    // visitMemberExpression(path) {
    //   if (
    //     path.node.object.name === 'module'
    //     && path.node.property.name === 'exports'
    //   ) {
    //     console.log('visitMemberExpression', path.parentPath)
    //     // module.exports = { ... };
    //     if (n.AssignmentExpression)

    //     // module.exports.foo = ...;
    //   }
    //   this.traverse(path);
    // },
    visitExportDefaultDeclaration(path) {
      // defaultValue = path.get('declaration');
      // namespace.push(['default', resolveToValue(path.get('declaration'))]);
      // namespace.push(['default', path.get('declaration')]);
      addNamespaceExport('default', path.get('declaration'));
      // addNamespaceExport('default', resolveToValue(path.get('declaration'));
      this.traverse(path);
    },
    visitExportNamedDeclaration(path) {
      // console.log('visitNamedExportDeclaration', path);

      const declarations = path.get('declaration').get('declarations');

      // console.log('DECLARATION PATH', filepath, declarations)

      if (declarations.value && declarations.value.length) {
        // throw '  yes there are declarations';
        declarations.each(declarationsPath => {
          const idPath = declarationsPath.get('id');
          const initPath = declarationsPath.get('init');
          // console.log('IDIID', idPath.node.name)
          addNamespaceExport(idPath.node.name, initPath);
        });        
      }

      const specifiers = path.get('specifiers');

      // if (specifiers.node.length) {
      //   console.log('specifiers', specifiers);
      //   specifiers
      path.get('specifiers')
        .each(specifierPath => {
          const identifierPath = specifierPath.node.id
            ? specifierPath.get('id')
            : specifierPath.get('local');

          const idPath = specifierPath.get('id');
          const localPath = specifierPath.get('local');
          // console.log('2 visitNamedExportDeclaration', { idPath, localPath });

          // namespace.push([identifierPath.node.name, resolveToValue(identifierPath)]);
          addNamespaceExport(identifierPath.node.name, identifierPath);
          // addNamespaceExport(identifierPath.node.name, resolveToValue(identifierPath));
        });

      // }

        // .each(declarationPath => {
        //   const identifierPath = specifierPath.node.id
        //     ? specifierPath.get('id')
        //     : specifierPath.get('local');

        //   const idPath = specifierPath.get('id');
        //   const localPath = specifierPath.get('local');
        //   console.log('2 visitNamedExportDeclaration', { idPath, localPath });

        //   // namespace.push([identifierPath.node.name, resolveToValue(identifierPath)]);
        //   addNamespaceExport(identifierPath.node.name, identifierPath);
        //   // addNamespaceExport(identifierPath.node.name, resolveToValue(identifierPath));
        // });

      this.traverse(path);
    },
    // visitExportNamedSpecifier(path) {
    //       console.log('visitExportNamedSpecifier', path);

    //   path
    //     .get('specifiers')
    //     .each(specifierPath => {
    //       const identifierPath = specifierPath.node.id
    //         ? specifierPath.get('id')
    //         : specifierPath.get('local');

    //       const idPath = specifierPath.get('id');
    //       const localPath = specifierPath.get('local');
    //       console.log('2 visitNamedExportDeclaration', { idPath, localPath });

    //       // namespace.push([identifierPath.node.name, resolveToValue(identifierPath)]);
    //       addNamespaceExport(identifierPath.node.name, identifierPath);
    //       // addNamespaceExport(identifierPath.node.name, resolveToValue(identifierPath));
    //     });

    //   this.traverse(path);
    // },
  });

  const namespaceObjectExpression = (keyValuePaths) => {
    // console.log('namespaceObjectExpression', keyValuePaths);
    return b.objectExpression(
      keyValuePaths.map(([key, valuePath]) => {
        // console.log('MAKE IT', key, valuePath.node && valuePath.node.type);
        return b.objectProperty(
          b.stringLiteral(key),
          valuePath.node
        )
      })
    );
  };

  if (defaultModuleExports) {
    if (n.ObjectExpression.check(defaultModuleExports.node)) {
      defaultModuleExports.get('properties').each(
        (propertyPath) => {
          addNamespaceExport(propertyPath.get('key').node.name, propertyPath.get('value'))
        }
      );
      addNamespaceExport('default', { node: namespaceObjectExpression(namespace) });
    }
  }

  // inject the namespace valuepaths
  const injection = b.variableDeclaration('const', [
    b.variableDeclarator(
      b.identifier(__EXPORTS__),
      namespaceObjectExpression(namespace)
      // b.objectExpression(
      //   namespace.map(([key, valuePath]) => {
      //     // console.log('MAKE IT', key);
      //     return b.objectProperty(
      //       b.stringLiteral(key),
      //       valuePath.node
      //     )
      //   })
      // )
    )
  ]);

  const program = external.ast;
  // console.log('program', external.ast);
  // external.ast.program.pushContainer('body', injection);
  external.ast.program.body.push(injection);
  // console.log('AGAINASFSAFAS', recast.print(external.ast).code)

  return resolveIdentifierNameToExternalValue(
    __EXPORTS__,
    // regenerate ast with injected code
    // TODO: find a more optimal way
    // getAst(recast.print(external.ast).code),
    external.ast,
    external.filepath
  );

  // return {
  //   // seems not optimal
  //   ast: getAst(recast.print(external.ast).code),
  //   filepath: external.filepath,
  // };
}

function resolveExternalImport(extVariable, importDeclarationPath, filepath) {
  // const namespacePath = resolveExternalNamespaceImport(importDeclarationPath, filepath);
  // const external = getExternalNodePath(namespacePath);
  const external = resolveExternalNamespaceImport(importDeclarationPath, filepath);
  // const external = getExternalNodePath(namespacePath);

  // console.log('resolveExternalImport', extVariable, filepath, external.path.node.properties, external);
  const matched = external.path.get('properties').filter(
    propertyPath => {
      // console.log('prop', propertyPath.get('key').node.value);
      return extVariable === propertyPath.get('key').node.value
    }
  );
  // console.log('matched', extVariable, matched);
  // return createExternalNodePath(matched[0].get('value'), external);
  return { ...external, path: matched[0].get('value') };
  // return resolveIdentifierNameToExternalValue(extVariable, external.ast, external.filepath);

  // const external = resolveExternalImportDeclarationPath(importDeclarationPath, filepath);
  // console.log('resolveExternalImport', extVariable, external);
  // return resolveIdentifierNameToExternalValue(extVariable, external.ast, external.filepath);


  // n.ImportDeclaration.assert(importDeclarationPath.node);
  // const source = importDeclarationPath.node.source;
  // n.Literal.assert(source);
  // const extFilepath = resolveExternalFilepath(filepath, source.value);
  // const extAst = getAst(getSrc(extFilepath));
  // console.log('resolveExternalImport', extVariable, extFilepath, getSrc(extFilepath));
  // return resolveIdentifierNameToExternalValue(extVariable, extAst, extFilepath);
}

function resolveIdentifierNameToExternalValue(variable, ast, filepath) {
  console.log('resolveIdentifierNameToExternalValue', variable, filepath);
  var result = false;

  types.visit(ast, {
    visitImportSpecifier: function(path) {
      if (path.value.local.name === variable) {
        const extVariable = path.value.imported.name;
        const importDeclarationPath = resolveToValue(path).parentPath;

        // result = resolveExternalImport(extVariable, importDeclarationPath, filepath);
        const resolved = resolveExternalImport(extVariable, importDeclarationPath, filepath);
        console.log('visitImportSpecifier resolved');
        result = resolved;
        return false;
      }
      this.traverse(path);
    },
    // import * as ...
    visitImportNamespaceSpecifier: function(path) {
      if (path.value.local.name === variable) {
        const importDeclarationPath = path.parentPath.parentPath;
        n.ImportDeclaration.assert(importDeclarationPath.node);
        const importSourceLiteralPath = importDeclarationPath.get('source');
        n.Literal.assert(importSourceLiteralPath.node);

        result = resolveExternalNamespaceImport(importDeclarationPath, filepath);
        console.log(`resolved: ${variable} to: ${result.path.node.type}`);
        return false;
      }
      this.traverse(path);
    },

//     visitMemberExpression(path) {
//       console.log('visitMemberExpression', variable, path);



//       // .property.name is variable name in external module
//       // .object.name is locally assigned variable being destructured


// //         // console.log('MemberExpression', valuePath.node.property.name, valuePath.node.object.name, getMembers(valuePath));
// //         // .property.name is variable name in external module
// //         const extTargetVariable = valuePath.node.property.name;
// //         // .object.name is locally assigned variable being destructured
// //         const extVariable = valuePath.node.object.name;
// //         const importDeclarationValuePath = resolveToValue(valuePath.get('object')).parentPath;
// //         console.log('importDeclarationValuePath', variable, resolveToValue(valuePath));
// //         result = resolveExternalImport(extTargetVariable, importDeclarationValuePath, filepath);
// //         console.log('extTargetVariable result:', variable, { extVariable, extTargetVariable }, result);


//       this.traverse(path);
//     },
    visitImportDefaultSpecifier: function(path) {
      if (path.value.local.name === variable) {
        // console.log('visitImportDefaultSpecifier', variable, path);
        const extVariable = 'default';
        const importDeclarationPath = resolveToValue(path).parentPath;
        result = resolveExternalImport(extVariable, importDeclarationPath, filepath);
        return false;
      }
      this.traverse(path);
    },
    visitIdentifier(path) {
      if (path.value.name === variable) {
        // ensure this identifier is created in a
        // `const { variable } = targetVariable;`
        const variableDeclaratorPath = getDestructuredVariableDeclarator(path);
        if (!variableDeclaratorPath) return this.traverse(path);
        // ensure variable is not right side
        // i.e. `const { foo, bar } = variable;`
        const targetVariable = variableDeclaratorPath.node.init.name;
        if (targetVariable === variable) return this.traverse(path);

        // console.log('I GOT A VARIABLE DECLARATOR', variable);

        // get path inside target object
        // TODO: react-docgen has a util for this I'll bet
        let p = path;
        const extKeyNames = [];
        let keyPath;
        while (n.Property.check(p.parentPath.node)) {
          keyPath = p.parentPath.get('key');
          n.Identifier.assert(keyPath.node);
          extKeyNames.push(keyPath.node.name);
          p = p.parentPath.parentPath;
        }

        // ok, resolve the target variable from the declarator through any import,
        // and then do a loop while popping off and drilling down into the members of the
        // resolved values

        let {
          path: targetPath,
          ast: targetAst,
          filePath: targetFilepath,
        } = resolveIdentifierNameToExternalValue(targetVariable, ast, filepath);
        // let targetPath = resolveIdentifierNameToExternalValue(targetVariable, ast, filepath);
        // let targetAst = ast;
        // let targetFilepath = filepath;

        // and go from here
        while (extKeyNames.length) {          
          // if (isExternalNodePath(targetPath)) {
          //   const external = getExternalNodePath(targetPath);
          //   // console.log('EXTERNAL', external);
          //   // change scopes
          //   // TODO: refactor this need away
          //   targetPath = external.path;
          //   targetAst = external.ast;
          //   targetFilepath = external.filepath;
          // }

          const keyName = extKeyNames.shift();

          const propPath = targetPath.get('properties').filter(
            // propertyPath => keyName === getNameOrValue(propertyPath.get('key'))
            propertyPath => keyName === propertyPath.get('key').node.value
          );

          targetPath = propPath[0].get('value');
        }

        // result = createExternalNodePath(targetPath, { ast: targetAst, filepath: targetFilepath });
        result = { path: targetPath, ast: targetAst, filepath: targetFilepath };

        return false;
      }

      this.traverse(path);
    },
    // this is cheating, unless looking for something in object expression
    visitVariableDeclarator: function(path) {
      if (path.value.id.name === variable) {
        const valuePath = resolveToValue(path);
        // result = createExternalNodePath(valuePath, { ast, filepath });
        result = { path: valuePath, ast, filepath };
        console.log('found in visitVariableDeclarator', variable, result.path.node.type);
        return false;
      }
      this.traverse(path);
    },

    // visitObjectPattern(path) {
    //   if ()
    //   console.log('VISIT VARIABLEDECLARATOR', variable, resolveToValue(path));
    // },

    // visitExportDefaultDeclaration: function(path) {
    //   if (variable === 'default') {
    //     // console.log('ExportDefaultDeclaration', path.node.declaration);
    //     if (n.Identifier.check(path.node.declaration)) {
    //       // console.log('Identifier ExportDefaultDeclaration', path.node.declaration.name);
    //       result = resolveIdentifierNameToExternalValue(path.node.declaration.name, ast, filepath);
    //       return false;
    //     }
    //     console.log('ExportDefaultDeclaration', path.node.declaration, resolveToValue(path));
    //     throw new Error('i do not think i have ever hit this');
    //     result = resolveToValue(path); // propbs need to createExternalNodePath
    //     // result = path.node.declaration;
    //     return false;
    //   }
    //   this.traverse(path);
    // },

    // visitExportDeclaration: function(path) {
    //   console.log('visitExportDeclaration', path);
    //   this.traverse(path);
    // },
    // visitImportDeclaration: function(path) {
    //   console.log('visitImportDeclaration', path);
    //   this.traverse(path);
    // },
  });

  return result;
}

module.exports = resolveIdentifierNameToExternalValue;
