var path = require('path'),
    hbs = require('../jst/handlebars'),
    underscore = require('../jst/underscore');

exports.namespace = "jst";
exports.templateDir = "";

exports.handlebars = function(code, dir, name) {
    return render(hbs, code, dir, name);
};

exports.underscore = function(code, dir, name) {
    return render(underscore, code, dir, name);
};

exports._   = exports.underscore;
exports.hbs = exports.handlebars;

function render(engine, code, dir, name) {
    var ns = exports.namespace,
        templateDir = exports.templateDir,
        options = {
            namespace: ns,
            verbose: false
        };

    var output = 'var '+ns+' = '+ns+' || {};' +
        '\n(function(){\n';

    name = path.relative(path.join(dir, templateDir), name)
        .replace(/\\/g, '/')
        .replace(/\.ejs$|\.hbs$/, '');

    output += engine(options, name, code) + '})();';

    return output;
}
