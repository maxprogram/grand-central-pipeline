/**
 * Inspiration from:
 * uglify-js-middleware (https://github.com/JakeWharton/uglify-js-middleware)
 * snockets (https://github.com/pthrasher/snockets)
 *
 */

var _        = require('underscore'),
    fs       = require('fs'),
    url      = require('url'),
    npath    = require('path'),
    basename = npath.basename,
    dirname  = npath.dirname,
    join     = npath.join,
    relative = npath.relative,
    ENOENT   = 'ENOENT',
    gcp      = require('./gcp');


module.exports = function(options) {
    options = options || {};

    var force = options.force || false,
        mangle = options.mangle || true,
        compress = options.compress || true,
        templateName = options.templateName || "jst",
        templateDir = options.templateDir || "",
        env = process.env.NODE_ENV || 'development',
        timeLaunched = new Date(),
        minify = options.minify,
        src = options.source,
        dest = options.dest,
        compiler, lines, names;

    if (!src) throw new Error('GCP requires "source" directory');
    if (!dest) throw new Error('GCP requires "dest" directory');
    if (!minify) minify = (env == 'development') ? false : true;

    gcp.jst.namespace = templateName;
    gcp.jst.templateDir = templateDir;

    var middleware = function middleware(req, res, next) {
        if ('GET' != req.method && 'HEAD' != req.method) return next();

        var path = url.parse(req.url).pathname;

        if (/\.js$/.test(path) && /\/javascripts\//.test(path) && !/_skip/.test(path)) {
            var newPath = relative('/javascripts',path),
                destPath = join(dest, 'javascripts', newPath),
                reqPath = join(src, newPath);
            prepare(destPath, reqPath, next);
        } else next();

    };

    function prepare(destPath, reqPath, next) {
        compiler = new gcp.Compiler(reqPath, {
            minify: minify,
            mangle: mangle,
            compress: compress
        });
        if (force) compiler.compile(destPath, next);
        else {
            var compiled = fs.existsSync(destPath);
            if (!compiled || compiled.code === ENOENT || compiled === {}) {
            // JS has not been compiled, compile it!
                compiler.compile(destPath, next);
            } else {
            // Compare modified times to last compile time
                var compiledTime = fs.statSync(destPath).mtime,
                    shouldCompile = false;
                if (minify && compiledTime < timeLaunched) shouldCompile = true;
                else compiler.paths.forEach(function(js) {
                    var mtime = fs.statSync(js).mtime;
                    if (mtime > compiledTime) shouldCompile = true;
                });
                if (shouldCompile) compiler.compile(destPath, next);
                else next();
            }
        }
    }

    return middleware;
};
