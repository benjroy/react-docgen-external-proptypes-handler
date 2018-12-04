import fs from 'fs';
import path from 'path';
import glob from 'glob';
import { externalPropTypeHandler } from '../externalPropTypeHandler';
import { parse, resolver } from 'react-docgen';

const { findExportedComponentDefinition } = resolver;
const { describe, it, expect } = global;

const TARGET_FILES = glob.sync(
  path.resolve(__dirname, 'fixtures/components/component-*.js'),
);

describe('react-docgen-external-proptypes-handler', () => {
  function test(filepath) {
    it('parses with only external handlers', () => {
      const info = parse(
        fs.readFileSync(filepath, 'utf8'),
        findExportedComponentDefinition,
        [externalPropTypeHandler(filepath)],
        {},
      );
      expect(info).toMatchSnapshot();
    });
  }

  TARGET_FILES.forEach(filepath => {
    describe(path.basename(filepath), () => test(filepath));
  });
});
