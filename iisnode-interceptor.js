// Docs: https://github.com/Azure/iisnode/blob/master/src/samples/advanced/interceptor/interceptor.js
// This script is executed by iisnode for each incoming request and is used to
// dynamically configure iisnode options.

// This interceptor helps with Single Page Application (SPA) routing in Next.js on IIS.
// When Next.js can't find a server-side route, it might return a 404. If the URL
// looks like a client-side route (e.g., /dashboard/users/123), we can catch that 404
// and return a 200 OK. This allows the Next.js client-side router to take over
// and render the correct component without a full page reload.
module.exports.onPostExecute = function (req, res, data, callback) {
  // If the response is a 404 and the path does not have an extension (like .js, .css),
  // it's likely a client-side route. We return a 200 OK, allowing the Next.js
  // client-side router to handle it.
  if (res.statusCode === 404 && req.url.indexOf('.') === -1) {
    res.statusCode = 200;
  }
  
  callback(null, data);
};
