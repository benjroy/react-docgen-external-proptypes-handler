import React from 'react';
import PropTypes from 'prop-types';
import { propTypes as propTypesApi3, defaultProps as defaultPropsApi3 } from './assets/api-3';

class ComponentClassSpreadsNested {

  static propTypes = {
    ...propTypesApi3,
    /**
     * Description for localNumber in ComponentClassSpreadsNested
     */
    localNumber: PropTypes.number.isRequired,
  };

  render() {
    return null;
  }
}

export default ComponentClassSpreadsNested;