import React from 'react';
import PropTypes from 'prop-types';

import * as VALUES from './external-values';
// import ENUM from './external-values';

const { default: ENUM, STRING, NUMBER, BOOL } = VALUES;
// const { STRING, NUMBER, BOOL } = VALUES;


const ComponentImportsExternalValuesForEnum = props => (<div>component-literal</div>);

ComponentImportsExternalValuesForEnum.propTypes = {
  /**
   * Comment for enum.
   */
  enum: PropTypes.oneOf([STRING, NUMBER, BOOL]),
  /**
   * Comment for enumList.
   */
  enumList: PropTypes.oneOf(ENUM),
  /**
   * Comment for notAnEnum.
   */
  notAnEnum: PropTypes.node.isRequired,
};
ComponentImportsExternalValuesForEnum.defaultProps = {

};

export default ComponentImportsExternalValuesForEnum;
