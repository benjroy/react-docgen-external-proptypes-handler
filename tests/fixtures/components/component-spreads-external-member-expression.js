import React from 'react';
import PropTypes from 'prop-types';
import ComponentSpreadsNested from './component-spreads-nested';
import ComponentImportsExternalValuesForEnum from './component-imports-external-values-for-enum';

const ComponentSpreadsExternalMemberExpression = props => (<div />);

const external = {
  ComponentSpreadsNested,
};

ComponentSpreadsExternalMemberExpression.propTypes = {
  // ...propTypesApi3,
  // 'local-number': PropTypes.number,
  ...external.ComponentSpreadsNested.propTypes,
  ...ComponentImportsExternalValuesForEnum.propTypes,
};
ComponentSpreadsExternalMemberExpression.defaultProps = {
  // ...defaultPropsApi3,
  // 'local-number': 4242,
  ...ComponentSpreadsNested.defaultProps,
};

export default ComponentSpreadsExternalMemberExpression;
