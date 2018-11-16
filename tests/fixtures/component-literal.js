import React from 'react';
import { propTypes as propTypesApi, defaultProps as defaultPropsApi } from './api-1';

const ComponentLiteral = props => (<div>component-literal</div>);

ComponentLiteral.propTypes = propTypesApi;
ComponentLiteral.defaultProps = defaultPropsApi;

export default ComponentLiteral;
