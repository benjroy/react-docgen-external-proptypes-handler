const docgen = require('react-docgen');
const types = require('recast').types;
const resolveExternalFilepath = require('./resolveExternalFilepath');
const getSrc = require('./getSrc');
const getAst = require('./getAst');
const {
  createExternalNodePath,
  isExternalNodePath,
  getExternalNodePathProps,
} = require('./externalNodePath');


// const n = types.namedTypes;
const { namedTypes: n } = types;

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

function resolveExternalImport(extVariable, importDeclarationPath, filepath) {
  n.ImportDeclaration.assert(importDeclarationPath.node);
  const source = importDeclarationPath.node.source;
  n.Literal.assert(source);
  const extFilepath = resolveExternalFilepath(filepath, source.value);
  const extAst = getAst(getSrc(extFilepath));
  console.log('extFilepath', extFilepath);
  return resolveIdentifierNameToExternalValue(extVariable, extAst, extFilepath);
  // n.ImportDeclaration.assert(path.parentPath.parentPath.node);
  // const source = path.parentPath.parentPath.node.source;
  // n.Literal.assert(source);
  // const extFilepath = resolveExternalFilepath(filepath, source.value);
  // const extAst = getAst(getSrc(extFilepath));
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
      console.log('visitImportNamespaceSpecifier', variable, path);
      if (path.value.local.name === variable) {
        console.log('visitImportNamespaceSpecifier', variable, path);

      }
      this.traverse(path);
    },
    visitImportDefaultSpecifier: function(path) {
      // console.log('visitImportDefaultSpecifier', variable, path);
      if (path.value.local.name === variable) {
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
      if (path.value.name === variable && variable === 'ENUM') {
        // console.log('ENUM VISIT IDENTIFIER', variable, '\n\npath:', path);
      }
      if (path.value.name === variable) {
        const valuePath = resolveToValue(path);
        // console.log('VISIT IDENTIFIER', variable, '\n\nresolved:', valuePath);

        switch(valuePath.node.type) {
          case n.MemberExpression.name: {
            // console.log('MemberExpression', valuePath.node.property.name, valuePath.node.object.name, getMembers(valuePath));
            // .property.name is variable name in external module
            const extTargetVariable = valuePath.node.property.name;
            // .object.name is locally assigned variable being destructured
            const extVariable = valuePath.node.object.name;
            const importDeclarationValuePath = resolveToValue(valuePath.get('object')).parentPath;
            // console.log('importDeclarationValuePath', variable, importDeclarationValuePath);
            result = resolveExternalImport(extTargetVariable, importDeclarationValuePath, filepath);
            // console.log('extTargetVariable result:', variable, { extVariable, extTargetVariable }, result);
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
        // console.log('VISIT VARIABLEDECLARATOR', variable, path);
      }
      // console.log('VISIT VARIABLEDECLARATOR', path);
      if (path.value.id.name === variable) {
        // console.log('VISIT VARIABLEDECLARATOR', variable, resolveToValue(path));
        console.log('2 VISIT VARIABLEDECLARATOR', variable, path.value.init, '\n\npath:', path);
        const valuePath = resolveToValue(path);
        result = createExternalNodePath(valuePath, { ast, filepath });

        // result = path.value.init;
        return false;
      }
      this.traverse(path);
    },
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
