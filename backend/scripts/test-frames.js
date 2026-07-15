const { getFrames, getFrameCount } = require('./dist/db/client.js');
const cnt = getFrameCount('18175983');
console.log('getFrameCount:', cnt);
const rows = getFrames('18175983', { stride: 1 });
console.log('getFrames rows:', rows.length);
const rowsNoStride = getFrames('18175983');
console.log('getFrames (no stride) rows:', rowsNoStride.length);
