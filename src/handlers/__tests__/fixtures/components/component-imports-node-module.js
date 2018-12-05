import React from 'react';
import PropTypes from 'prop-types';
import { Route } from 'react-router';


const ComponentImportsNodeModule = props => (<div>component-literal</div>);

ComponentImportsNodeModule.propTypes = {
  /**
   * Description for `localString`
   */
  localString: PropTypes.string.isRequired,
  // this package.json dependency is babel-processed.
  // don't expect to find any prop-types,
  // but do expect the handler to try, and ensure
  // error is not thrown that would prevent processing
  // `localBool` prop below
  ...Route.propTypes,
  /**
   * Description for `localBool`
   */
  localBool: PropTypes.bool,
};

ComponentImportsNodeModule.defaultProps = {
  ...Route.defaultProps,
};

export default ComponentImportsNodeModule;
