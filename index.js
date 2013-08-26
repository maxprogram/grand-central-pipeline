/**
 * Adapted from Jake Wharton's uglify-js-middleware
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
    Step     = require('step'),
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
        fileList = [];

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

    // Gets list of all required javascripts,
    // then compiles if necessary.
    function prepare(destPath, reqPath, next) {
        var javascripts = [], trees = [];
        Step(function(){
            fs.readFile(reqPath, 'utf8', this);
        }, function(err, str) {
            if (err) return error(err);
            var group = this.group();
            javascripts = routeDirectives(str);
            // Gets all files in trees
            javascripts.forEach(function(r,i) {
                // If it's an array, it's a folder
                if (Array.isArray(r)) {
                    trees.push(i);
                    glob('**/*', {cwd: r[0]}, group());
                }
            });

        }, function(err, globs) {
            // Removes any other files
            globs = (globs) ? globs.map(function(files) {
                return files.filter(function(f) {
                    return (/\.js$|\.ejs$|\.hbs$/.test(f));
                });
            }) : null;

            // Matches files back to their folders
            trees.forEach(function(t,i) {
                var files = globs[i].map(function(f) {
                    return join(javascripts[t][0], f);
                });
                javascripts[t] = files;
            });

            javascripts = _.flatten(javascripts);
            javascripts.push(reqPath);

            if (force) compile(javascripts, destPath, next);
            else {
                var compiled = fs.existsSync(destPath);
                if (!compiled || compiled.code === ENOENT || compiled === {}) {
                // JS has not been compiled, compile it!
                    compile(javascripts, destPath, next);
                } else {
                // Compare modified times to last compile time
                    var compiledTime = fs.statSync(destPath).mtime,
                        shouldCompile = false;
                    if (minify && compiledTime < timeLaunched) shouldCompile = true;
                    else javascripts.forEach(function(js) {
                        var mtime = fs.statSync(js).mtime;
                        if (mtime > compiledTime) shouldCompile = true;
                    });
                    if (shouldCompile) compile(javascripts, destPath, next);
                    else next();
                }
            }
        });
    }

    // Compile to destination path
    function compile(javascripts, path, next) {
        try {
            if (minify) minifyJS(javascripts, path, next);
            else concatenate(javascripts, path, next);
        } catch(ex) {
            return next(ex);
        }
    }

    // Concatenates requires for dev environment
    function concatenate(javascripts, path, cb) {
        var linesArr = [],
            nameArr = [],
            code = "";

        javascripts.forEach(function(file){
            var text = getCode(file);

            var lines = text.split(/\r\n|\r|\n/).length;
            linesArr.push(lines);
            nameArr.push(relative(src, file).replace(/\\/g,'/'));

            code +=
            "//=============================================\n" +
            "//" + file + "\n" +
            "//=============================================\n\n" +
            text + "\n\n";
        });

        // Add files & line numbers for debugging
        code += "// Line numbers for debugging\n" +
            "var gcp = gcp || {};\n" +
            "gcp.files = gcp.files || {};\n" +
            "gcp.files['/" +
            relative(join(dest,'..'), path).replace(/\\/g, '/') +
            "'] = [" +
            JSON.stringify(nameArr) + ", " +
            JSON.stringify(linesArr) + "];";

        fs.writeFile(path, code, 'utf8', cb);
    }

    // Minifies & writes to destination
    function minifyJS(javascripts, path, cb) {
        var code = "";
        javascripts.forEach(function(file){
            code += getCode(file) + '\n';
        });
        var result = uglify.minify(code, {
            fromString: true,
            mangle: mangle,
            compress: compress
        });
        fs.writeFile(path, result.code, 'utf8', cb);
    }

    // Gets file code, renders if file is a JST
    function getCode(file) {
        var code = '' + fs.readFileSync(file);
        if (/\.ejs$/.test(file)) code = jst.underscore(code, src, file);
        else if (/\.hbs$/.test(file)) code = jst.hbs(code, src, file);
        return code;
    }

    var HEADER = /(?:(\/\/.*\n*)|(\/\*([\S\s]*?)\*\/))+/;
    var DIRECTIVE = /^[\W]*=\s*(\w+.*?)(\*\\\/)?$/gm;

    // Gets required files from source
    function parseDirectives(code) {
        var match, header, words, command,
            directives = [];

        code = code.replace(/[\r\t ]+$/gm, '\n');
        match = HEADER.exec(code);
        header = match[0];

        if (!match) return [];

        while (match = DIRECTIVE.exec(header)) directives.push(match[1]);
        return directives;
    }

    function routeDirectives(code) {
        var files = [], end;
        parseDirectives(code).forEach(function(d, i) {
            var words = d.replace(/['"]/g, '').split(/\s+/),
                cmd = words[0],
                paths = words.length >= 2 ? [].slice.call(words, 1) : [];

            paths.forEach(function(p) {
                switch (cmd) {
                case 'require':
                case 'include':
                    p = p.replace(/\.js$|\.ejs$|\.hbs$|\s/g, '');
                    if (fs.existsSync(join(src, p + '.js'))) end = ".js";
                    else if (fs.existsSync(join(src, p + '.ejs'))) end = ".ejs";
                    else if (fs.existsSync(join(src, p + '.hbs'))) end = ".hbs";
                    else error(p + "' not found!");
                    files.push(join(src, p + end));
                    break;
                case 'require_tree':
                case 'requireTree':
                    files.push([join(src, p)]);
                }
            });
        });
        return files;
    }

    // Ignore ENOENT to fall through as 404
    function error(err) {
        console.log("JS Compiler error: '" + err);
        next(ENOENT === err.code ? null : err);
    }

    return middleware;
};
