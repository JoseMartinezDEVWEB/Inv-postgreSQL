const os = require('os');
const networkInterfaces = os.networkInterfaces();
console.log(JSON.stringify(networkInterfaces, null, 2));
