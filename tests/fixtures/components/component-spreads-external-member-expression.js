import React from 'react';
import PropTypes from 'prop-types';
import ComponentSpreadsNested from './component-spreads-nested';
import ReexportsImportedComponent from './reexports-imported-component';

const ComponentSpreadsExternalMemberExpression = props => (<div />);

const external = {
  ReexportsImportedComponent,
};

ComponentSpreadsExternalMemberExpression.propTypes = {
  ...ComponentSpreadsNested.propTypes,
  ...external.ReexportsImportedComponent.propTypes,
};
ComponentSpreadsExternalMemberExpression.defaultProps = {
  ...ComponentSpreadsNested.defaultProps,
  ...external.ReexportsImportedComponent.defaultProps,
};

export default ComponentSpreadsExternalMemberExpression;
