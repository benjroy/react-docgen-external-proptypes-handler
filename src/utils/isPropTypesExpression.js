import { utils } from 'react-docgen';
const { resolveToModule, isReactModuleName } = utils;

export default function isPropTypesExpression(path) {
  const moduleName = resolveToModule(path);
  if (moduleName) {
    return isReactModuleName(moduleName) || moduleName === 'ReactPropTypes';
  }
  return false;
}
