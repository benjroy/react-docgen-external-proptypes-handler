const fs = require("fs");
const path = require('path');
const glob = require("glob");
const docgen = require("react-docgen");
const externalProptypesHandler = require("../index");
const externalPropTypeHandler = require("../externalPropTypeHandler").propTypeHandler;

const { expect } = global;

const CWD = process.cwd();

function processFilepath(filepath) {
  const resolver = docgen.resolver.findExportedComponentDefinition;
  const handlers = docgen.defaultHandlers.concat(
  // const handlers = ([]).concat(
    // externalProptypesHandler(filepath)
    externalPropTypeHandler(filepath)
  );
  const options = {};
  // read file to get source code
  const code = fs.readFileSync(filepath, 'utf8');
  return docgen.parse(code, resolver, handlers, options);
}

// const TARGET_FILES = glob.sync(path.resolve(CWD, 'tests/fixtures/component-*.js'));
// const TARGET_FILES = glob.sync(path.resolve(CWD, 'tests/fixtures/component-no-*.js'));
// const TARGET_FILES = glob.sync(path.resolve(CWD, 'tests/fixtures/component-spreads-nested.js'));
// const TARGET_FILES = glob.sync(path.resolve(CWD, 'tests/fixtures/component-{spreads-nested,literal}.js'));
// const TARGET_FILES = glob.sync(path.resolve(CWD, 'tests/fixtures/component-literal.js'));
const TARGET_FILES = glob.sync(path.resolve(CWD, 'tests/fixtures/component-imports-external-*.js'));


describe('react-docgen-external-proptypes-handler', () => TARGET_FILES.forEach(filepath => {
  const name = path.basename(filepath, '.js');
  // const expected = require(`./expected/${name}.json`);

  it(`processes all props for ${name}`, () => {
    const info = processFilepath(filepath);
    // console.log(`info ${name}`, JSON.stringify(info, null, 2));
    // expect(info).toEqual(expected);
    expect(info).toMatchSnapshot();
  });
}));
