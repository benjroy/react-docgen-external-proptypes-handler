import React from 'react';
import PropTypes from 'prop-types';
import ComponentIsIndex from './component-is-index';

const ComponentImportsComponentIsIndex = props => (<div />);

ComponentImportsComponentIsIndex.propTypes = {
  ...ComponentIsIndex.propTypes,
  'local-bool': PropTypes.bool,
};
ComponentImportsComponentIsIndex.defaultProps = {
  ...ComponentIsIndex.defaultProps,
  'local-bool': false,
};

export default ComponentImportsComponentIsIndex;
