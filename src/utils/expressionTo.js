/*
 * tweaked version of react-docgen/dist/utils/expressionTo.js module
 */
/*eslint no-loop-func: 0, no-use-before-define: 0*/
import resolveToValueExternal from './resolveToValueExternal';
import recast from 'recast';
const {
  types: { namedTypes: types },
} = recast;
// modified version of react-docgen/dist/utils/expressionTo.js's toArray
/**
 * Splits a MemberExpression or CallExpression into parts.
 * E.g. foo.bar.baz becomes ['foo', 'bar', 'baz']
 */
function toArrayExternal(path, { filepath }) {
  const parts = [path];
  let result = [];

  while (parts.length > 0) {
    path = parts.shift();
    const node = path.node;
    if (types.CallExpression.check(node)) {
      parts.push(path.get('callee'));
      continue;
    } else if (types.MemberExpression.check(node)) {
      parts.push(path.get('object'));
      if (node.computed) {
        const resolved = resolveToValueExternal(path.get('property'), { filepath }); // eslint-disable-line prettier/prettier
        if (resolved && resolved.path !== undefined) {
          result = result.concat(toArrayExternal(resolved.path, resolved));
        } else {
          result.push('<computed>');
        }
      } else {
        result.push(node.property.name);
      }
      continue;
    } else if (types.Identifier.check(node)) {
      result.push(node.name);
      continue;
    } else if (types.Literal.check(node)) {
      result.push(node.raw);
      continue;
    } else if (types.ThisExpression.check(node)) {
      result.push('this');
      continue;
    } else if (types.ObjectExpression.check(node)) {
      const properties = path.get('properties').map(function(property) {
        return (
          toStringExternal(property.get('key'), { filepath }) + ': ' + toStringExternal(property.get('value'), { filepath }) // eslint-disable-line prettier/prettier
        );
      });
      result.push('{' + properties.join(', ') + '}');
      continue;
    } else if (types.ArrayExpression.check(node)) {
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
// modified version of react-docgen/dist/utils/expressionTo.js's toString
/**
 * Creates a string representation of a member expression.
 */
function toStringExternal(path, { filepath }) {
  return toArrayExternal(path, { filepath }).join('.');
}
export { toStringExternal as String, toArrayExternal as Array };
