const docgen = require('react-docgen');
const types = require('recast').types;
const resolveExternalFilepath = require('../utils/resolveExternalFilepath');
const getSrc = require('../utils/getSrc');
const getAst = require('../utils/getAst');

const n = types.namedTypes;

const {
  // getPropType,
  // getPropertyName,
  // getMemberValuePath,
  // isReactModuleName,
  // printValue,
  // resolveToModule,
  resolveToValue,
  // // appended
  // getNameOrValue,
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


function resolveIdentifierNameToExternalValue(variable, ast, filepath) {
  // console.log('resolveIdentifierNameToExternalValue', variable, filepath);
  var result = false;

  types.visit(ast, {
    visitImportSpecifier: function(path) {
      if (path.value.local.name === variable) {
        const extVariable = path.value.imported.name;
        // console.log('visitImportSpecifier', path);
        n.ImportDeclaration.assert(path.parentPath.parentPath.node);
        const source = path.parentPath.parentPath.node.source;
        n.Literal.assert(source);
        const extFilepath = resolveExternalFilepath(filepath, source.value);
        const extAst = getAst(getSrc(extFilepath));
        result = resolveIdentifierNameToExternalValue(extVariable, extAst, extFilepath);
        // const resolved = resolveIdentifierNameToExternalValue(extVariable, extAst, extFilepath);
        return false;
      }
      this.traverse(path);
    },
    // import * as ...
    visitImportNamespaceSpecifier: function(path) {
      console.log('visitImportNamespaceSpecifier', path);
      this.traverse(path);
    },
    visitImportDefaultSpecifier: function(path) {
      // console.log('visitImportDefaultSpecifier', variable, path);
      if (path.value.local.name === variable) {
        // this is duplicated logic below variableName
        const extVariable = 'default';
        // console.log('visitImportDefaultSpecifier', path);
        n.ImportDeclaration.assert(path.parentPath.parentPath.node);
        const source = path.parentPath.parentPath.node.source;
        n.Literal.assert(source);
        const extFilepath = resolveExternalFilepath(filepath, source.value);
        const extAst = getAst(getSrc(extFilepath));
        console.log('sdfasdf', getSrc(extFilepath))
        result = resolveIdentifierNameToExternalValue(extVariable, extAst, extFilepath);
        // result = findExport('default', extAst, extFilepath);
        return false;
      }
      this.traverse(path);
    },
    visitVariableDeclarator: function(path) {
      if (variable === 'default') {
        console.log('VISIT VARIABLEDECLARATOR default', path);
      }
      // console.log('VISIT VARIABLEDECLARATOR', path);
      if (path.value.id.name === variable) {
        // console.log('VISIT VARIABLEDECLARATOR', variable, resolveToValue(path));
        // console.log('2 VISIT VARIABLEDECLARATOR', variable, path.value.init);
        result = resolveToValue(path)
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
        // console.log('ExportDefaultDeclaration', path.node.declaration, resolveToValue(path));

        result = resolveToValue(path);
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
