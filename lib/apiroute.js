'use strict'

var ROUTES = {
  'local': 'http://api.lcl.mbq.io:8000',
  'development': 'https://api.dev.mbq.io',
  'staging': 'https://api.stg.mbq.io',
  'production': 'https://api.managedbyq.com'
};

/*
 *  apiRoute
 *  Uses api environment variable to set a base url to proxy API calls through.
 *  @param {Express} app Express app to call to.
 *  @param {Object} opts Options object. Currently unused.
 *  @param {Object} locals Contains captured environment variables
 *
 *  @param {String} locals.api Flag to determine base url to route to.
 *                  local || development (default) || staging || production
 *  @param {String} locals.api_endpoint Base URL to directly use. Will override
 *                  url set by locals.api
 */
function apiRoute (app, opts, locals) {

  var baseAPIURL = ROUTES[locals.api];

  if (typeof opts.request === 'undefined') {
    throw new Error('Request is required to run ApiRoute');
  }

  if (typeof baseAPIURL === 'undefined') {
    baseAPIURL = ROUTES.local;
  }

  if (typeof locals.api_endpoint !== 'undefined') {
    baseAPIURL = locals.api_endpoint;
  }

  var request = opts.request;
  console.log('API URL:', baseAPIURL);

  // capture all requests to relative /api
  app.use('/api', function(req, res) {

    var url = baseAPIURL + '/api' + req.url;
    console.log('proxying ' + url);

    var r = null;
    switch (req.method) {
      case 'POST':
        r = request.post({uri: url, json: req.body});
        break;
      case 'PUT':
        r = request.put({uri: url, json: req.body});
        break;
      case 'PATCH':
        r = request.patch({uri: url, json: req.body});
        break;
      case 'OPTIONS':
        r = request({uri: url, json: req.body});
        break;
      default:
        r = request(url);
        break;
    }

    req.pipe(r).pipe(res);
  });
};

module.exports = apiRoute;
