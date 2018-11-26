import React from 'react';
import stringPropType from './assets/external-default-string-propType';


const ComponentImportsExternalPropType = props => (<div>component-literal</div>);

ComponentImportsExternalPropType.propTypes = {
  /**
   * Comment for externalPropType.
   */
  externalPropType: stringPropType,
};

ComponentImportsExternalPropType.defaultProps = {};

export default ComponentImportsExternalPropType;
