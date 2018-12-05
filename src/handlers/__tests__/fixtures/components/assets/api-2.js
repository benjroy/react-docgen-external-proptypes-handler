import PropTypes from 'prop-types';

export const propTypes = {
  /**
   * Comment for api-2-node-required.
   */
  'api-2-node-required': PropTypes.node.isRequired,
  /**
   * Comment for api-2-string.
   */
  'api-2-string': PropTypes.string,
};

export const defaultProps = {
  'api-2-string': 'api-2-string-value',
};
