import {createApp} from './app.js';
document.documentElement.classList.add('js');
let storage;
try {storage=window.localStorage;} catch { /* Page remains usable when storage is blocked. */ }
const catalogUrl=new URL(document.querySelector('meta[name="meal-catalog"]').content,document.baseURI).href;
createApp({document,fetch:window.fetch.bind(window),storage,catalogUrl}).start();
