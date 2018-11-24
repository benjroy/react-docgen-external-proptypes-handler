module.exports = function getRoot(path) {
  return path.scope.getGlobalScope().node
  // let c = path;
  // while (typeof c.parentPath !== 'undefined' && c.parentPath !== null) {
  //   c = c.parentPath;
  // }
  // return c;
}

// module.exports = function getRoot(node) {
//   let root = node;
//   while (root.parent) {
//     root = root.parent;
//   }
//   return root;
// }