const Module = require('module');
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'phaser') {
    return {};
  }
  return originalLoad(request, parent, isMain);
};
