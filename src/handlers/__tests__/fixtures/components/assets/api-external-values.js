import PropTypes from 'prop-types';
// import ENUM from './external-values';
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
   * Comment for api-external-values-enumList.
   */
  'api-external-values-shape-with-enum': PropTypes.shape({
    enum: PropTypes.oneOf([STRING, NUMBER, BOOL]),
    bool: PropTypes.bool.isRequired,
  }).isRequired,
  /**
   * Comment for api-external-values-arrayOf-enum.
   */
  'api-external-values-arrayOf-enum': PropTypes.arrayOf(
    PropTypes.oneOf([STRING, NUMBER, BOOL]),
  ).isRequired,
  /**
   * Comment for api-external-values-oneOfType-with-enum-and-shape.
   */
  'api-external-values-oneOfType-with-enum-and-shape': PropTypes.oneOfType([
    PropTypes.oneOf([STRING, NUMBER, BOOL]),
    PropTypes.shape({
      enum1: PropTypes.oneOf([STRING, NUMBER, BOOL]),
      number1: PropTypes.number.isRequired,
    }),
  ]).isRequired,
  /**
   * Comment for api-external-values-objectOf-enum.
   */
  'api-external-values-objectOf-enum': PropTypes.objectOf(
    PropTypes.oneOf([STRING, NUMBER, BOOL]),
  ).isRequired,
  /**
   * api-external-values-objectOf-shape-with-enum.
   */
  'api-external-values-objectOf-shape-with-enum': PropTypes.objectOf(
    PropTypes.shape({
      enum2: PropTypes.oneOf([STRING, NUMBER, BOOL]),
      number2: PropTypes.number.isRequired,
    }),
  ).isRequired,
  /**
   * Comment for api-external-values-arrayOf-enum.
   */
  'api-external-values-arrayOf-shape-with-enum': PropTypes.arrayOf(
    PropTypes.shape({
      enum3: PropTypes.oneOf([STRING, NUMBER, BOOL]),
      number3: PropTypes.number.isRequired,
    }),
  ).isRequired,
  /**
   * Comment for api-external-values-notAnEnum.
   */
  'api-external-values-notAnEnum': PropTypes.node.isRequired,
};
