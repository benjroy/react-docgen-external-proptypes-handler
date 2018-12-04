import { utils } from 'react-docgen';
import recast from 'recast';
import { Array as toArrayExternal } from './expressionTo';
import { traverseShallow } from 'react-docgen/dist/utils/traverse';
import resolveNamespaceExternal, { resolveExternalNamespaceImport, resolveExternalImport } from './resolveImportedNamespace';
import isPropTypesExpression from './isPropTypesExpression';

const {
  types: { builders, namedTypes: types, NodePath },
} = recast;

const {
  resolveToModule,
  resolveToValue,
  getNameOrValue,
  getMemberExpressionRoot,
  getPropertyValuePath,
} = utils;


// internal from docgen.utils.resolveToValue
function buildMemberExpressionFromPattern(path) {
  const node = path.node;
  if (types.Property.check(node)) {
    const objPath = buildMemberExpressionFromPattern(path.parent);
    if (objPath) {
      return new NodePath(
        builders.memberExpression(
          objPath.node,
          node.key,
          types.Literal.check(node.key),
        ),
        objPath,
      );
    }
  } else if (types.ObjectPattern.check(node)) {
    return buildMemberExpressionFromPattern(path.parent);
  } else if (types.VariableDeclarator.check(node)) {
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
    types.VariableDeclarator.check(parentPath.node) ||
    types.TypeAlias.check(parentPath.node)
  ) {
    resultPath = parentPath;
  } else if (types.ImportDefaultSpecifier.check(parentPath.node)) {
    const importDeclarationPath = resolveToValue(path).parentPath;

    const resolved = resolveExternalImport('default', importDeclarationPath, filepath);
    return resolveToValueExternal(resolved.path, resolved);

  } else if (types.ImportSpecifier.check(parentPath.node)) {
    const variable = parentPath.value.imported.name;
    const importDeclarationPath = resolveToValue(path).parentPath;

    const resolved = resolveExternalImport(variable, importDeclarationPath, filepath);
    return resolveToValueExternal(resolved.path, resolved);

  } else if (types.ImportNamespaceSpecifier.check(parentPath.node)) {
    const importDeclarationPath = resolveToValue(path).parentPath;
    types.ImportDeclaration.assert(importDeclarationPath.node);
    const importSourceLiteralPath = importDeclarationPath.get('source');
    types.Literal.assert(importSourceLiteralPath.node);

    const resolved = resolveExternalNamespaceImport(importDeclarationPath, filepath);
    return resolveToValueExternal(resolved.path, resolved);

  } else if (types.Property.check(parentPath.node)) {
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
        !types.Identifier.check(node.left) ||
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
  if (types.VariableDeclarator.check(node)) {
    if (node.init) {
      return resolveToValueExternal(path.get('init'), { filepath });
    }
  } else if (types.CallExpression.check(node)) {
    if (
      node.callee
      && types.Identifier.check(node.callee)
      && 'require' === getNameOrValue(path.get('callee'))
    ) {
      const external = resolveNamespaceExternal(resolveToModule(path), filepath);
      return resolveToValueExternal(external.path, external);
    }
  } else if (types.MemberExpression.check(node)) {
    if (isPropTypesExpression(path)) {
      return { path, filepath };
    }
    const resolved = resolveToValueExternal(getMemberExpressionRoot(path), { filepath });
    if (types.ObjectExpression.check(resolved.path.node)) {
      let propertyPath = resolved.path;
      for (const propertyName of toArrayExternal(path, { filepath }).slice(1)) {
        if (propertyPath && types.ObjectExpression.check(propertyPath.node)) {
          propertyPath = getPropertyValuePath(propertyPath, propertyName);
        }
        if (!propertyPath) {
          return { path, filepath };
        }
        return resolveToValueExternal(propertyPath, resolved);
      }
      return { ...resolved, path: propertyPath };
    }
  } else if (types.AssignmentExpression.check(node)) {
    if (node.operator === '=') {
      return resolveToValueExternal(path.get('right'), { filepath });
    }
  } else if (types.TypeCastExpression.check(node)) {
    return resolveToValueExternal(path.get('expression'), { filepath });
  } else if (types.Identifier.check(node)) {
    if (
      (types.ClassDeclaration.check(path.parentPath.node) ||
        types.ClassExpression.check(path.parentPath.node) ||
        types.Function.check(path.parentPath.node)) &&
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
