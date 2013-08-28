/**
 * Inspiration from:
 * uglify-js-middleware (https://github.com/JakeWharton/uglify-js-middleware)
 * snockets (https://github.com/pthrasher/snockets)
 *
 */

var _        = require('underscore'),
    uglify   = require('uglify-js'),
    fs       = require('fs'),
    url      = require('url'),
    npath    = require('path'),
    basename = npath.basename,
    dirname  = npath.dirname,
    join     = npath.join,
    relative = npath.relative,
    glob     = require('glob'),
    async    = require('async'),
    jst      = require('./jst'),
    ENOENT   = 'ENOENT';


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
        pathList, file, lines, names;

    if (!src) throw new Error('GCP requires "source" directory');
    if (!dest) throw new Error('GCP requires "dest" directory');
    if (!minify) minify = (env == 'development') ? false : true;

    jst.namespace = templateName;
    jst.templateDir = templateDir;

    var middleware = function middleware(req, res, next) {
        if ('GET' != req.method && 'HEAD' != req.method) return next();

        var path = url.parse(req.url).pathname;

        if (/\.js$/.test(path) && !/_skip/.test(path)) {
            var newPath = basename(path),
                destPath = join(dest, newPath),
                reqPath = join(src, newPath);
            prepare(destPath, reqPath, next);
        } else next();

    };

    function prepare(destPath, reqPath, next) {
        pathList = lines = names = [];
        file = new File('require', reqPath);
        if (force) compile(destPath, next);
        else {
            var compiled = fs.existsSync(destPath);
            if (!compiled || compiled.code === ENOENT || compiled === {}) {
            // JS has not been compiled, compile it!
                compile(destPath, next);
            } else {
            // Compare modified times to last compile time
                var compiledTime = fs.statSync(destPath).mtime,
                    shouldCompile = false;
                if (minify && compiledTime < timeLaunched) shouldCompile = true;
                else pathList.forEach(function(js) {
                    var mtime = fs.statSync(js).mtime;
                    if (mtime > compiledTime) shouldCompile = true;
                });
                if (shouldCompile) compile(destPath, next);
                else next();
            }
        }
    }

    // Compile to destination path
    function compile(path, next) {
        try {
            file.init(function(err) {
                if (err) next(err);
                if (minify) minifyJS(path, next);
                else concatenate(path, next);
            });
        } catch(ex) {
            return next(ex);
        }
    }

    // Concatenates requires for dev environment
    function concatenate(path, callback) {
        var code = file.toString();
        fs.writeFile(path, code, 'utf8', callback);
    }

    // Minifies & writes to destination
    function minifyJS(path, callback) {
        var code = file.toString();
        var result = uglify.minify(code, {
            fromString: true,
            mangle: mangle,
            compress: compress
        });
        fs.writeFile(path, result.code, 'utf8', callback);
    }

////////////////////////////////

    var HEADER = /(?:(\/\/.*\n*)|(\/\*([\S\s]*?)\*\/))+/;
    var DIRECTIVE = /^[\W]*=\s*(\w+.*?)(\*\\\/)?$/gm;
    var extensions = ['.js', '.ejs', '.hbs'];

    function File(type, path) {
        var file = this;
        this.type = type;
        this.path = npath.resolve(path);
        this.dir = dirname(path);
        this.duplicate = false;

        this.files = [];
        this.requires = [];

        pathList.forEach(function(path) {
            if (file.path == path) file.duplicate = true;
        });
        pathList.push(this.path);
    }

    File.prototype.init = function(callback) {
        var file = this;
        async.series([
            _.bind(this.readFile, this),
            _.bind(this.getDirectives, this),
            _.bind(this.resolvePaths, this)
        ], function(err, res) {
            callback(err, file);
        });
    };

    File.prototype.readFile = function(callback) {
        var path = this.path, _this = this;
        fs.readFile(path, function(err, code) {
            if (err) callback(err);
            code = '' + code;
            if (/\.ejs$/.test(path)) code = jst.underscore(code, _this.dir, path);
            else if (/\.hbs$/.test(path)) code = jst.hbs(code, _this.dir, path);
            _this.code = code;
            callback(null, code);
        });
    };

    File.prototype.getDirectives = function(callback) {
        var files = [], _this = this;

        parseDirectives(this.code).forEach(function(d, i) {
            var words = d.replace(/['"]/g, '').split(/\s+/),
                cmd = words[0], path,
                paths = words.length >= 2 ? [].slice.call(words, 1) : [];

            paths.forEach(function(p) {
                switch (cmd) {
                case 'require':
                    path = _this.getPath(p);
                    if (path) files.push(path);
                    break;
                case 'include':
                    path = _this.getPath(p);
                    if (path) files.push({ include: path });
                    break;
                case 'require_directory':
                case 'requireDirectory':
                    files.push({ directory: join(_this.dir, p) });
                    break;
                case 'require_tree':
                case 'requireTree':
                    files.push({ tree: join(_this.dir, p) });
                }
            });
        });

        this.requires = this.requires.concat(files);
        callback(null, this.requires);
    };

    File.prototype.getPath = function(path) {
        extensions.forEach(function(ext) {
            path = path.replace(new RegExp('\\'+ext+'$'), '');
        });
        path = join(this.dir, path);

        var fullPath;
        for (var i in extensions) {
            var ext = extensions[i];
            if (fs.existsSync(path + ext)) fullPath = path + ext;
        }

        if (fullPath) return fullPath;
        else { error(path + "' not found!"); return null; }
    };

    File.prototype.resolvePaths = function(callback) {
        var done = true, _this = this;

        function resolvePath(path, callback) {
            var file;
            if (path.hasOwnProperty('tree')) {
                _this.requireTree(path.tree, callback);
            } else if (path.hasOwnProperty('directory')) {
                _this.requireDirectory(path.directory, callback);
            } else if (path.hasOwnProperty('include')) {
                file = new File('include', path.include);
                file.init(callback);
            } else if (typeof path === 'string') {
                file = new File('require', path);
                file.init(callback);
            } else callback("Not recognized");
        }

        async.map(this.requires, resolvePath, function(err, files) {
            if (err) throw err;
            files = _.flatten(files);
            _this.files = _this.files.concat(files);
            callback(null, files);
        });
    };

    File.prototype.requireDirectory = function(path, callback) {
        var _this = this;
        if (!fs.existsSync(path)) callback(error(path + "' not found!"));
        else fs.readdir(path, function(err, files) {
            if (err) callback(err);
            files = files.filter(function(f) {
                return fileMatch(f);
            }).map(function(f) {
                return new File('require', join(path, f));
            });

            async.map(files, function(file, cb) {
                file.init(cb);
            }, callback);
        });
    };

    File.prototype.requireTree = function(path, callback) {
        var _this = this;
        if (!fs.existsSync(path)) callback(error(path + "' not found!"));
        else glob('**/*', {cwd: path}, function(err, files) {
            if (err) callback(err);
            files = files.filter(function(f) {
                return fileMatch(f);
            }).map(function(f) {
                return new File('require', join(path, f));
            });

            async.map(files, function(file, cb) {
                file.init(cb);
            }, callback);
        });
    };

    File.prototype.getCode = function() {
        if (this.type == 'include') {
            return this.code;
        } else {
            if (this.duplicate) return null;
            else return this.code;
        }
    };

    File.prototype.toString = function() {
        var concat = '', end = '',
            code = this.getCode();

        var header = "" +
            "//=============================================\n" +
            "//" + this.path + "\n" +
            "//=============================================\n\n";

        this.files.forEach(function(f) {
            concat += f.toString();
        });

        /* For future client-side debugger
        if (!minify && code) {
            lines.push(code.split(/\r\n|\r|\n/).length);
            names.push(relative(this.dir, this.path).replace(/\\/g,'/'));
            end += "// Line numbers for debugging\n" +
                "var _gcp = _gcp || {};\n" +
                "_gcp['/" +
                relative(join(dest,'..'), this.path).replace(/\\/g, '/') +
                "'] = [" +
                JSON.stringify(names) + ", " +
                JSON.stringify(lines) + "];";
        }
        */

        if (!code) return '';
        else return concat + header + code + end + "\n\n";
    };

    function fileMatch(path) {
        var match = false;
        extensions.forEach(function(ext) {
            if (new RegExp('\\'+ext+'$').test(path)) match = true;
        });
        return match;
    }

    function parseDirectives(code) {
        var match, header,
            directives = [];

        code = code.replace(/[\r\t ]+$/gm, '\n');
        match = HEADER.exec(code);

        if (!match) return [];
        header = match[0];

        while (match = DIRECTIVE.exec(header)) directives.push(match[1]);
        return directives;
    }


    // Ignore ENOENT to fall through as 404
    function error(err) {
        err = "JavaScript Compiler error: '" + err;
        console.error(err);
        return err;
    }

    return middleware;
};
