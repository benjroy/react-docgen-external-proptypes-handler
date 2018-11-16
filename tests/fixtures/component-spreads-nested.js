import React from 'react';
import PropTypes from 'prop-types';
import { propTypes as propTypesApi3, defaultProps as propTypesApi3 } from './api-3';

const ComponentSpreadsNested = props => (<div>component-spreads-nested</div>);

ComponentSpreadsNested.propTypes = {
  ...propTypes,
  'local-number': PropTypes.number,
};
ComponentSpreadsNested.defaultProps = {
  ...defaultProps,
  'local-number': 4242,
};

export default ComponentSpreadsNested;
