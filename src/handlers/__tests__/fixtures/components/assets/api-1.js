import PropTypes from 'prop-types';

export const propTypes = {
  /**
   * Comment for api-1-node-required.
   */
  'api-1-node-required': PropTypes.node.isRequired,
  /**
   * Comment for api-1-bool.
   */
  'api-1-bool': PropTypes.bool,
};

export const defaultProps = {
  'api-1-bool': false,
};
