import React from 'react';
import PropTypes from 'prop-types';
import { propTypes as propTypesApi, defaultProps as defaultPropsApi } from './assets/api-cjs-named-exports';

const ComponentImportsCjsNamedExports = props => (<div />);

ComponentImportsCjsNamedExports.propTypes = {
  ...propTypesApi,
};
ComponentImportsCjsNamedExports.defaultProps = {
  ...defaultPropsApi,
};

export default ComponentImportsCjsNamedExports;
