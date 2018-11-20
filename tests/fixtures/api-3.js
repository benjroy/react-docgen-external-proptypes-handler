import PropTypes from 'prop-types';
import { propTypes as propTypesApi1, defaultProps as defaultPropsApi1 } from './api-1';
import { propTypes as propTypesApi2, defaultProps as defaultPropsApi2 } from './api-2';

// export const propTypes = propTypesApi2;
// export const propTypes = {
  
// };
export const propTypes = {
  ...propTypesApi1,
  ...propTypesApi2,
  /**
   * Comment for api-3-node-required.
   */
  'api-3-node-required': PropTypes.node.isRequired,
  /**
   * Comment for api-3-number.
   */
  'api-3-number': PropTypes.number,
};

export const defaultProps = {
  'api-3-number': 42,
};
