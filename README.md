
# `react-docgen` `handler` for processing imported variables

## Install
```bash
# install peer dependencies
npm install react-docgen@2.21.0 recast@0.12.9 --save-dev
# install this handler
npm install react-docgen-imported-proptype-handler --save-dev
```
##### peerDependencies
*note: it is necessary for this `handler` and `react-docgen` to share the same `recast` dependency*
```bash
npm ls recast
```
*should show `recast` as `deduped` under `react-docgen`*
```
<project name>@<project version>
├─┬ react-docgen@2.21.0
│ └── recast@0.12.9  deduped
└── recast@0.12.9
```

### Usage example
```js
const { readFileSync, writeFileSync } = require('fs');
const { resolve, basename } = require('path');
const docgen = require('react-docgen');
const glob = require('glob');
const importedProptypesHandler = require('react-docgen-imported-proptype-handler').default;

const FILES = glob.sync('src/components/**/*.{js,jsx}');

const metadata = FILES.reduce((memo, filepath) => {
  /* append display name handler to handlers list */
  const handlers = docgen.defaultHandlers.concat([
    importedProptypesHandler(filepath)
  ]);

  /* read file to get source code */
  const code = readFileSync(filepath, 'utf8');

  /* parse the component code to get metadata */
  try {
    const data = docgen.parse(code, null, handlers);
    memo[basename(filepath)] = data;
  } catch (err) {
    if (err.message !== 'No suitable component definition found.') {
      console.log('ERROR:', filepath, err);
    }
  }

  return memo;
}, {});


writeFileSync(resolve(process.cwd(), 'DOCGEN_OUTPUT.json'), JSON.stringify(metadata, null, 2));
```

#### Credit
Inspiration for this came from:
- [Chandrasekhar Pasupuleti](https://github.com/pasupuletics), initial implementation
- [Siddharth Kshetrapal](https://github.com/siddharthkp), for publishing [react-docgen-external-proptypes-handler](https://github.com/siddharthkp/react-docgen-external-proptypes-handler)
- and the [issue](https://github.com/reactjs/react-docgen/issues/33) in `react-docgen`

#### Why?
`react-docgen` doesn't allow you to use variables from other files to use in `propTypes`

Example:

```js
import iconNames from './icon-names.js'

Icon.propTypes = {
  /** Icon name */
  name: PropTypes.oneOf(iconNames).isRequired
}
```

This doesn't work because it's parsed as a string and not an array

```json
"props": {
  "name": {
    "type": {
      "name": "enum",
      "computed": true,
      "value": "iconNames"
    },
    "required": true,
    "description": "Icon name"
  },
}
```

#### License
MIT © [benjroy](https://github.com/benjroy)

#### Like it?
:star: this repo
