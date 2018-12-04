const fs = require('fs');
const path = require('path');
const glob = require('glob');
const docgen = require('react-docgen');
// const original_externalProptypesHandler = require("../index");
// const externalPropTypeHandler = require("../externalPropTypeHandler").propTypeHandler;
// const nightly_externalPropTypeHandler = require("../nightly_externalPropTypeHandler").propTypeHandler;
// const nightly_externalPropTypeHandler = require("../src/handlers/externalPropTypeHandler").propTypeHandler;
const nightly_externalPropTypeHandler = require("../externalPropTypeHandler").externalPropTypeHandler;

const { expect } = global;

const CWD = process.cwd();

describe('react-docgen-external-proptypes-handler', () => {
  // const HANDLER = original_externalProptypesHandler;
  // const HANDLER = externalPropTypeHandler;
  const HANDLER = nightly_externalPropTypeHandler;

  function processFilepathWithHandlers(filepath, handlers) {
    const resolver = docgen.resolver.findExportedComponentDefinition;
    const options = {};
    // read file to get source code
    const source = fs.readFileSync(filepath, 'utf8');
    return docgen.parse(source, resolver, handlers, options);
  }

  function processFilepathWithDefaultHandlers(filepath) {
    const handlers = docgen.defaultHandlers.concat(
      HANDLER(filepath)
    );
    return processFilepathWithHandlers(filepath, handlers);
  };

  function processFilepathWithHandler(filepath) {
    const handlers = ([]).concat(
      HANDLER(filepath)
    );
    return processFilepathWithHandlers(filepath, handlers);
  };

  function test(filepath) {
    // it('parses with default resolver/handlers and external handler for ${filepath}', () => {
    //   const info = processFilepathWithDefaultHandlers(filepath);
    //   expect(info).toMatchSnapshot();
    // });
    
    it('parses with only external handlers', () => {
      const info = processFilepathWithHandler(filepath);
      expect(info).toMatchSnapshot();
    });
  }


  const TARGET_FILES = glob.sync(path.resolve(__dirname, 'fixtures/components/component-*.js'));
  // const TARGET_FILES = glob.sync('path.resolve(__dirname, tfixtures/components/component-class-*-external)*.js');
  // const TARGET_FILES = glob.sync('path.resolve(__dirname, tfixtures/components/component-imports-node)-module.js');
  // const TARGET_FILES = glob.sync('path.resolve(__dirname, tfixtures/components/component-requires-and)-spreads-nested.js');
  // const TARGET_FILES = glob.sync('path.resolve(__dirname, tfixtures/components/component-spreads-call)-expression.js');
  // const TARGET_FILES = glob.sync('path.resolve(__dirname, tfixtures/components/component-spreads-external)-member-expression.js');
  // const TARGET_FILES = glob.sync('path.resolve(__dirname, tfixtures/components/component-imports-api)-cjs*.js');
  // const TARGET_FILES = glob.sync('path.resolve(__dirname, tfixtures/components/component-spread*.js)');
  // const TARGET_FILES = glob.sync('path.resolve(__dirname, tfixtures/components/component-no-*.js)');
  // const TARGET_FILES = glob.sync('path.resolve(__dirname, tfixtures/components/component-local-*.js)');
  // const TARGET_FILES = glob.sync('path.resolve(__dirname, tfixtures/components/component-spreads-nested).js');
  // const TARGET_FILES = glob.sync('tests/path.resolve(__dirname, fcomponents/component-{spreads-nested),literal}.js');
  // const TARGET_FILES = glob.sync('path.resolve(__dirname, tfixtures/components/component-literal.js)');
  // const TARGET_FILES = glob.sync('path.resolve(__dirname, tfixtures/components/component-imports-external)-*.js');
  // const TARGET_FILES = glob.sync('path.resolve(__dirname, tfixtures/components/component-imports-external)-prop*.js');
  // const TARGET_FILES = glob.sync('path.resolve(__dirname, tfixtures/components/component-imports-literal)*.js');
  // const TARGET_FILES = glob.sync('path.resolve(__dirname, tfixtures/components/component-imports-literal)-default.js');
  // const TARGET_FILES = glob.sync('path.resolve(__dirname, tfixtures/components/component-*-enum*.js)');


  TARGET_FILES.forEach(filepath => {
    describe(path.basename(filepath), () => test(filepath));
  });


});

