import PropTypes from 'prop-types';
import * as VALUES from './external-values';

const { default: ENUM, STRING, NUMBER, BOOL } = VALUES;


export const propTypes = {
  /**
   * Comment for api-external-values-enum.
   */
  'api-external-values-enum': PropTypes.oneOf([STRING, NUMBER, BOOL]),
  /**
   * Comment for api-external-values-enumList.
   */
  'api-external-values-enumList': PropTypes.oneOf(ENUM),
  /**
   * Comment for api-external-values-notAnEnum.
   */
  'api-external-values-notAnEnum': PropTypes.node.isRequired,
};
