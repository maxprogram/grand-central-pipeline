#!/usr/bin/env node

var _ = require('underscore'),
    path = require('path'),
    mkdirp = require('mkdirp'),
    argv = require('optimist').argv,
    gcp = require('../lib/gcp');

var cwd = path.join(process.cwd());

function compile() {
    if (!argv._[0]) return "Needs a file to compile (first argument)";
    var file = path.join(cwd, argv._[0]),
        minify = argv.minify || argv.min || false,
        all = argv.all || false,
        destDir, destFile;

    var compiler = new gcp.Compiler(file, {
        minify: minify,
        mangle: true,
        compress: true
    });

    if (argv._[1]) {
        destDir = path.dirname(path.join(cwd, argv._[1]));
        destFile = path.basename(argv._[1]).replace(/\.js$/,'');
    } else {
        destDir = path.dirname(file);
        destFile = path.basename(file).replace(/\.js$/,'');
    }

    mkdirp(destDir, function(err) {
        if (err) console.error("Error creating destination directory");
        else compiler.file.init(function(err) {
            if (err) return console.error(err);

            var concatPath = path.join(destDir, destFile+'.dist.js');
            var minPath = path.join(destDir, destFile+'.min.js');

            if (all || !minify) compiler.concatenate(concatPath, function(err) {
                if (err) return console.error(err);
                else console.log("Compiled to '"+path.relative(cwd, concatPath)+"'");
            });
            if (all || minify) compiler.minify(minPath, function(err) {
                if (err) return console.error(err);
                else console.log("Minified to '"+path.relative(cwd, minPath)+"'");
            });
        });
    });
}

compile();
