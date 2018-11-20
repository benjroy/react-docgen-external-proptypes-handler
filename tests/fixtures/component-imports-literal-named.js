import React from 'react';
import { propTypes as propTypesApi, defaultProps as defaultPropsApi } from './api-1';

const ComponentImportsLiteralNamed = props => (<div>component-literal</div>);

ComponentImportsLiteralNamed.propTypes = propTypesApi;
ComponentImportsLiteralNamed.defaultProps = defaultPropsApi;

export default ComponentImportsLiteralNamed;
