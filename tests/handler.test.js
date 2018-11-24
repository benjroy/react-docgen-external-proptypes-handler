const fs = require('fs');
const mockFs = require('mock-fs');
const path = require('path');
const glob = require('glob');
const docgen = require('react-docgen');
const { mapKeys } = require('lodash');
const original_externalProptypesHandler = require("../index");
// const externalPropTypeHandler = require("../externalPropTypeHandler").propTypeHandler;
const nightly_externalPropTypeHandler = require("../nightly_externalPropTypeHandler").propTypeHandler;

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
    it('parses with default resolver/handlers and external handler for ${filepath}', () => {
      let info;
      // expect(() => {
        info = processFilepathWithDefaultHandlers(filepath);
      // }).not.toThrowError();
      expect(info).toMatchSnapshot();
    });
    
    it('parses with only external handlers', () => {
      let info;
      // expect(() => {
        info = processFilepathWithHandler(filepath);
      // }).not.toThrowError();
      expect(info).toMatchSnapshot();
    });
  }

  // function testWithMockFs(filename, source, mockFilesystem) {
  //   const testFilepath = `${filename}.js`;
  //   const testDir = 'tests/fixtures/mocks';
  //   const mocks = mapKeys({
  //     [testFilepath]: source,
  //     ...mockFilesystem,
  //   }, (val, key) => path.join('./' + testDir, key));
  //   // const mocks = {
  //   //   [testFilepath]: source,
  //   //   ...mockFilesystem,
  //   // };
  //   console.log(mocks);
  //   console.log(); // https://github.com/facebook/jest/issues/5792
  //   mockFs(mocks);
  //   try {
  //     const output = test(path.join('./' + testDir, testFilepath));
  //   } catch (err) {
  //     mockFs.restore();
  //     throw err;
  //   }
  //   mockFs.restore();
  // }

  // describe('destructures a namespace', () => {
  //   testWithMockFs('destructures', `
  //     import React from 'react';
  //     import PropTypes from 'prop-types';
  //     import propTypes from './external';

  //     const Component = (props) => (<div />);

  //     Component.propTypes = {
  //       string: PropTypes.string,
  //     };
  //     export default Component;
  //   `, {
  //     'external.js': `
  //       import PropTypes from 'prop-types';

  //       export default {
  //         string: PropTypes.string.isRequired;
  //       };
  //     `
  //   })
  // });



  const TARGET_FILES = glob.sync(path.resolve(CWD, 'tests/fixtures/component-*.js'));
  // const TARGET_FILES = glob.sync(path.resolve(CWD, 'tests/fixtures/component-spread*.js'));
  // const TARGET_FILES = glob.sync(path.resolve(CWD, 'tests/fixtures/component-no-*.js'));
  // const TARGET_FILES = glob.sync(path.resolve(CWD, 'tests/fixtures/component-local-*.js'));
  // const TARGET_FILES = glob.sync(path.resolve(CWD, 'tests/fixtures/component-spreads-nested.js'));
  // const TARGET_FILES = glob.sync(path.resolve(CWD, 'tests/fixtures/component-{spreads-nested,literal}.js'));
  // const TARGET_FILES = glob.sync(path.resolve(CWD, 'tests/fixtures/component-literal.js'));
  // const TARGET_FILES = glob.sync(path.resolve(CWD, 'tests/fixtures/component-imports-external-*.js'));
  // const TARGET_FILES = glob.sync(path.resolve(CWD, 'tests/fixtures/component-imports-external-prop*.js'));
  // const TARGET_FILES = glob.sync(path.resolve(CWD, 'tests/fixtures/component-imports-literal*.js'));
  // const TARGET_FILES = glob.sync(path.resolve(CWD, 'tests/fixtures/component-imports-literal-default.js'));
  // const TARGET_FILES = glob.sync(path.resolve(CWD, 'tests/fixtures/component-*-enum*.js'));

  TARGET_FILES.forEach(filepath => {
    describe(filepath, () => test(filepath));
  });


});

