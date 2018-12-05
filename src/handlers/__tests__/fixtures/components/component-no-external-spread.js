import React from 'react';
import PropTypes from 'prop-types';
import * as VALUES from './assets/external-values';

const { default: ENUM, ZERO, ONE, TWO, THREE } = VALUES;

const ComponentNoExternalSpread = props => (<div>component-spreads</div>);

const localPropTypesSpread = {
  /**
   * Comment for local-bool-spread.
   */
  'local-bool-spread': PropTypes.bool.isRequired,
};

const localDefaultPropsSpread = {
  'local-bool-spread': true,
};

ComponentNoExternalSpread.propTypes = {
  /**
   * Comment for local-string.
   */
  'local-string': PropTypes.string,
  /**
   * Comment for local-node.
   */
  'local-node': PropTypes.node.isRequired,
  /**
   * Comment for local-number.
   */
  'local-number': PropTypes.number,
  /**
   * Comment for local-enum.
   */
  'local-enum': PropTypes.oneOf([9, 'eight', 7]),
  'local-enum-external-values': PropTypes.oneOf([ZERO, ONE, TWO, THREE]),
  'local-enum-external-list': PropTypes.oneOf(ENUM),
  ...localPropTypesSpread,
};
ComponentNoExternalSpread.defaultProps = {
  'local-string': 'default-local-string',
  'local-enum': 3,
  // the spread of the default props is not picked up by react-docgen default handlers
  ...localDefaultPropsSpread, 
};

export default ComponentNoExternalSpread;
