import React from 'react';
import PropTypes from 'prop-types';
import ComponentClassSpreadsNested from './component-class-spreads-nested';

export default class ComponentClassSpreadsExternalMemberExpression {

  static propTypes = {
    ...ComponentClassSpreadsNested.propTypes,
    /**
     * Description for localBool in ComponentClassSpreadsExternalMemberExpression
     */
    localBool: PropTypes.bool.isRequired,
  };

  render() {
    return null;
  }
}
