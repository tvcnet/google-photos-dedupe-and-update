var e,t;"function"==typeof(e=globalThis.define)&&(t=e,e=null),function(t,o,n,r,i){var s="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:"undefined"!=typeof window?window:"undefined"!=typeof global?global:{},u="function"==typeof s[r]&&s[r],l=u.cache||{},f="undefined"!=typeof module&&"function"==typeof module.require&&module.require.bind(module);function a(e,o){if(!l[e]){if(!t[e]){var n="function"==typeof s[r]&&s[r];if(!o&&n)return n(e,!0);if(u)return u(e,!0);if(f&&"string"==typeof e)return f(e);var i=Error("Cannot find module '"+e+"'");throw i.code="MODULE_NOT_FOUND",i}c.resolve=function(o){var n=t[e][1][o];return null!=n?n:o},c.cache={};var d=l[e]=new a.Module(e);t[e][0].call(d.exports,c,d,d.exports,this)}return l[e].exports;function c(e){var t=c.resolve(e);return!1===t?{}:a(t)}}a.isParcelRequire=!0,a.Module=function(e){this.id=e,this.bundle=a,this.exports={}},a.modules=t,a.cache=l,a.parent=u,a.register=function(e,o){t[e]=[function(e,t){t.exports=o},{}]},Object.defineProperty(a,"root",{get:function(){return s[r]}}),s[r]=a;for(var d=0;d<o.length;d++)a(o[d]);if(n){var c=a(n);"object"==typeof exports&&"undefined"!=typeof module?module.exports=c:"function"==typeof e&&e.amd?e(function(){return c}):i&&(this[i]=c)}}({iqPqJ:[function(e,t,o){var n=e("@parcel/transformer-js/src/esmodule-helpers.js");n.defineInteropFlag(o),n.export(o,"config",()=>i);var r=e("../lib/types");let i={matches:["https://photos.google.com/*"],run_at:"document_idle"};window.addEventListener("message",e=>{if(e.source!==window)return;let t=e.data;t?.app===r.APP_ID&&("gptkResult"===t.action||"gptkProgress"===t.action||"gptkLog"===t.action)&&chrome.runtime.sendMessage(t)}),chrome.runtime.onMessage.addListener(e=>{e?.app===r.APP_ID&&"gptkCommand"===e.action&&window.postMessage(e)}),console.log("GPD: Bridge content script loaded");

// Bridge storage for injected scripts
window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    const msg = e.data;
    if (msg?.app === "GPD" && msg.action === "gptkGetStorage") {
        chrome.storage.local.get(["apiSettings"], (result) => {
            window.postMessage({
                app: "GPD",
                action: "gptkStorageData",
                data: result.apiSettings
            }, "*");
        });
    }
});