import React from 'react';
import PropTypes from 'prop-types';

const ComponentLocalSpread = props => (<div>component-local-spread</div>);

const LOCAL_ONE = 1;
const LOCAL_TWO = 'two';
const LOCAL_THREE = 3;
const LOCAL_ENUM = [LOCAL_ONE, LOCAL_TWO, LOCAL_THREE];

const localProps = {
  node: PropTypes.node.isRequired,
  string: PropTypes.string,
  number: PropTypes.number,
  bool: PropTypes.bool,
  enum: PropTypes.oneOf([1, 2, 3]),
  'enum-vars': PropTypes.oneOf([LOCAL_ONE, LOCAL_TWO, LOCAL_THREE]),
  'enum-var-of-vars': PropTypes.oneOf(LOCAL_ENUM),
  shape: PropTypes.shape({
    LOCAL_ONE: PropTypes.number,
    LOCAL_ENUM: PropTypes.oneOf(LOCAL_ENUM),
  }),
};

const localDefaultProps = {
  string: 'a string',
  number: 42,
  bool: false,
  enum: 1,
  'enum-vars': LOCAL_TWO,
  'enum-var-of-vars': LOCAL_THREE,
  shape: {
    LOCAL_ONE,
    LOCAL_ENUM: LOCAL_ENUM[2],
  }
};

ComponentLocalSpread.propTypes = {
  ...localProps,
  ...{
    /**
     * Comment for inline-object-spread-string.
     */
    'inline-object-spread-string': PropTypes.string,
  }
};
ComponentLocalSpread.defaultProps = {
  ...localDefaultProps, // these aren't picked up
};

export default ComponentLocalSpread;
