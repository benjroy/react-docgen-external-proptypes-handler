import React from 'react';
import PropTypes from 'prop-types';
import { propTypes as propTypesApi3, defaultProps as defaultPropsApi3 } from './assets/api-3';

const ComponentSpreadsNested = props => (<div>component-spreads-nested</div>);

ComponentSpreadsNested.propTypes = {
  ...propTypesApi3,
  'local-number': PropTypes.number,
};
ComponentSpreadsNested.defaultProps = {
  ...defaultPropsApi3,
  'local-number': 4242,
};

export default ComponentSpreadsNested;
