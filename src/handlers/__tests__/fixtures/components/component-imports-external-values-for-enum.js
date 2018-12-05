import React from 'react';
import PropTypes from 'prop-types';
import { propTypes as propTypesApiExternalValues } from './assets/api-external-values';


const ComponentImportsExternalValuesForEnum = props => (<div>component-literal</div>);

ComponentImportsExternalValuesForEnum.propTypes = { ...propTypesApiExternalValues };

ComponentImportsExternalValuesForEnum.defaultProps = {};

export default ComponentImportsExternalValuesForEnum;
