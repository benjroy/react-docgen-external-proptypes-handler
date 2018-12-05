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
  printValue,
  // appended
  getNameOrValue,
} = docgen.utils;

const {
  types: { namedTypes: types },
} = recast;


function amendPropTypes({ path, filepath }, options) {
  switch (path.node.type) {
    case types.Property.name: {
      const resolved = resolveToValueExternal(path.get('value'), { filepath });
      amendPropTypes(resolved, options);

      if (isPropTypesExpression(resolved.path)) {
        const { documentation, getDescriptor } = options;
        const propName = getPropertyName(path);
        const propDescriptor = getDescriptor(propName);
        const type = isPropTypesExpression(resolved.path)
          ? getPropType(resolved.path)
          : { name: 'custom', raw: printValue(resolved.path) };

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
      amendPropTypes(resolved, options);
      path.replace(resolved.path.value);
      break;
    }
    case types.SpreadProperty.name: {
      amendPropTypes({ path: path.get('argument'), filepath }, options);
      break;
    }
    case types.ObjectExpression.name: {
      path.get('properties').each(propertyPath => {
        amendPropTypes({ path: propertyPath, filepath }, options);
      });
      break;
    }
    case types.ArrayExpression.name: {
      path.get('elements').each(elPath => {
        amendPropTypes({ path: elPath, filepath }, options);
      });
      break;
    }
    case types.CallExpression.name: {
      path.get('arguments').each(argPath => {
        amendPropTypes({ path: argPath, filepath }, options);
      });
      break;
    }
    case types.MemberExpression.name: {
      if (isPropTypesExpression(path)) {
        [path.get('object'), path.get('property')].forEach(targetPath => {
          if (!types.Identifier.check(targetPath.node)) {
            // recurse into .oneOf([ ... ]), .shape({ ... })
            // and other PropTypes CallExpressions
            amendPropTypes({ path: targetPath, filepath }, options);
          }
        });
      } else if (!types.CallExpression.check(path.node.object)) {
        const resolved = resolveToValueExternal(path.get('object'), { filepath });

        if (
          types.CallExpression.check(resolved.path.node) ||
          types.MemberExpression.check(resolved.path.node) ||
          // TODO: make resolveToValueExternal able to read
          // `export default myClassName { ... }`
          types.Identifier.check(resolved.path.node)
        ) {
          break;
        }

        amendPropTypes({
          path: getMemberValuePath(resolved.path, getNameOrValue(path.get('property'))),
          filepath: resolved.filepath,
        }, options);
        break;
      }
      break;
    }
    default: {
      break;
    }
  }
}

function getExternalPropTypeHandler(propName) {
  return function getExternalPropTypeHandlerForFilePath(filepath) {
    // relative filepaths are resolved to current working directory
    if (!filepath.startsWith('/')) {
      filepath = require('path').resolve(process.cwd(), filepath);
    }

    return function externalPropTypeHandler(documentation, path) {
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

      amendPropTypes({ path: propTypesPath, filepath }, { documentation, getDescriptor });
    };
  };
}

export const externalPropTypeHandler = getExternalPropTypeHandler('propTypes');
export const externalContextTypeHandler = getExternalPropTypeHandler('contextTypes'); // eslint-disable-line prettier/prettier
export const externalChildContextTypeHandler = getExternalPropTypeHandler('childContextTypes'); // eslint-disable-line prettier/prettier
