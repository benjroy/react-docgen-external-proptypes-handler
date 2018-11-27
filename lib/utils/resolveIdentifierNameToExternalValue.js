const fs = require('fs');
const docgen = require('react-docgen');
const resolveExportDeclaration = require('react-docgen/dist/utils/resolveExportDeclaration').default
// TODO: replicate this in repo
const traverseShallow = require('react-docgen/dist/utils/traverse').traverseShallow;
const recast = require('recast');
const types = require('recast').types;
const babylon = require('react-docgen/dist/babylon').default;
const resolveExternalFilepath = require('./resolveExternalFilepath');
const isPropTypesExpression = require('./isPropTypesExpression');
const getDestructuredVariableDeclarator = require('./getDestructuredVariableDeclarator');

//temp
const _getDestructuredVariableDeclarator = getDestructuredVariableDeclarator._getDestructuredVariableDeclarator

// const n = types.namedTypes;
const {
  namedTypes: n,
  builders: b,
  NodePath,
} = types;

console.log('NodePath', NodePath);

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

  // const namespaceObjectExpression = (keyValuePaths) =>
  //   b.objectExpression(
  //     keyValuePaths.map(([key, valuePath]) =>
  //       b.objectProperty(b.stringLiteral(key), valuePath.node)
  //     )
  //   );
  const namespaceObjectExpression = (keyValuePaths) =>
    b.objectExpression(
      keyValuePaths.map(([key, valuePath]) =>
        b.objectProperty(b.identifier(key), valuePath.node)
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
    // propertyPath => variable === propertyPath.get('key').node.value
    propertyPath => variable === getNameOrValue(propertyPath.get('key'))
  );
  // console.log('matched', matched);
  const valuePath = matched[0].get('value');

  if (n.Identifier.check(valuePath.node)) {
    return resolveIdentifierNameToExternalValue(valuePath.node.name, external);
  }
  return { ...external, path: valuePath };
}


// modified version of react-docgen/dist/utils/expressionTo.js's toArray 
/**
 * Creates a string representation of a member expression.
 */
function toStringExternal(path, { ast, filepath }) {
  return toArray(path, { ast, filepath }).join('.');
}

// modified version of react-docgen/dist/utils/expressionTo.js's toArray 
/**
 * Splits a MemberExpression or CallExpression into parts.
 * E.g. foo.bar.baz becomes ['foo', 'bar', 'baz']
 */
function toArrayExternal(path, { ast, filepath }) {
  const parts = [path];
  let result = [];

  while (parts.length > 0) {
    path = parts.shift();
    const node = path.node;
    if (n.CallExpression.check(node)) {
      parts.push(path.get('callee'));
      continue;
    } else if (n.MemberExpression.check(node)) {
      parts.push(path.get('object'));
      if (node.computed) {
        // const resolvedPath = resolveToValue(path.get('property'));
        // const resolvedPath = resolveToValueExternal(path.get('property'), { ast, filepath });
        // if (resolvedPath !== undefined) {
        //   // result = result.concat(toArray(resolvedPath));
        //   result = result.concat(toArrayExternal(resolvedPath, { ast, filepath }));
        const resolved = resolveToValueExternal(path.get('property'), { ast, filepath });
        if (resolved && resolved.path !== undefined) {
          // result = result.concat(toArray(resolvedPath));
          // result = result.concat(toArrayExternal(resolvedPath, { ast, filepath }));
          result = result.concat(toArrayExternal(resolved.path, resolved));
        } else {
          result.push('<computed>');
        }
      } else {
        result.push(node.property.name);
      }
      continue;
    } else if (n.Identifier.check(node)) {
      result.push(node.name);
      continue;
    } else if (n.Literal.check(node)) {
      result.push(node.raw);
      continue;
    } else if (n.ThisExpression.check(node)) {
      result.push('this');
      continue;
    } else if (n.ObjectExpression.check(node)) {
      const properties = path.get('properties').map(function(property) {
        return (
          // toString(property.get('key')) + ': ' + toString(property.get('value'))
          toStringExternal(property.get('key'), { ast, filepath }) + ': ' + toStringExternal(property.get('value'), { ast, filepath })
        );
      });
      result.push('{' + properties.join(', ') + '}');
      continue;
    } else if (n.ArrayExpression.check(node)) {
      result.push(
        '[' +
          path
            .get('elements')
            .map(toString)
            .join(', ') +
          ']',
      );
      continue;
    }
  }

  return result.reverse();
}


// internal from docgen.utils.resolveToValue
function buildMemberExpressionFromPattern(path) {
  const node = path.node;
  if (n.Property.check(node)) {
    const objPath = buildMemberExpressionFromPattern(path.parent);
    if (objPath) {
      return new NodePath(
        b.memberExpression(
          objPath.node,
          node.key,
          n.Literal.check(node.key),
        ),
        objPath,
      );
    }
  } else if (n.ObjectPattern.check(node)) {
    return buildMemberExpressionFromPattern(path.parent);
  } else if (n.VariableDeclarator.check(node)) {
    return path.get('init');
  }
  return null;
}

// paths: array of NodePath's
// path: NodePath
function findScopePathExternal(paths, path, { ast, filepath }) {
  if (paths.length < 1) {
    return null;
  }
  let resultPath = paths[0];
  const parentPath = resultPath.parent;

  if (
    // n.ImportDefaultSpecifier.check(parentPath.node) ||
    // n.ImportSpecifier.check(parentPath.node) ||
    // n.ImportNamespaceSpecifier.check(parentPath.node) ||
    n.VariableDeclarator.check(parentPath.node) ||
    n.TypeAlias.check(parentPath.node)
  ) {
    // console.log('paths', paths);
    // console.log('path', path);
    // console.log(`findScopePathExternal:
    //   n.VariableDeclarator.check(parentPath.node) ||
    //   n.TypeAlias.check(parentPath.node)
    // `, parentPath.node);
    resultPath = parentPath;
  } else if (n.ImportDefaultSpecifier.check(parentPath.node)) {
    const importDeclarationPath = resolveToValue(path).parentPath;
    const resolved = resolveExternalImport('default', importDeclarationPath, filepath);
    return resolveToValueExternal(resolved.path, resolved);

  } else if (n.ImportSpecifier.check(parentPath.node)) {
    // console.log('importSpecifier parentPath', parentPath);
    // console.log('importSpecifier', path);
    const variable = parentPath.value.imported.name;
    const importDeclarationPath = resolveToValue(path).parentPath;
    const resolved = resolveExternalImport(variable, importDeclarationPath, filepath);
    return resolveToValueExternal(resolved.path, resolved);

  } else if (n.ImportNamespaceSpecifier.check(parentPath.node)) {
    // const importDeclarationPath = path.parentPath.parentPath;
    const importDeclarationPath = resolveToValue(path).parentPath;
    n.ImportDeclaration.assert(importDeclarationPath.node);
    const importSourceLiteralPath = importDeclarationPath.get('source');
    n.Literal.assert(importSourceLiteralPath.node);

    // console.log('findScopePathExternal parent ImportNamespaceSpecifier', resolveToModule(importDeclarationPath));
    const resolved = resolveExternalNamespaceImport(importDeclarationPath, filepath);
    return resolveToValueExternal(resolved.path, resolved);

  } else if (n.Property.check(parentPath.node)) {
    // must be inside a pattern
    const memberExpressionPath = buildMemberExpressionFromPattern(parentPath);
    if (memberExpressionPath) {
      // return memberExpressionPath;
      return { path: memberExpressionPath, ast, filepath };
    }
  }

  if (resultPath.node !== path.node) {
    return resolveToValueExternal(resultPath, { ast, filepath });
  }

  return null;
}

/**
 * Tries to find the last value assigned to `name` in the scope created by
 * `scope`. We are not descending into any statements (blocks).
 */
function findLastAssignedValueExternal(scope, name, { ast, filepath }) {
  const results = [];

  traverseShallow(scope.path.node, {
    visitAssignmentExpression: function(path) {
      const node = path.node;
      // Skip anything that is not an assignment to a variable with the
      // passed name.
      if (
        !n.Identifier.check(node.left) ||
        node.left.name !== name ||
        node.operator !== '='
      ) {
        return this.traverse(path);
      }
      results.push(path.get('right'));
      return false;
    },
  });

  if (results.length === 0) {
    return null;
  }
  return resolveToValueExternal(results.pop(), { ast, filepath });
}

/**
 * If the path is an identifier, it is resolved in the scope chain.
 * If it is an assignment expression, it resolves to the right hand side.
 * If it is a member expression it is resolved to it's initialization value.
 *
 * Else the path itself is returned.
 */
function resolveToValueExternal(path, { ast, filepath }) {
  console.log('resolveToExternalValue', path.node && path.node.type);
  if (path.path) {
    throw new Error('passed in full external, whoops');
  }
  // if (n.Identifier.check(path.node)) {
  //   throw 'identifier';
  // } else if (n.CallExpression.check(path.node)) {
  //   throw 'call expression';
  // } else if (n.MemberExpression.check(path.node)) {
  //   throw 'member expression';
  // } else {
  //   throw 'what is this?';
  // }

  const node = path.node;
  if (n.VariableDeclarator.check(node)) {
    console.log('VariableDeclarator')
    if (node.init) {
      console.log('if (node.init)');
      return resolveToValueExternal(path.get('init'), { ast, filepath });
    }
  } else if (n.CallExpression.check(node)) {
    console.log('CallExpression');
    if (
      node.callee
      && n.Identifier.check(node.callee)
      && 'require' === getNameOrValue(path.get('callee'))
    ) {
      console.log('require(...)')
      const externalFilepath = resolveToModule(path);
      console.log('externalFilepath', externalFilepath);
      const external = resolveNamespaceExternal(externalFilepath, filepath);
      console.log('external? ', external);
      // console.log('code? ', recast.print(external.path.node).code);

      return resolveToValueExternal(external.path, external);
      // throw 'call expression';

    }
    // console.log('!require(...)');
  } else if (n.MemberExpression.check(node)) {
    // console.log('MemberExpression');
    if (isPropTypesExpression(path)) {
      return { path, ast, filepath };
    }
    const resolved = resolveToValueExternal(getMemberExpressionRoot(path), { ast, filepath });
    // console.log('resolved MemberExpression', resolved);
    if (n.ObjectExpression.check(resolved.path.node)) {
      // console.log('ObjectExpression resolved.path')
      let propertyPath = resolved.path;
      // for (const propertyName of toArray(path).slice(1)) {
      for (const propertyName of toArrayExternal(path, { ast, filepath }).slice(1)) {
        // console.log('for (const propertyName of toArray(path).slice(1))');
        if (propertyPath && n.ObjectExpression.check(propertyPath.node)) {
          // console.log('(propertyPath && n.ObjectExpression.check(propertyPath.node))', propertyName, propertyPath)
          propertyPath = getPropertyValuePath(propertyPath, propertyName);
        }
        if (!propertyPath) {
          // console.log('if (!propertyPath) early return input path');
          return { path, ast, filepath };
          // return { path, ast, filepath };
          // return path;
        }
        // propertyPath = resolveToValueExternal(propertyPath, resolved);
        // console.log('returning resolved property path');
        propertyPath = resolveToValueExternal(propertyPath, resolved);
      }
      // console.log('return propertyPath');
      return propertyPath;
    }
  // } else if (
  //   n.ImportDefaultSpecifier.check(node) ||
  //   n.ImportNamespaceSpecifier.check(node) ||
  //   n.ImportSpecifier.check(node)
  // ) {
  //     console.log(`
  //       n.ImportDefaultSpecifier.check(node) ||
  //       n.ImportNamespaceSpecifier.check(node) ||
  //       n.ImportSpecifier.check(node)
  //     `, path)
  //   // go up two levels as first level is only the array of specifiers
  //   const importDeclarationPath = path.parentPath.parentPath;
  //   // return path.parentPath.parentPath;
  //   const resolved = resolveExternalImportDeclarationPath(importDeclarationPath, filepath);
  //   return resolveToValueExternal(resolved.path, resolved);
  } else if (n.AssignmentExpression.check(node)) {
    // console.log('AssignmentExpression');
    if (node.operator === '=') {
      // console.log('if (node.operator === \'=\')');
      return resolveToValueExternal(path.get('right'), { ast, filepath });
    }
    // console.log('else (node.operator !== \'=\')');
  } else if (n.TypeCastExpression.check(node)) {
    // console.log('TypeCastExpression');
    return resolveToValueExternal(path.get('expression'), { ast, filepath });
  } else if (n.Identifier.check(node)) {
    // console.log('Identifier');
    if (
      (n.ClassDeclaration.check(path.parentPath.node) ||
        n.ClassExpression.check(path.parentPath.node) ||
        n.Function.check(path.parentPath.node)) &&
      path.parentPath.get('id') === path
    ) {
      // console.log('Identifier early return');
      return path.parentPath;
    }

    let scope = path.scope.lookup(node.name);
    let resolved; //: ?NodePath;
    // let resolvedPath; //: ?NodePath;
    if (scope) {
      // console.log('if (scope)');
      // The variable may be assigned a different value after initialization.
      // We are first trying to find all assignments to the variable in the
      // block where it is defined (i.e. we are not traversing into statements)
      resolved = findLastAssignedValueExternal(scope, node.name, { ast, filepath });
      // resolvedPath = findLastAssignedValueExternal(scope, node.name, { ast, filepath });
      if (!resolved) {
      // if (!resolvedPath) {
        // console.log('if (!resolvedPath)');
        const bindings = scope.getBindings()[node.name];
        resolved = findScopePathExternal(bindings, path, { ast, filepath });
        // console.log('if (!resolvedPath) end resolved');
        // resolvedPath = findScopePathExternal(bindings, path, { ast, filepath });
      }
      // console.log('else (resolvedPath) breaks. to end');
    } else {
      // console.log('else (!scope)');
      scope = path.scope.lookupType(node.name);
      if (scope) {
        // console.log('else (!scope) if (scope)');
        const typesInScope = scope.getTypes()[node.name];
        resolved = findScopePathExternal(typesInScope, path, { ast, filepath });
        // resolvedPath = findScopePathExternal(typesInScope, path, { ast, filepath });
      }
    }
    // console.log('return resolvedPath || path;');
    // return resolvedPath || path;
    if (resolved) {
      // console.log('return resolvedPath', resolved);
      return resolveToValueExternal(resolved.path, resolved);
      // return resolved;
    }
    // return { path, ast, filepath, ...resolved };
  }
  // console.log('final return', path.node.type);
  // return path;
  return { path, ast, filepath };
}

module.exports.resolveToValueExternal = resolveToValueExternal;

// function resolveToValueExternal(path, { ast, filepath }) {
//   if (n.Identifier.check(path.node)) {
//     throw 'identifier';
//   } else if (n.CallExpression.check(path.node)) {
//     throw 'call expression';
//   } else if (n.MemberExpression.check(path.node)) {
//     throw 'member expression';
//   } else {
//     throw 'what is this?';
//   }

// }

function resolveIdentifierNameToExternalValue(variable, { ast, filepath }) {
  console.log('resolveIdentifierNameToExternalValue', variable, filepath);
  var result = false;

  // console.log(recast.print(ast).code)

  // types.visit(ast, {
  //   visitProperty(path) {
  //     console.log('visitObjectProperty', path);
  //     if (n.Identifier)
  //     if (variable === path.node.value.node.name) {
  //       const valuePath = path.get('value');
  //       n.Identifier.assert(valuePath.node);

  //       console.log('visitObjectProperty, found Identifier value', path.node);

  //     }
  //   },
  // });


  types.visit(ast, {
/*
    visitImportSpecifier: function(path) {
      if (path.value.local.name === variable) {
        console.log('visitImportSpecifier', variable, path);
        const extVariable = path.value.imported.name;
        const importDeclarationPath = resolveToValue(path).parentPath;

        // result = resolveExternalImport(extVariable, importDeclarationPath, filepath);
        const resolved = resolveExternalImport(extVariable, importDeclarationPath, filepath);
        console.log('visitImportSpecifier resolved');
        result = resolved;
        // result = resolveToValueExternal(resolved.path, resolved);
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

        console.log('visitImportNamespaceSpecifier', variable, resolveToModule(importDeclarationPath));
        // return this.traverse(path);
        result = resolveExternalNamespaceImport(importDeclarationPath, filepath);
        console.log(`resolved: ${variable} to: ${result.path.node.type}`);
        return false;
      }
      this.traverse(path);
    },
    visitImportDefaultSpecifier: function(path) {
      if (path.value.local.name === variable) {
        console.log('visitImportDefaultSpecifier', variable, path);
        const extVariable = 'default';
        const importDeclarationPath = resolveToValue(path).parentPath;
        result = resolveExternalImport(extVariable, importDeclarationPath, filepath);
        return false;
      }
      this.traverse(path);
    },
*/
/*
    visitProperty(path) {
      // console.log('visitProperty', path);
      if (variable === path.node.value.name) {
        const destructured = _getDestructuredVariableDeclarator(path.get('value'));
        const { path: variableDeclaratorPath, keys } = destructured;
        console.log('_getDestructuredVariableDeclarator', keys);

        const targetPath = variableDeclaratorPath.get('init');

        console.log('targetPath', targetPath);

        const resolved = resolveToValueExternal(targetPath, { ast, filepath });

        console.log('resolved', resolved);

        /// while keys.length .....

        // throw 'hihi';

        const valuePath = path.get('value');
        n.Identifier.assert(valuePath.node);

        console.log('visitProperty, found Identifier value in val path', variable, path);

        if (n.ObjectPattern.check(path.parentPath.node)) {
          console.log('VALUE visitProperty, parent ObjectPattern', variable, path.parentPath.node);
          result = resolveIdentifierNameToExternalValue(getNameOrValue(path.get('key')), { ast, filepath });
          return false;
        } else {
          console.log('VALUE visitProperty, parent other', variable, pathpath.parentPath.node.type);          
        }

        throw 'found it value';
        // result = resolveIdentifierNameToExternalValue()
      // } else if (variable === path.node.key.name) {
      //   n.Identifier.assert(path.node.key);

      //   console.log('KEY visitProperty, found Identifier value in path', variable, path);

      //   if (n.ObjectPattern.check(path.parentPath.parentPath.node)) {
      //     const parentProperty = path.parentPath.parentPath.node.properties.find(
      //       node => {
      //         return node === path.node
      //         // return variable === node.key.name
      //       }
      //     );

      //     console.log('FOUND PARENT KEY', variable, parentProperty);
      //     throw 'got it?'

      //     // console.log('KEY visitProperty, parent ObjectPattern', path.parentPath.node);
      //     // const parentPropertyPath = path.parentPath;

      //     console.log('3', variable, path.parentPath.parentPath.parentPath)

      //     console.log('KEY visitProperty, parent ObjectPattern', variable, parentPropertyPath.node.properties);
      //     result = resolveIdentifierNameToExternalValue(getNameOrValue(parentPropertyPath.get('key')), { ast, filepath });
      //     return false;
      //   } else {
      //     console.log('KEY visitProperty, parent other', variable, pathpath.parentPath.node.type);          
      //   }

      //   throw 'found it key';
      }
      this.traverse(path);
    },
*/
    visitIdentifier(path) {
      if (variable === path.node.name) {
        console.log('VisitIdentifier traverse', path.node.name);
        result = resolveToValueExternal(path, { ast, filepath });
        return false;
      }
      this.traverse(path);
    },

    // visitIdentifier(path) {
    //   if (path.value.name === variable) {

    //     let variableDeclaratorPath = path.parentPath;

    //     console.log('visitIdentifier', variable, variableDeclaratorPath);
    //     // console.log('visitIdentifier', variable, n.VariableDeclaration.check(variableDeclaratorPath.node));

    //     if (n.VariableDeclarator.check(variableDeclaratorPath.node)) {


    //       // const idPath = variableDeclaratorPath.get('id');
    //       const initPath = variableDeclaratorPath.get('init');
    //       // console.log('idPath', variable, idPath);
    //       // console.log('initPath', variable, initPath);

    //       if (n.CallExpression.check(initPath.node)) {
    //         return this.traverse(path);

    //         throw 'I hit it';
    //       }

    //       // console.log('???', idPath.node === path.node, initPath.node === path.node)

    //       // if (idPath.node === path.node) {
    //       //   console.log('identifier is id, left side', variable);
    //       //   throw 'left';
    //       // } else if (initPath.node === path.node) {
    //       //   console.log('identifier is init, right side', variable);
    //       //   console.log('returning to traverse', variable);
    //       //   // throw 'right';
    //       //   this.traverse(path); // early return
    //       //   return;
    //       // } else {
    //       //   throw 'neither';
    //       // }
    //     }

    //     // ensure this identifier is created in a
    //     // `const { variable } = targetVariable;`
    //     variableDeclaratorPath = getDestructuredVariableDeclarator(path);
    //     if (!variableDeclaratorPath) return this.traverse(path);
    //     console.log('variableDeclaratorPath', variable, variableDeclaratorPath.node);

    //     // get path inside target object
    //     // TODO: react-docgen has a util for this I'll bet
    //     let p = path;
    //     const extKeyNames = [];
    //     let keyPath;
    //     while (n.Property.check(p.parentPath.node)) {
    //       keyPath = p.parentPath.get('key');
    //       n.Identifier.assert(keyPath.node);
    //       extKeyNames.push(keyPath.node.name);
    //       p = p.parentPath.parentPath;
    //     }

    //     // ensure variable is not right side
    //     // i.e. `const { foo, bar } = variable;`
    //     const targetVariable = variableDeclaratorPath.node.init.name;
    //     console.log('targetVariable', extKeyNames, targetVariable, variableDeclaratorPath.node.init);
    //     if (targetVariable === variable) return this.traverse(path);



    //     console.log('extKeyNames', variable, extKeyNames);

    //     // const _initPath = variableDeclaratorPath.get('init');

    //     // if (n.CallExpression.check(_initPath.node)) {
    //     //   // const _external = this.visitVariableDeclarator.call(this, variableDeclaratorPath, { ast, filepath });
    //     //   console.log('resolving?', variable, extKeyNames);
    //     //   // return this.traverse(path);
    //     //   // throw 'did it work?'
    //     //   // return;
    //     //   const calleePath = _initPath.get('callee');
    //     //   if (
    //     //     n.Identifier.check(calleePath.node)
    //     //     && 'require' === getNameOrValue(calleePath)
    //     //   ) {

    //     //     const externalFilepath = resolveToModule(variableDeclaratorPath);
    //     //     const external = resolveNamespaceExternal(externalFilepath, filepath);
    //     //     console.log('2extKeyNames', extKeyNames);
    //     //     console.log('code? ', variable, recast.print(external.path.node).code);
    //     //     // throw 'here here'

    //     //     console.log('external', variable, extKeyNames, external);
    //     //     // then drill down through the object to the target member value path
    //     //     extKeyNames.forEach((key) => {
    //     //       const propPath = external.path.get('properties').filter(
    //     //         propertyPath => key === propertyPath.get('key').node.value
    //     //       );
    //     //       external.path = propPath[0].get('value');
    //     //     });

    //     //     // result = { ...external, path: valuePath };
    //     //     result = external;
    //     //     return false;
    //     //   }
    //     // }


    //     // // ensure variable is not right side
    //     // // i.e. `const { foo, bar } = variable;`
    //     // const targetVariable = variableDeclaratorPath.node.init.name;
    //     // console.log('targetVariable', extKeyNames, targetVariable, variableDeclaratorPath.node.init);
    //     // if (targetVariable === variable) return this.traverse(path);

    //     // console.log('I GOT A VARIABLE DECLARATOR', variable);

    //     // resolve the target variable from the declarator through any import
    //     const external = resolveIdentifierNameToExternalValue(targetVariable, { ast, filepath });
    //     console.log('2 external', variable, targetVariable, extKeyNames, external);
    //     // then drill down through the object to the target member value path
    //     extKeyNames.forEach((key) => {
    //       const propPath = external.path.get('properties').filter(
    //         propertyPath => key === propertyPath.get('key').node.value
    //       );
    //       external.path = propPath[0].get('value');
    //     });

    //     // result = { ...external, path: valuePath };
    //     result = external;
    //     return false;
    //   }

    //   this.traverse(path);
    // },
    visitVariableDeclarator(path) {
      if (path.value.id.name === variable) {
        // result = resolveVariableDeclaratorToValueExternal(path, { ast, filepath });
        // return false;

        console.log('VariableDeclarator traverse', variable);
        const valuePath = resolveToValueExternal(path, { ast, filepath });
        // console.log('VariableDeclarator maybe', variable, path)

        // result = { path: valuePath, filepath, ast };
        result = valuePath; // this is { path, ast, filepath }
        return false;

        if (!n.ImportDeclaration.check(valuePath.node)) {
          // console.log('found NOT ImportDeclaration', variable, valuePath);


          const idPath = path.get('id');
          const initPath = path.get('init');
          // console.log('VariableDeclarator idPath', variable, idPath);
          // console.log('VariableDeclarator initPath', variable, initPath);

          // console.log('???', idPath.node === path.node, initPath.node === path.node)

          if (n.Identifier.check(idPath.node)) {
            if (variable === getNameOrValue(idPath)) {
              console.log('IDPATH VAR MATCH', variable, getNameOrValue(idPath));
              // throw 'IDPATH VAR MATCH'
              if (n.CallExpression.check(initPath.node)) {
                const calleePath = initPath.get('callee');
                if ('require' === getNameOrValue(calleePath)) {
                  const externalFilepath = resolveToModule(path);
                  const external = resolveNamespaceExternal(externalFilepath, filepath);
                  console.log('VariableDeclarator external', variable, external);
                  // console.log('VariableDeclarator code? ', variable, recast.print(external.path.node).code);
                  // throw 'here here'


                  // result = { ...external, path: valuePath };
                  result = external;
                  return false;

                }
                throw 'Callexpression initPath';
              }
              if (n.MemberExpression.check(initPath.node)) {
                throw 'MemberExpression initPath';
              }

              // if (n.ObjectExpression.check(initPath.node)) {
              //   result = { path: initPath, filepath, ast }
              //   return false;
              // }

              // throw new Error('Unknown initPath type: ' + initPath.node.type);
            }
          }


/*
        if (n.CallExpression.check(_initPath.node)) {
          const calleePath = _initPath.get('callee');
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
*/
          // if (idPath.node === path.node) {
          //   console.log('VariableDeclarator identifier is id, left side', variable);
          //   throw 'VariableDeclarator left';
          // } else if (initPath.node === path.node) {
          //   console.log('VariableDeclarator identifier is init, right side', variable);
          //   console.log('VariableDeclarator returning to traverse', variable);
          //   throw 'VariableDeclarator right';
          //   this.traverse(path); // early return
          //   return;
          // } else {
          //   throw 'VariableDeclarator neither';
          // }



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
