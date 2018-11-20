import React from 'react';
import PropTypes from 'prop-types';
import { propTypes as propTypesApi, defaultProps as defaultPropsApi } from './api-1';

const ComponentImportsLiteral = props => (<div>component-literal</div>);

ComponentImportsLiteral.propTypes = propTypesApi;
ComponentImportsLiteral.defaultProps = defaultPropsApi;

export default ComponentImportsLiteral;
