const PropTypes = require('prop-types');

const propTypes = {
  /**
   * Comment for cjs-api-named-exports-node-required.
   */
  'cjs-api-named-exports-node-required': PropTypes.node.isRequired,
  /**
   * Comment for cjs-api-named-exports-string.
   */
  'cjs-api-named-exports-string': PropTypes.string,
};

const defaultProps = {
  'cjs-api-named-exports-string': 'cjs-api-named-exports-string-value',
};

module.exports.propTypes = propTypes;
module.exports.defaultProps = defaultProps;
