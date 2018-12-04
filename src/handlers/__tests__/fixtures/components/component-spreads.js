import React from 'react';
import PropTypes from 'prop-types';
import { propTypes, defaultProps } from './assets/api-1';
import { propTypes as propTypesApi2, defaultProps as defaultPropsApi2 } from './assets/api-2';

const ComponentSpreads = props => (<div>component-spreads</div>);

ComponentSpreads.propTypes = {
  ...propTypes,
  ...propTypesApi2,
  'local-string': PropTypes.string,
};
ComponentSpreads.defaultProps = {
  ...defaultProps,
  ...defaultPropsApi2,
  'local-string': 'default-local-string',
};

export default ComponentSpreads;
