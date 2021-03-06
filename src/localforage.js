(function() {
    'use strict';

    // Promises!
    var Promise = this.Promise;

    // Avoid those magic constants!
    var MODULE_TYPE_DEFINE = 1;
    var MODULE_TYPE_EXPORT = 2;
    var MODULE_TYPE_WINDOW = 3;

    // Attaching to window (i.e. no module loader) is the assumed,
    // simple default.
    var moduleType = MODULE_TYPE_WINDOW;

    // Find out what kind of module setup we have; if none, we'll just attach
    // localForage to the main window.
    if (typeof define === 'function' && define.amd) {
        moduleType = MODULE_TYPE_DEFINE;
    } else if (typeof module !== 'undefined' && module.exports) {
        moduleType = MODULE_TYPE_EXPORT;
    }

    // Initialize IndexedDB; fall back to vendor-prefixed versions if needed.
    var indexedDB = indexedDB || this.indexedDB || this.webkitIndexedDB ||
                    this.mozIndexedDB || this.OIndexedDB ||
                    this.msIndexedDB;

    // Check for WebSQL.
    var openDatabase = this.openDatabase;

    // The actual localForage object that we expose as a module or via a global.
    // It's extended by pulling in one of our other libraries.
    var _this = this;
    var localForage = {
        INDEXEDDB: 'asyncStorage',
        LOCALSTORAGE: 'localStorageWrapper',
        WEBSQL: 'webSQLStorage',

        config: {},

        driver: function() {
            return this._driver || null;
        },

        _ready: Promise.reject(new Error("setDriver() wasn't called")),

        setDriver: function(driverName, callback) {
            var driverSet = new Promise(function(resolve, reject) {
                if ((!indexedDB && driverName === localForage.INDEXEDDB) ||
                    (!openDatabase && driverName === localForage.WEBSQL)) {
                    reject(localForage);

                    return;
                }

                localForage._ready = null;

                // We allow localForage to be declared as a module or as a library
                // available without AMD/require.js.
                if (moduleType === MODULE_TYPE_DEFINE) {
                    require([driverName], function(lib) {
                        localForage._extend(lib);

                        resolve(localForage);
                    });

                    // Return here so we don't resolve the promise twice.
                    return;
                } else if (moduleType === MODULE_TYPE_EXPORT) {
                    // Making it browserify friendly
                    var driver;
                    switch (driverName) {
                        case localForage.INDEXEDDB:
                            driver = require('localforage/src/drivers/indexeddb');
                            break;
                        case localForage.LOCALSTORAGE:
                            driver = require('localforage/src/drivers/localstorage');
                            break;
                        case localForage.WEBSQL:
                            driver = require('localforage/src/drivers/websql');
                    }

                    localForage._extend(driver);
                } else {
                    localForage._extend(_this[driverName]);
                }

                resolve(localForage);
            });

            driverSet.then(callback, callback);

            return driverSet;
        },

        ready: function(callback) {
            if (this._ready === null) {
                this._ready = this._initStorage(this.config);
            }

            this._ready.then(callback, callback);

            return this._ready;
        },

        _extend: function(libraryMethodsAndProperties) {
            for (var i in libraryMethodsAndProperties) {
                if (libraryMethodsAndProperties.hasOwnProperty(i)) {
                    this[i] = libraryMethodsAndProperties[i];
                }
            }
        }
    };

    var storageLibrary;
    // Check to see if IndexedDB is available; it's our preferred backend
    // library.
    if (indexedDB) {
        storageLibrary = localForage.INDEXEDDB;
    } else if (openDatabase) { // WebSQL is available, so we'll use that.
        storageLibrary = localForage.WEBSQL;
    } else { // If nothing else is available, we use localStorage.
        storageLibrary = localForage.LOCALSTORAGE;
    }

    /* if window.localForageConfig is set */
    if(this.localForageConfig) {
        localForage.config = this.localForageConfig;
    }

    // Set the (default) driver.
    localForage.setDriver(storageLibrary);

    // We allow localForage to be declared as a module or as a library
    // available without AMD/require.js.
    if (moduleType === MODULE_TYPE_DEFINE) {
        define(function() {
            return localForage;
        });
    } else if (moduleType === MODULE_TYPE_EXPORT) {
        module.exports = localForage;
    } else {
        this.localforage = localForage;
    }
}).call(this);
