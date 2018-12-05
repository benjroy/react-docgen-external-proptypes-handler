# imported variables for `handler` for `react-docgen`

## Install
```
npm install react-docgen-imported-proptype-handler --save-dev
```

### Usage
```js
const docgen = require('react-docgen');
const importedProptypesHandler = require('react-docgen-imported-proptype-handler');

let metadata = files.map(filepath => {
  /* append display name handler to handlers list */
  const handlers = docgen.defaultHandlers.concat(importedProptypesHandler(filepath));

  /* read file to get source code */
  const code = fs.readFileSync(path, 'utf8');

  /* parse the component code to get metadata */
  const data = docgen.parse(code, null, handlers);

  return data;
});
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
