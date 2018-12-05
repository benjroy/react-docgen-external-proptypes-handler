import React from 'react';
import PropTypes from 'prop-types';
import { propTypes as propTypesApi3, defaultProps as defaultPropsApi3 } from '../assets/api-3';

const ComponentIsIndex = props => (<div />);

ComponentIsIndex.propTypes = {
  ...propTypesApi3,
  'local-string': PropTypes.string,
};
ComponentIsIndex.defaultProps = {
  ...defaultPropsApi3,
  'local-string': 'default-local-string',
};

export default ComponentIsIndex;
