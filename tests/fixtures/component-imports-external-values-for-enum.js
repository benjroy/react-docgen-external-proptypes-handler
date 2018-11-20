import React from 'react';
import PropTypes from 'prop-types';

import * as VALUES from './external-values';
// import ENUM from './external-values';

const { default: ENUM, STRING, NUMBER, BOOL } = VALUES;
// const { STRING, NUMBER, BOOL } = VALUES;


const ComponentImportsExternalValuesForEnum = props => (<div>component-literal</div>);

ComponentImportsExternalValuesForEnum.propTypes = {
  enum: PropTypes.oneOf([STRING, NUMBER, BOOL]),
  enumList: PropTypes.oneOf(ENUM),
};
ComponentImportsExternalValuesForEnum.defaultProps = {

};

export default ComponentImportsExternalValuesForEnum;
