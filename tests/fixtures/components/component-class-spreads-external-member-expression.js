import React from 'react';
import PropTypes from 'prop-types';
import ComponentClassSpreadsNested from './component-class-spreads-nested';

class ComponentClassSpreadsExternalMemberExpression {

  static propTypes = {
    ...ComponentClassSpreadsNested.propTypes,
  };

  render() {
    return null;
  }
}

export default ComponentClassSpreadsExternalMemberExpression;
