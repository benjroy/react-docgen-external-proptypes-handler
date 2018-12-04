import React from 'react';
import PropTypes from 'prop-types';

import { propTypes as propTypesApiExternalValues, FUNCTION } from './assets/api-external-values';
// import * as VALUES from './external-values';
// // import ENUM from './external-values';

// const { default: ENUM, STRING, NUMBER, BOOL } = VALUES;
// const { STRING, NUMBER, BOOL } = VALUES;


const ComponentImportsExternalValuesForEnum = props => (<div>component-literal</div>);

// ComponentImportsExternalValuesForEnum.propTypes = propTypesApiExternalValues;
ComponentImportsExternalValuesForEnum.propTypes = { ...propTypesApiExternalValues };

ComponentImportsExternalValuesForEnum.defaultProps = {

};

// TODO: make another test for this case
Component.FUNCTION = FUNCTION;

export default ComponentImportsExternalValuesForEnum;
