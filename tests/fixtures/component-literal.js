import React from 'react';
import PropTypes from 'prop-types';
import { propTypes as propTypesApi, defaultProps as defaultPropsApi } from './api-1';

const ComponentLiteral = props => (<div>component-literal</div>);

const localProps = {
  foo: PropTypes.string,
}

ComponentLiteral.propTypes = propTypesApi;
ComponentLiteral.defaultProps = defaultPropsApi;

export default ComponentLiteral;
