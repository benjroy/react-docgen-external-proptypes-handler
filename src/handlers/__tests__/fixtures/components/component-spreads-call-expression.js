import React from 'react';
import PropTypes from 'prop-types';
import * as VALUES from './assets/external-values';
const { FUNCTION } = VALUES;

const ComponentSpreadsExternalMemberExpression = props => (<div />);

const external = {
  nested: {
    FUNCTION,
  },
};

ComponentSpreadsExternalMemberExpression.propTypes = {
  /**
   *  Description for localFunction
   */
  localFunction: PropTypes.func.isRequired,
  // should not follow this function...
  ...external.nested.FUNCTION(),
  ...external.nested.FUNCTION().foo,
};
ComponentSpreadsExternalMemberExpression.defaultProps = {};

export default ComponentSpreadsExternalMemberExpression;
