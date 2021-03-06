/*
 * node-fast-ratelimit
 *
 * Copyright 2016, Valerian Saliou
 * Author: Valerian Saliou <valerian@valeriansaliou.name>
 */


var HashTable = require('hashtable-patch-valeriansaliou');

var __Promise = (
  (typeof Promise !== 'undefined') ?
    Promise : require('es6-promise-polyfill').Promise
);


/**
 * FastRateLimit
 * @class
 * @classdesc  Instanciates a new rate-limiter
 * @param      {object} options : {threshold,ttl}
 */
var FastRateLimit = function(options) {
  // Sanitize options
  if (typeof options !== 'object') {
    throw new Error('Invalid or missing options');
  }
  if (typeof options.threshold !== 'number' || options.threshold < 0) {
    throw new Error('Invalid or missing options.threshold');
  }
  if (typeof options.ttl !== 'number' || options.ttl < 0) {
    throw new Error('Invalid or missing options.ttl');
  }

  // Environment
  var secondInMilliseconds = 1000;

  // Storage space
  this.__options = {
    threshold: options.threshold,
    ttl_millisec: (options.ttl * secondInMilliseconds)
  };

  this.__tokens = new HashTable();
};


/**
 * tokenCheck
 * @private
 * @param   {boolean}  consumeToken Whether to consume token or not
 * @returns {function} A configured token checking function
 */
var tokenCheck = function(consumeToken) {
  return function(namespace) {
    // No namespace provided?
    if (!namespace) {
      // Do not rate-limit (1 token remaining each hop)
      return true;
    }

    let _tokens_count;
    let _tokens_time;
    const dateNow = Date.now();
    // Token bucket empty for namespace?
    if (this.__tokens.has(namespace) === false) {
      _tokens_count = this.__options.threshold;
      _tokens_time = dateNow;
      this.__scheduleExpireToken(namespace);
    } else {
      const {c, t} = this.__tokens.get(namespace);
      if((dateNow - t)>this.__options.ttl_millisec){
        _tokens_count = this.__options.threshold;
        _tokens_time = dateNow;
        this.__scheduleExpireToken(namespace);
      }else{
        _tokens_count = c;
        _tokens_time = t;
      }
    }

    // Check remaining tokens in bucket
    if (_tokens_count > 0) {
      if (consumeToken) {
        this.__tokens.put(
          namespace, {
            c: (_tokens_count - 1),
            t: _tokens_time
          }
        );
      }else{
        this.__tokens.remove(namespace);
      }

      return true;
    }

    return false;
  };
};


// self.__tokens.remove(namespace);

/**
 * FastRateLimit.prototype.consumeSync
 * @public
 * @param  {string}  namespace
 * @return {boolean} Whether tokens remain in current timespan or not
 */
FastRateLimit.prototype.consumeSync = tokenCheck(true);


/**
 * FastRateLimit.prototype.hasTokenSync
 * @public
 * @param  {string}  namespace
 * @return {boolean} Whether tokens remain in current timespan or not
 */

FastRateLimit.prototype.hasTokenSync = tokenCheck(false);


/**
 * FastRateLimit.prototype.consume
 * @public
 * @param  {string} namespace : namespace
 * @return {object} Promise object
 */
FastRateLimit.prototype.consume = function(namespace) {
  if (this.consumeSync(namespace) === true) {
    return __Promise.resolve();
  }

  return __Promise.reject({error: 'LIMIT'});
};


/**
 * FastRateLimit.prototype.hasToken
 * @public
 * @param  {string}  namespace : namespace
 * @return {object} Promise object
 */
FastRateLimit.prototype.hasToken = function(namespace) {
  if (this.hasTokenSync(namespace) === true) {
    return __Promise.resolve();
  }

  return __Promise.reject();
};


/**
 * FastRateLimit.prototype.__scheduleExpireToken
 * @private
 * @param  {string} namespace : namespace
 * @return {undefined}
 */
FastRateLimit.prototype.__scheduleExpireToken = function(namespace) {
  var self = this;

  setTimeout(() => {
    // Expire token storage for namespace
    self.__tokens.remove(namespace);
  }, this.__options.ttl_millisec);
};


exports.FastRateLimit = FastRateLimit;
