const React = require('React');
const PropTypes = require('prop-types');
const { propTypes: propTypesApi3, defaultProps: defaultPropsApi3 } = require('./assets/api-3');
// const api3 = require('./assets/api-3');
// const { propTypes: propTypesApi3, defaultProps: defaultPropsApi3 } = api3;


const ComponentRequiresAndSpreadsNested = props => (<div />);

ComponentRequiresAndSpreadsNested.propTypes = {
  ...propTypesApi3,
  'local-func': PropTypes.func,
};
ComponentRequiresAndSpreadsNested.defaultProps = {
  ...defaultPropsApi3,
  'local-func': function noop() {},
};

export default ComponentRequiresAndSpreadsNested;
