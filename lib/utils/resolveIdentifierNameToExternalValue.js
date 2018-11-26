const fs = require('fs');
const docgen = require('react-docgen');
const resolveExportDeclaration = require('react-docgen/dist/utils/resolveExportDeclaration').default
const recast = require('recast');
const types = require('recast').types;
const babylon = require('react-docgen/dist/babylon').default;
const resolveExternalFilepath = require('./resolveExternalFilepath');
const getDestructuredVariableDeclarator = require('./getDestructuredVariableDeclarator');


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


function recastExternalFilepath(externalFilepath, baseFilepath) {
  const filepath = resolveExternalFilepath(baseFilepath, externalFilepath);
  const src = fs.readFileSync(filepath, 'utf-8');
  const ast = recast.parse(src, { source: 'module', esprima: babylon });

  return { ast, filepath };
}

function resolveNamespaceExternal(externalFilepath, baseFilepath) {

  // const external = resolveExternalImportDeclarationPath(importDeclarationPath, filepath);
  const external = recastExternalFilepath(externalFilepath, baseFilepath);

  console.log('resolveExternalNamespace', external.filepath);

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
          // TODO: can this be cleaned?
          if (n.MemberExpression.check(leftPath.parentPath.node)) {
            const key = leftPath.parentPath.get('property').node.name;
            keys.push(key);
          }
          valuePath = path.get('right');
          break;
        }
        // recurse
        leftPath = leftPath.get('object');
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
      path.get('specifiers').each(specifierPath => {
        const identifierPath = specifierPath.node.id
          ? specifierPath.get('id')
          : specifierPath.get('local');

        addNamespaceExport(identifierPath.node.name, identifierPath);
      });

      const declaration = path.get('declaration');

      if (declaration.value) {
        declaration.get('declarations').each(declaration => {
          addNamespaceExport(getNameOrValue(declaration.get('id')), declaration.get('init'));
        });
      }

      this.traverse(path);
    },
  });

  const namespaceObjectExpression = (keyValuePaths) =>
    b.objectExpression(
      keyValuePaths.map(([key, valuePath]) =>
        b.objectProperty(b.stringLiteral(key), valuePath.node)
      )
    );

  if (defaultModuleExports && n.ObjectExpression.check(defaultModuleExports.node)) {
    // TODO: there is an ordering bug here.
    // TODO: make sure that the order of definitions
    // TODO: default/named order is right
    defaultModuleExports.get('properties').each(
      propertyPath => addNamespaceExport(propertyPath.get('key').node.name, propertyPath.get('value'))
    );
    addNamespaceExport('default', { node: namespaceObjectExpression(namespace) });
  }

  // inject the namespace valuepaths
  external.ast.program.body.push(
    b.variableDeclaration('const', [
      b.variableDeclarator(
        b.identifier(__EXPORTS__),
        namespaceObjectExpression(namespace)
      )
    ])
  );

  return resolveIdentifierNameToExternalValue(__EXPORTS__, external);

}

function resolveExternalImportDeclarationPath(importDeclarationPath, baseFilepath) {
  n.ImportDeclaration.assert(importDeclarationPath.node);
  const source = importDeclarationPath.node.source;
  n.Literal.assert(source);

  return recastExternalFilepath(source.value, baseFilepath);
  // const filepath = resolveExternalFilepath(baseFilepath, source.value);
  // const src = fs.readFileSync(filepath, 'utf-8');
  // const ast = recast.parse(src, { source: 'module', esprima: babylon });

  // return { ast, filepath };
}

const __EXPORTS__ = '__EXPORTS__';
// function resolveExternalNamespaceImport(importDeclarationPath, filepath) {
function resolveExternalNamespaceImport(importDeclarationPath, baseFilepath) {
  n.ImportDeclaration.assert(importDeclarationPath.node);
  const source = importDeclarationPath.node.source;
  n.Literal.assert(source);
  return resolveNamespaceExternal(source.value, baseFilepath);
}

function resolveExternalImport(variable, importDeclarationPath, filepath) {
  const external = resolveExternalNamespaceImport(importDeclarationPath, filepath);

  const matched = external.path.get('properties').filter(
    propertyPath => variable === propertyPath.get('key').node.value
  );

  const valuePath = matched[0].get('value');

  if (n.Identifier.check(valuePath.node)) {
    return resolveIdentifierNameToExternalValue(valuePath.node.name, external);
  }
  return { ...external, path: valuePath };
}


function resolveIdentifierNameToExternalValue(variable, { ast, filepath }) {
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

        console.log('visitImportNamespaceSpecifier', resolveToModule(importDeclarationPath));
        // return this.traverse(path);
        result = resolveExternalNamespaceImport(importDeclarationPath, filepath);
        console.log(`resolved: ${variable} to: ${result.path.node.type}`);
        return false;
      }
      this.traverse(path);
    },
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
        console.log('variableDeclaratorPath', variableDeclaratorPath.node);

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

        console.log('extKeyNames', variable, extKeyNames);

        const initPath = variableDeclaratorPath.get('init');

        if (n.CallExpression.check(initPath.node)) {
          const calleePath = initPath.get('callee');
          if (
            n.Identifier.check(calleePath.node)
            && 'require' === getNameOrValue(calleePath)
          ) {

            const externalFilepath = resolveToModule(variableDeclaratorPath);
            const external = resolveNamespaceExternal(externalFilepath, filepath);
            console.log('2extKeyNames', extKeyNames);
            console.log('code? ', variable, recast.print(external.path.node).code);
            // throw 'here here'

            console.log('external', variable, extKeyNames, external);
            // then drill down through the object to the target member value path
            extKeyNames.forEach((key) => {
              const propPath = external.path.get('properties').filter(
                propertyPath => key === propertyPath.get('key').node.value
              );
              external.path = propPath[0].get('value');
            });

            // result = { ...external, path: valuePath };
            result = external;
            return false;
          }
        }

        // ensure variable is not right side
        // i.e. `const { foo, bar } = variable;`
        const targetVariable = variableDeclaratorPath.node.init.name;
        console.log('targetVariable', extKeyNames, targetVariable, variableDeclaratorPath.node.init);
        if (targetVariable === variable) return this.traverse(path);

        // console.log('I GOT A VARIABLE DECLARATOR', variable);

        // resolve the target variable from the declarator through any import
        const external = resolveIdentifierNameToExternalValue(targetVariable, { ast, filepath });
        console.log('2 external', variable, extKeyNames, external);
        // then drill down through the object to the target member value path
        extKeyNames.forEach((key) => {
          const propPath = external.path.get('properties').filter(
            propertyPath => key === propertyPath.get('key').node.value
          );
          external.path = propPath[0].get('value');
        });

        // result = { ...external, path: valuePath };
        result = external;
        return false;
      }

      this.traverse(path);
    },
    visitVariableDeclarator: function(path) {
      if (path.value.id.name === variable) {
        const valuePath = resolveToValue(path);
        console.log('maybe', variable, path)

        if (!n.ImportDeclaration.check(valuePath.node)) {
          console.log('found NOT ImportDeclaration', variable, valuePath);
          result = { path: valuePath, filepath, ast };
          return false;
        }
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
    //       result = resolveIdentifierNameToExternalValue(path.node.declaration.name, { ast, filepath });
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
