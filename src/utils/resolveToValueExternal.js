const fs = require('fs');
const docgen = require('react-docgen');
const resolveExportDeclaration = require('react-docgen/dist/utils/resolveExportDeclaration').default
import { Array as toArrayExternal } from './expressionTo';
// TODO: replicate this in repo
const traverseShallow = require('react-docgen/dist/utils/traverse').traverseShallow;
const recast = require('recast');
const types = require('recast').types;
const babylon = require('react-docgen/dist/babylon').default;
const resolveExternalFilepath = require('./resolveExternalFilepath');
const isPropTypesExpression = require('./isPropTypesExpression');

const {
  namedTypes: n,
  builders: b,
  NodePath,
} = types;

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
  // more appended
  isReactComponentClass,
  isReactCreateClassCall,
  isReactComponentMethod,
  isStatelessComponent,

} = docgen.utils;


// converts:
//  `export default class foobar {}`
// or
//  `export defaut function foobar() {}`
// by putting the expression on it's own line
// and exporting default it's identifier
// i.e. 
//  class foobar {}
//  export default foobar;
function reassignExportDefaultExpression(ast) {
  traverseShallow(ast, {
    visitExportDefaultDeclaration(path) {
      const node = path.node;
      if (
        !n.Identifier.check(node.declaration) &&
        n.Identifier.check(node.declaration.id)
      ) {
        path.insertBefore(node.declaration);
        path.get('declaration').replace(node.declaration.id);
      }
      return false;
    }
  });
}

function recastExternalFilepath(externalFilepath, baseFilepath) {
  const filepath = resolveExternalFilepath(baseFilepath, externalFilepath);
  const src = fs.readFileSync(filepath, 'utf-8');
  const ast = recast.parse(src, { source: 'module', esprima: babylon });

  reassignExportDefaultExpression(ast);

  return {
    ast,
    filepath,
  };
}

function resolveNamespaceExternal(externalFilepath, baseFilepath) {
  const __EXPORTS__ = '__EXPORTS__';

  const external = recastExternalFilepath(externalFilepath, baseFilepath);

  const namespace = [];

  let defaultModuleExports;

  const addNamespaceExport = (key, valuePath) => {
    namespace.push([key, valuePath]);
  }

  types.visit(external.ast, {
    visitExpressionStatement(path) {
      if (isExportsOrModuleAssignment(path)) {
        const expressionPath = path.get('expression');
        const valuePath = expressionPath.get('right');
        const keys = getMembers(expressionPath.get('left')).reduce(
          (memo, { path, computed, argumentsPath }) => {
            if (path.node.name !== 'exports') {
              memo.push(path.node.name);
            }
            return memo;
          },
          []
        );
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

      this.traverse(path)
    },
    visitExportDefaultDeclaration(path) {
      addNamespaceExport('default', path.get('declaration'));
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

  // find the injected value and return it.
  return resolveIdentifierNameToExternalValue(__EXPORTS__, external.ast, external.filepath);
}

function resolveExternalNamespaceImport(importDeclarationPath, baseFilepath) {
  n.ImportDeclaration.assert(importDeclarationPath.node);
  const source = importDeclarationPath.node.source;
  n.Literal.assert(source);
  return resolveNamespaceExternal(source.value, baseFilepath);
}

function resolveExternalImport(variable, importDeclarationPath, filepath) {
  const external = resolveExternalNamespaceImport(importDeclarationPath, filepath);

  const matched = external.path.get('properties').filter(
    propertyPath => variable === getNameOrValue(propertyPath.get('key'))
  );
  const valuePath = matched[0].get('value');

  if (n.Identifier.check(valuePath.node)) {
    return resolveToValueExternal(valuePath, external);
  }
  return { ...external, path: valuePath };
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
function findScopePathExternal(paths, path, { filepath }) {
  if (paths.length < 1) {
    return null;
  }
  let resultPath = paths[0];
  const parentPath = resultPath.parent;

  if (
    n.VariableDeclarator.check(parentPath.node) ||
    n.TypeAlias.check(parentPath.node)
  ) {
    resultPath = parentPath;
  } else if (n.ImportDefaultSpecifier.check(parentPath.node)) {
    const importDeclarationPath = resolveToValue(path).parentPath;

    const resolved = resolveExternalImport('default', importDeclarationPath, filepath);
    return resolveToValueExternal(resolved.path, resolved);

  } else if (n.ImportSpecifier.check(parentPath.node)) {
    const variable = parentPath.value.imported.name;
    const importDeclarationPath = resolveToValue(path).parentPath;

    const resolved = resolveExternalImport(variable, importDeclarationPath, filepath);
    return resolveToValueExternal(resolved.path, resolved);

  } else if (n.ImportNamespaceSpecifier.check(parentPath.node)) {
    const importDeclarationPath = resolveToValue(path).parentPath;
    n.ImportDeclaration.assert(importDeclarationPath.node);
    const importSourceLiteralPath = importDeclarationPath.get('source');
    n.Literal.assert(importSourceLiteralPath.node);

    const resolved = resolveExternalNamespaceImport(importDeclarationPath, filepath);
    return resolveToValueExternal(resolved.path, resolved);

  } else if (n.Property.check(parentPath.node)) {
    // must be inside a pattern
    const memberExpressionPath = buildMemberExpressionFromPattern(parentPath);
    if (memberExpressionPath) {
      return { path: memberExpressionPath, filepath };
    }
  }

  if (resultPath.node !== path.node) {
    return resolveToValueExternal(resultPath, { filepath });
  }

  return null;
}

/**
 * Tries to find the last value assigned to `name` in the scope created by
 * `scope`. We are not descending into any statements (blocks).
 */
function findLastAssignedValueExternal(scope, name, { filepath }) {
  const results = [];

  traverseShallow(scope.path.node, {
    visitAssignmentExpression(path) {
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
  return resolveToValueExternal(results.pop(), { filepath });
}

/**
 * If the path is an identifier, it is resolved in the scope chain.
 * If it is an assignment expression, it resolves to the right hand side.
 * If it is a member expression it is resolved to it's initialization value.
 *
 * Else the path itself is returned.
 */
function resolveToValueExternal(path, { filepath }) {
  const node = path.node;
  if (n.VariableDeclarator.check(node)) {
    if (node.init) {
      return resolveToValueExternal(path.get('init'), { filepath });
    }
  } else if (n.CallExpression.check(node)) {
    if (
      node.callee
      && n.Identifier.check(node.callee)
      && 'require' === getNameOrValue(path.get('callee'))
    ) {
      const external = resolveNamespaceExternal(resolveToModule(path), filepath);
      return resolveToValueExternal(external.path, external);
    }
  } else if (n.MemberExpression.check(node)) {
    if (isPropTypesExpression(path)) {
      return { path, filepath };
    }
    const resolved = resolveToValueExternal(getMemberExpressionRoot(path), { filepath });
    if (n.ObjectExpression.check(resolved.path.node)) {
      let propertyPath = resolved.path;
      for (const propertyName of toArrayExternal(path, { filepath }).slice(1)) {
        if (propertyPath && n.ObjectExpression.check(propertyPath.node)) {
          propertyPath = getPropertyValuePath(propertyPath, propertyName);
        }
        if (!propertyPath) {
          return { path, filepath };
        }
        return resolveToValueExternal(propertyPath, resolved);
      }
      return { ...resolved, path: propertyPath };
    }
  } else if (n.AssignmentExpression.check(node)) {
    if (node.operator === '=') {
      return resolveToValueExternal(path.get('right'), { filepath });
    }
  } else if (n.TypeCastExpression.check(node)) {
    return resolveToValueExternal(path.get('expression'), { filepath });
  } else if (n.Identifier.check(node)) {
    if (
      (n.ClassDeclaration.check(path.parentPath.node) ||
        n.ClassExpression.check(path.parentPath.node) ||
        n.Function.check(path.parentPath.node)) &&
      path.parentPath.get('id') === path
    ) {
      return { path: path.parentPath, filepath };
    }

    let scope = path.scope.lookup(node.name);
    let resolved; //: ?NodePath;
    if (scope) {
      // The variable may be assigned a different value after initialization.
      // We are first trying to find all assignments to the variable in the
      // block where it is defined (i.e. we are not traversing into statements)
      resolved = findLastAssignedValueExternal(scope, node.name, { filepath });
      if (!resolved) {
        const bindings = scope.getBindings()[node.name];
        resolved = findScopePathExternal(bindings, path, { filepath });
      }
    } else {
      scope = path.scope.lookupType(node.name);
      if (scope) {
        const typesInScope = scope.getTypes()[node.name];
        resolved = findScopePathExternal(typesInScope, path, { filepath });
      }
    }
    if (resolved) {
      return resolveToValueExternal(resolved.path, resolved);
    }
  }
  return { path, filepath };
}



function resolveIdentifierNameToExternalValue(name, ast, filepath) {
  var result = false;
  traverseShallow(ast, {
    visitIdentifier(path) {
      if (path.node.name === name) {
        result = resolveToValueExternal(path, { filepath });
        return false;
      }
      this.traverse(path);
    },
    visitVariableDeclarator(path) {
      if (path.value.id.name === name) {
        result = resolveToValueExternal(path, { filepath });
        return false;
      }
      this.traverse(path);
    },
  });
  return result;
}


module.exports = resolveToValueExternal;