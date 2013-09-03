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
    async    = require('async'),
    ENOENT   = 'ENOENT',
    gcp      = require('./gcp');


module.exports = function(options) {
    options = options || {};

    var mangle = options.mangle || true,
        compress = options.compress || true,
        templateName = options.templateName || "jst",
        templateDir = options.templateDir || "",
        env = options.env || process.env.NODE_ENV || 'development',
        timeLaunched = new Date(),
        minify = options.minify,
        src = options.source,
        dest = options.dest,
        compiler, lines, names, mountPath;

    if (!src) throw new Error('GCP requires "source" directory');
    if (!dest) throw new Error('GCP requires "dest" directory');
    if (!minify) minify = (env == 'development') ? false : true;

    gcp.jst.namespace = templateName;
    gcp.jst.templateDir = templateDir;

    mountPath = join(dest, 'javascripts');

    var middleware = function middleware(req, res, next) {
        if ('GET' != req.method && 'HEAD' != req.method) return next();

        var path = url.parse(req.url).pathname;

        if (/\.js$/.test(path) && /\/javascripts\//.test(path) && !/_skip/.test(path)) {
            var newPath = relative('/javascripts',path),
                destPath = join(mountPath, newPath),
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

        if (env == 'development') compiler.process(function(err) {
            if (err) next(err);
            else compiler.compile(destPath, next);
        });
        else isCompiled(destPath, function(compiled) {
            if (!compiled) compiler.process(function(err) {
                if (err) next(err);
                else compiler.compile(destPath, next);
            });
            else next();
        });
    }

    function isCompiled(path, callback) {
        fs.exists(path, function(exists) {
            callback(!(!exists || exists.code === ENOENT || exists === {}));
        });
    }

    return middleware;
};
