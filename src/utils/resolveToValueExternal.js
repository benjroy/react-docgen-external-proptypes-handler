const fs = require('fs');
const docgen = require('react-docgen');
const resolveExportDeclaration = require('react-docgen/dist/utils/resolveExportDeclaration').default
import resolveNamespaceExternal, { resolveExternalNamespaceImport, resolveExternalImport } from './resolveImportedNamespace';
import { Array as toArrayExternal } from './expressionTo';
import { traverseShallow } from 'react-docgen/dist/utils/traverse';
// TODO: replicate this in repo
// const traverseShallow = require('react-docgen/dist/utils/traverse').traverseShallow;
const recast = require('recast');
const types = require('recast').types;
const babylon = require('react-docgen/dist/babylon').default;
// const resolveExternalFilepath = require('./resolveExternalFilepath');
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
export default function resolveToValueExternal(path, { filepath }) {
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
