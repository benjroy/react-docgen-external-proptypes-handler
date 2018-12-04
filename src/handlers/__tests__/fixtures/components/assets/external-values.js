const STRING = 'external-values-string'
const BOOL = false;
const NUMBER = 42;

const ENUM = [STRING, NUMBER, BOOL, 4];

const ZERO = 0;
const ONE = 1;
const TWO = 2;
const THREE = 'three';

function FUNCTION() {};

export {
  STRING,
  BOOL,
  NUMBER,
  // TODO: maybe not these below
  ZERO,
  ONE,
  TWO,
  THREE,
  ENUM,
  FUNCTION,
};

export default ENUM;
