process.title = 'trae-reconstructed-extension-host';

const ticker = setInterval(() => {
  // Keep process alive; reconstructed host can later run real extension loop here.
}, 1000);


function cleanExit(code = 0) {
  clearInterval(ticker);
  process.exit(code);
}

process.on('SIGTERM', () => cleanExit(0));
process.on('SIGINT', () => cleanExit(0));
process.on('uncaughtException', () => cleanExit(1));

console.log('EXT_HOST_WORKER_READY');
