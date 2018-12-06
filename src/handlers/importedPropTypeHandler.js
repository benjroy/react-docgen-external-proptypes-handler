const recast = require('recast');
const docgen = require('react-docgen');
const setPropDescription = require('react-docgen/dist/utils/setPropDescription')
  .default;
const isRequiredPropType = require('react-docgen/dist/utils/isRequiredPropType')
  .default;
import resolveToValueExternal from '../utils/resolveToValueExternal';
import isPropTypesExpression from '../utils/isPropTypesExpression';

const {
  getPropType,
  getPropertyName,
  getMemberValuePath,
  getNameOrValue,
} = docgen.utils;

const {
  types: { namedTypes: types },
} = recast;

function amendPropTypes(path, filepath, options) {
  switch (path.node.type) {
    case types.Property.name: {
      const resolved = resolveToValueExternal(path.get('value'), { filepath });
      amendPropTypes(resolved.path, resolved.filepath, options);

      if (
        isPropTypesExpression(resolved.path) &&
        // avoid hoisting `shape` props up to top-level in docs
        !types.CallExpression.check(path.parentPath.parentPath.parentPath.node)
      ) {
        const { documentation, getDescriptor } = options;
        const propName = getPropertyName(path);
        const propDescriptor = getDescriptor(propName);
        const type = getPropType(resolved.path);

        if (type) {
          propDescriptor.type = type;
          propDescriptor.required =
            type.name !== 'custom' && isRequiredPropType(resolved.path);
        }

        setPropDescription(documentation, path);
      }
      break;
    }
    case types.Identifier.name: {
      const resolved = resolveToValueExternal(path, { filepath });
      amendPropTypes(resolved.path, resolved.filepath, options);
      path.replace(resolved.path.value);
      break;
    }
    case types.SpreadProperty.name: {
      amendPropTypes(path.get('argument'), filepath, options);
      break;
    }
    case types.ObjectExpression.name: {
      path.get('properties').each(propertyPath => {
        amendPropTypes(propertyPath, filepath, options);
      });
      break;
    }
    case types.ArrayExpression.name: {
      path.get('elements').each(elPath => {
        amendPropTypes(elPath, filepath, options);
      });
      break;
    }
    case types.CallExpression.name: {
      path.get('arguments').each(argPath => {
        amendPropTypes(argPath, filepath, options);
      });
      break;
    }
    case types.MemberExpression.name: {
      if (isPropTypesExpression(path)) {
        [path.get('object'), path.get('property')].forEach(targetPath => {
          if (!types.Identifier.check(targetPath.node)) {
            // recurse into .oneOf([ ... ]), .shape({ ... })
            // and other PropTypes CallExpressions
            amendPropTypes(targetPath, filepath, options);
          }
        });
      } else if (!types.CallExpression.check(path.node.object)) {
        const resolved = resolveToValueExternal(path.get('object'), { filepath }); // eslint-disable-line prettier/prettier

        if (
          types.CallExpression.check(resolved.path.node) ||
          types.MemberExpression.check(resolved.path.node) ||
          // TODO: make resolveToValueExternal able to read
          // `export default myClassName { ... }`
          types.Identifier.check(resolved.path.node)
        ) {
          break;
        }

        amendPropTypes(
          getMemberValuePath(
            resolved.path,
            getNameOrValue(path.get('property')),
          ),
          resolved.filepath,
          options,
        );
        break;
      }
      break;
    }
    default: {
      break;
    }
  }
}

function getImportedPropTypeHandler(propName) {
  return function getImportedPropTypeHandlerForFilePath(filepath) {
    // relative filepaths are resolved to current working directory
    if (!filepath.startsWith('/')) {
      filepath = require('path').resolve(process.cwd(), filepath);
    }

    return function importedPropTypeHandler(documentation, path) {
      let getDescriptor;
      switch (propName) {
        case 'childContextTypes':
          getDescriptor = documentation.getChildContextDescriptor;
          break;
        case 'contextTypes':
          getDescriptor = documentation.getContextDescriptor;
          break;
        default:
          getDescriptor = documentation.getPropDescriptor;
      }
      getDescriptor = getDescriptor.bind(documentation);

      const propTypesPath = getMemberValuePath(path, propName);
      if (!propTypesPath) {
        return;
      }

      amendPropTypes(propTypesPath, filepath, { documentation, getDescriptor });
    };
  };
}

export const importedPropTypeHandler = getImportedPropTypeHandler('propTypes');
export const importedContextTypeHandler = getImportedPropTypeHandler('contextTypes'); // eslint-disable-line prettier/prettier
export const importedChildContextTypeHandler = getImportedPropTypeHandler('childContextTypes'); // eslint-disable-line prettier/prettier
