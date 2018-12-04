import fs from 'fs';
import { utils } from 'react-docgen';
import resolveExternalFilepath from './resolveExternalFilepath';
import resolveToValueExternal from './resolveToValueExternal';
import { traverseShallow } from 'react-docgen/dist/utils/traverse';
import babylon from 'react-docgen/dist/babylon';
import recast from 'recast';
const {
  types: { builders, namedTypes: types },
} = recast;
const { getNameOrValue, isExportsOrModuleAssignment, getMembers } = utils;

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
        !types.Identifier.check(node.declaration) &&
        types.Identifier.check(node.declaration.id)
      ) {
        path.insertBefore(node.declaration);
        path.get('declaration').replace(node.declaration.id);
      }
      return false;
    },
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

export default function resolveNamespaceExternal(
  externalFilepath,
  baseFilepath,
) {
  const __EXPORTS__ = '__EXPORTS__';

  const external = recastExternalFilepath(externalFilepath, baseFilepath);

  const namespace = [];

  let defaultModuleExports;

  const addNamespaceExport = (key, valuePath) => {
    namespace.push([key, valuePath]);
  };

  // TODO: use traverseShallow
  recast.types.visit(external.ast, {
    visitExpressionStatement(path) {
      if (isExportsOrModuleAssignment(path)) {
        const expressionPath = path.get('expression');
        const valuePath = expressionPath.get('right');
        const keys = getMembers(expressionPath.get('left')).reduce(
          (memo, { path: memberPath }) => {
            if (memberPath.node.name !== 'exports') {
              memo.push(memberPath.node.name);
            }
            return memo;
          },
          [],
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

      this.traverse(path);
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
        declaration.get('declarations').each(declarationPath => {
          addNamespaceExport(
            getNameOrValue(declarationPath.get('id')),
            declarationPath.get('init'),
          );
        });
      }

      this.traverse(path);
    },
  });

  const namespaceObjectExpression = keyValuePaths =>
    builders.objectExpression(
      keyValuePaths.map(([key, valuePath]) =>
        builders.objectProperty(builders.identifier(key), valuePath.node),
      ),
    );

  if (
    defaultModuleExports &&
    types.ObjectExpression.check(defaultModuleExports.node)
  ) {
    // TODO: there is an ordering bug here.
    // TODO: make sure that the order of definitions
    // TODO: default/named order is right
    defaultModuleExports
      .get('properties')
      .each(propertyPath =>
        addNamespaceExport(
          propertyPath.get('key').node.name,
          propertyPath.get('value'),
        ),
      );
    addNamespaceExport('default', {
      node: namespaceObjectExpression(namespace),
    });
  }

  // inject the namespace valuepaths
  external.ast.program.body.push(
    builders.variableDeclaration('const', [
      builders.variableDeclarator(
        builders.identifier(__EXPORTS__),
        namespaceObjectExpression(namespace),
      ),
    ]),
  );

  // find the injected value and return it.
  return resolveIdentifierNameToExternalValue(
    __EXPORTS__,
    external.ast,
    external.filepath,
  );
}

export function resolveExternalNamespaceImport(
  importDeclarationPath,
  baseFilepath,
) {
  types.ImportDeclaration.assert(importDeclarationPath.node);
  const source = importDeclarationPath.node.source;
  types.Literal.assert(source);
  return resolveNamespaceExternal(source.value, baseFilepath);
}

export function resolveExternalImport(
  variable,
  importDeclarationPath,
  filepath,
) {
  const external = resolveExternalNamespaceImport(
    importDeclarationPath,
    filepath,
  );

  const matched = external.path
    .get('properties')
    .filter(
      propertyPath => variable === getNameOrValue(propertyPath.get('key')),
    );
  const valuePath = matched[0].get('value');

  if (types.Identifier.check(valuePath.node)) {
    return resolveToValueExternal(valuePath, external);
  }
  return { ...external, path: valuePath };
}

function resolveIdentifierNameToExternalValue(name, ast, filepath) {
  let result = false;
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
