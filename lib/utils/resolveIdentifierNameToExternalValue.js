const docgen = require('react-docgen');
const resolveExportDeclaration = require('react-docgen/dist/utils/resolveExportDeclaration').default
const recast = require('recast');
const types = require('recast').types;
const resolveExternalFilepath = require('./resolveExternalFilepath');
const getSrc = require('./getSrc');
const getAst = require('./getAst');
const getRoot = require('./getRoot');
const getDestructuredVariableDeclarator = require('./getDestructuredVariableDeclarator');
const {
  createExternalNodePath,
  isExternalNodePath,
  getExternalNodePathProps,
} = require('./externalNodePath');


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
  getNameOrValue,
  getMemberExpressionRoot,
  getMembers,
  getMethodDocumentation,
  getParameterName,
  getPropertyValuePath,

} = docgen.utils;

function findExport(variable, ast, filepath) {
  console.log('findExport', variable);

  var result = false;

  types.visit(ast, {
    visitDeclareModuleExports: function(path) {
       console.log('DeclareModuleExports', path);
       this.traverse(path);
    },
    visitDeclareExportDeclaration: function(path) {
       console.log('DeclareExportDeclaration', path);
       this.traverse(path);
    },
    visitExportSpecifier: function(path) {
       console.log('ExportSpecifier', path);
       this.traverse(path);
    },
    visitExportBatchSpecifier: function(path) {
       console.log('ExportBatchSpecifier', path);
       this.traverse(path);
    },
    visitDeclareExportAllDeclaration: function(path) {
       console.log('DeclareExportAllDeclaration', path);
       this.traverse(path);
    },
    visitExportDeclaration: function(path) {
       console.log('ExportDeclaration', path);
       this.traverse(path);
    },
    visitExportDefaultDeclaration: function(path) {
       console.log('ExportDefaultDeclaration', path);
       this.traverse(path);
    },
    visitExportNamedDeclaration: function(path) {
       // console.log('ExportNamedDeclaration', path);
       console.log('ExportNamedDeclaration Identifier');
       if (n.Identifier.check(path.value.declaration.declarations[0].id)) {
        result = path.value.declaration.declarations[0].id;
       }
       this.traverse(path);
    },
    visitExportNamespaceSpecifier: function(path) {
       console.log('ExportNamespaceSpecifier', path);
       this.traverse(path);
    },
    visitExportDefaultSpecifier: function(path) {
       console.log('ExportDefaultSpecifier', path);
       this.traverse(path);
    },
    visitExportAllDeclaration: function(path) {
       console.log('ExportAllDeclaration', path);
       this.traverse(path);
    },
  });

  return result;
};

function resolveToExternalValue(path, filepath) {
  n.Identifier.assert(path.node);
  // console.log('resolveToExternalValue', '\n\nresolveToModule', resolveToModule(path), '\n\nresolveToValue', resolveToValue(path));
  const valuePath = resolveToValue(path);
  console.log('resolveToExternalValue', valuePath);
  switch(valuePath.node.type) {
    case n.MemberExpression.name: {
      console.log('member expression', getMembers(valuePath));
      break;
    }
    default: {
      console.log('UNHANDLED resolveToExternalValue', valuePath.node.type);
      break;
    }
  }
}

// function resolveExternalImport(extVariable, path, filepath) {
//   n.ImportDeclaration.assert(path.parentPath.parentPath.node);
//   const source = path.parentPath.parentPath.node.source;
//   n.Literal.assert(source);
//   const extFilepath = resolveExternalFilepath(filepath, source.value);
//   const extAst = getAst(getSrc(extFilepath));
//   return resolveIdentifierNameToExternalValue(extVariable, extAst, extFilepath);
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

const __EXPORTS__ = '___EXPORTS___';
function resolveExternalNamespaceImport(importDeclarationPath, filepath) {
  const external = resolveExternalImportDeclarationPath(importDeclarationPath, filepath);
  console.log('resolveExternalNamespaceImport', external.filepath, getSrc(external.filepath));

  const namespace = [];

  types.visit(external.ast, {
    visitExportDefaultDeclaration: function(path) {
      // console.log('3131 ExportDefaultDeclaration', path.node.declaration);
      // console.log('3131 ExportDefaultDeclaration', !!path.node.default, path);
      // namespace.default = resolveToValue(path.get('declaration')); // temp set this;
      namespace.push([
        'default',
        resolveToValue(path.get('declaration')),
      ]);
      // addProperty('default', resolveToValue(path.get('declaration'));
      this.traverse(path);
    },
    visitExportNamedDeclaration: function(path) {
      path
        .get('specifiers')
        .each(specifierPath => {
          const identifierPath = specifierPath.node.id
            ? specifierPath.get('id')
            : specifierPath.get('local');

          // namespace[identifierPath.node.name] = resolveToValue(identifierPath);
          namespace.push([
            identifierPath.node.name,
            resolveToValue(identifierPath),
          ]);
          // addProperty(identifierPath.node.name, resolveToValue(identifierPath));
        });

      this.traverse(path);
    },

  });

  // inject the namespace valuepaths
  const injection = b.variableDeclaration('const', [
    b.variableDeclarator(
      b.identifier(__EXPORTS__),
      b.objectExpression(
        namespace.map(([key, valuePath]) => {
          console.log('MAKE IT', key);
          return b.objectProperty(
            b.stringLiteral(key),
            valuePath.node
          )
        })
      )
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
    getAst(recast.print(external.ast).code),
    external.filepath
  );

  // return {
  //   // seems not optimal
  //   ast: getAst(recast.print(external.ast).code),
  //   filepath: external.filepath,
  // };
}

function resolveExternalImport(extVariable, importDeclarationPath, filepath) {
  const external = resolveExternalImportDeclarationPath(importDeclarationPath, filepath);
  console.log('resolveExternalImport', extVariable, external.filepath, getSrc(external.filepath));
  return resolveIdentifierNameToExternalValue(extVariable, external.ast, external.filepath);
  // n.ImportDeclaration.assert(importDeclarationPath.node);
  // const source = importDeclarationPath.node.source;
  // n.Literal.assert(source);
  // const extFilepath = resolveExternalFilepath(filepath, source.value);
  // const extAst = getAst(getSrc(extFilepath));
  // console.log('resolveExternalImport', extVariable, extFilepath, getSrc(extFilepath));
  // return resolveIdentifierNameToExternalValue(extVariable, extAst, extFilepath);
}

function resolveIdentifierNameToExternalValue(variable, ast, filepath) {
  // console.log('resolveIdentifierNameToExternalValue', variable, filepath);
  var result = false;

  types.visit(ast, {
    visitImportSpecifier: function(path) {
      if (path.value.local.name === variable) {
        const extVariable = path.value.imported.name;
        // // console.log('visitImportSpecifier', path);
        // n.ImportDeclaration.assert(path.parentPath.parentPath.node);
        // const source = path.parentPath.parentPath.node.source;
        // n.Literal.assert(source);
        // const extFilepath = resolveExternalFilepath(filepath, source.value);
        // const extAst = getAst(getSrc(extFilepath));
        // result = resolveIdentifierNameToExternalValue(extVariable, extAst, extFilepath);

        // result = resolveExternalImport(extVariable, path, filepath);
        const importDeclarationPath = resolveToValue(path).parentPath;
        // console.log('visitImportSpecifier resolveToValue(path)', resolveToValue(path));
        // console.log('visitImportSpecifier importDeclarationPath', importDeclarationPath);
        result = resolveExternalImport(extVariable, importDeclarationPath, filepath);
        return false;
      }
      this.traverse(path);
    },
    // import * as ...
    visitImportNamespaceSpecifier: function(path) {
      // console.log('visitImportNamespaceSpecifier', variable, path);
      if (path.value.local.name === variable) {
        console.log('2 visitImportNamespaceSpecifier', variable, path.parentPath.parentPath);
        const importDeclarationPath = path.parentPath.parentPath;
        n.ImportDeclaration.assert(importDeclarationPath.node);
        const importSourceLiteralPath = importDeclarationPath.get('source');
        n.Literal.assert(importSourceLiteralPath.node);

        result = resolveExternalNamespaceImport(importDeclarationPath, filepath);
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
      // console.log('visitImportDefaultSpecifier', variable, path);
      if (path.value.local.name === variable) {
        console.log('visitImportDefaultSpecifier', variable, path);
        // this is duplicated logic below variableName
        const extVariable = 'default';
        // console.log('visitImportDefaultSpecifier', path);
        // n.ImportDeclaration.assert(path.parentPath.parentPath.node);
        // const source = path.parentPath.parentPath.node.source;
        // n.Literal.assert(source);
        // const extFilepath = resolveExternalFilepath(filepath, source.value);
        // const extAst = getAst(getSrc(extFilepath));
        // // console.log('sdfasdf', getSrc(extFilepath))
        // result = resolveIdentifierNameToExternalValue(extVariable, extAst, extFilepath);

        // result = resolveExternalImport(extVariable, path, filepath);
        const importDeclarationPath = resolveToValue(path).parentPath;
        // console.log('visitImportDefaultSpecifier resolveToValue(path)', resolveToValue(path));
        // console.log('visitImportDefaultSpecifier importDeclarationPath', importDeclarationPath);
        result = resolveExternalImport(extVariable, importDeclarationPath, filepath);
        return false;
      }
      this.traverse(path);
    },
    visitIdentifier(path) {
      if (path.value.name === variable && variable === 'VALUES') {
        // console.log('VALUES VISIT IDENTIFIER', variable, '\n\npath:', path.parentPath);
      }
      if (path.value.name === variable) {
        console.log('VISIT IDENTIFIER', variable, '\n\npath:', path);

        // // handle import * as variable from './foo';
        // if (n.ImportNamespaceSpecifier.check(path.parentPath.node)) {
        //   const importNamespaceSpecifierPath = path.parentPath;
        //   console.log('I AM IDENTIFIER FOR NAMESPACE', path.parentPath);
        //   const importDeclarationPath = importNamespaceSpecifierPath.parentPath.parentPath;
        //   n.ImportDeclaration.assert(importDeclarationPath.node);
        //   const importSourceLiteralPath = importDeclarationPath.get('source');
        //   n.Literal.assert(importSourceLiteralPath.node);

        //   const imported = resolveExternalNamespaceImport(importDeclarationPath, filepath);
        //   console.log('imported', imported);
        //   return false;
        // }

        // see if this identifier is created in a
        // `const { variable } = targetVariable;`
        const variableDeclaratorPath = getDestructuredVariableDeclarator(path);
        if (!variableDeclaratorPath) {
          // return false;
          this.traverse(path);
          return;
        }

        const targetVariable = variableDeclaratorPath.node.init.name;
        if (targetVariable === variable) {
          // variable is right side, i.e.
          // `const { foo, bar } = variable;`
          this.traverse(path);
          return;
        }
        console.log('I GOT A VARIABLE DECLARATOR', variable, variableDeclaratorPath);

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

        console.log('extKeyNames', targetVariable, extKeyNames);

        // ok, resolve the target variable from the declarator through any import,
        // and then do a loop while popping off and drilling down into the members of the
        // resolved values

        // const importDeclarationPath = resolveToValue(path).parentPath;
        // // console.log('visitImportSpecifier resolveToValue(path)', resolveToValue(path));
        // // console.log('visitImportSpecifier importDeclarationPath', importDeclarationPath);
        // result = resolveExternalImport(extVariable, importDeclarationPath, filepath);

        let targetPath = resolveIdentifierNameToExternalValue(targetVariable, ast, filepath);

        console.log('TARGET PATH FOUND', variable, targetPath);
        // and go from here
        // while (n.objectExpression.check(targetPath.node)) {
          
        // }

        return false;
        const valuePath = resolveToValue(path);
        console.log('VISIT IDENTIFIER', variable, '\n\npath:', path);
        console.log('2 VISIT IDENTIFIER', variable, '\n\nvaluePath:', valuePath);

        switch(valuePath.node.type) {
          case n.ImportDeclaration.name: {
            // console.log('ImportDeclaration path', path);
            console.log('UNHANDLED ImportDeclaration', valuePath);
            // return false;
            break;
          }
          case n.MemberExpression.name: {
            // console.log('MemberExpression', valuePath.node.property.name, valuePath.node.object.name, getMembers(valuePath));
            // .property.name is variable name in external module
            const extTargetVariable = valuePath.node.property.name;
            // .object.name is locally assigned variable being destructured
            const extVariable = valuePath.node.object.name;
            const importDeclarationValuePath = resolveToValue(valuePath.get('object')).parentPath;
            console.log('importDeclarationValuePath', variable, resolveToValue(valuePath));
            result = resolveExternalImport(extTargetVariable, importDeclarationValuePath, filepath);
            console.log('extTargetVariable result:', variable, { extVariable, extTargetVariable }, result);
            break;
          }
          case n.ArrayExpression.name: {
            console.log('ArrayExpression');
            break;
          }
          // case n.ImportDeclaration.name: {
          //   console.log('ImportDeclaration', path);
          //   this.traverse(path);
          //   break;
          // }
          default: {
            console.log('UNHANDLED identifier resolved type', valuePath.node.type);
            this.traverse(path);
            break;
          }
        }

        return false;
      }

      this.traverse(path);
    },
    visitVariableDeclarator: function(path) {
      if (variable === 'ENUM') {
        console.log('VISIT VARIABLEDECLARATOR', variable, path);
      }
      // console.log('VISIT VARIABLEDECLARATOR', path);
      if (path.value.id.name === variable) {
        // console.log('VISIT VARIABLEDECLARATOR', variable, resolveToValue(path));
        console.log('2 VISIT VARIABLEDECLARATOR', variable, path.value.init, '\n\npath:', path);
        const valuePath = resolveToValue(path);
        console.log('3 VISIT VARIABLEDECLARATOR', variable, '\n\nvaluePath:', valuePath);
        result = createExternalNodePath(valuePath, { ast, filepath });

        // result = path.value.init;
        return false;
      }
      this.traverse(path);
    },
    // visitObjectPattern(path) {
    //   if ()
    //   console.log('VISIT VARIABLEDECLARATOR', variable, resolveToValue(path));
    // },
    visitExportDefaultDeclaration: function(path) {
      if (variable === 'default') {
        // console.log('ExportDefaultDeclaration', path.node.declaration);
        if (n.Identifier.check(path.node.declaration)) {
          // console.log('Identifier ExportDefaultDeclaration', path.node.declaration.name);
          result = resolveIdentifierNameToExternalValue(path.node.declaration.name, ast, filepath);
          return false;
        }
        console.log('ExportDefaultDeclaration', path.node.declaration, resolveToValue(path));
        throw new Error('i do not think i have ever hit this');
        result = resolveToValue(path); // propbs need to createExternalNodePath
        // result = path.node.declaration;
        return false;
      }
      this.traverse(path);
    },
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
// TEMP export assignment
module.exports.resolveToExternalValue = resolveToExternalValue;
