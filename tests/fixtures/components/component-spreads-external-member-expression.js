import React from 'react';
import PropTypes from 'prop-types';
import ComponentSpreadsNested from './component-spreads-nested';
import ReexportsImportedComponent from './reexports-imported-component';

const ComponentSpreadsExternalMemberExpression = props => (<div />);

const external = {
  ReexportsImportedComponent,
};

ComponentSpreadsExternalMemberExpression.propTypes = {
  // ...propTypesApi3,
  // 'local-number': PropTypes.number,
  ...ComponentSpreadsNested.propTypes,
  ...external.ReexportsImportedComponent.propTypes,
};
ComponentSpreadsExternalMemberExpression.defaultProps = {
  // ...defaultPropsApi3,
  // 'local-number': 4242,
  ...ComponentSpreadsNested.defaultProps,
  ...external.ReexportsImportedComponent.defaultProps,
};

export default ComponentSpreadsExternalMemberExpression;
