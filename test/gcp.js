var assert = require('assert'),
    path = require('path'),
    fs = require('fs'),
    express = require('express'),
    gcp = require('../lib/index'),
    supertest = require('supertest');

var source = path.join(__dirname, 'helpers'),
    dest = path.join(__dirname, 'assets'),
    app, request, config;

before(function(done) {
    app = express();
    config = function(){
        app.use(express.static(dest));
        app.use(function(req, res) {
            res.statusCode = 404;
            res.end("Not found");
        });
        app.use(function(err, req, res, next) {
            console.error(err);
            res.statusCode = 500;
            res.end("Internal server error");
        });
    };

    var GCP = gcp({
        source: path.join(__dirname, 'helpers'),
        dest: dest
    });

    app.configure(function() {
        app.use(GCP);
    });
    app.configure(config);
    request = supertest(app);
    done();
});

describe('grand-central-pipeline', function() {

it('should get other assets normally', function(done) {
    request.get('/nocompile.js')
        .set('Accept', 'application/javascript')
        .expect(200)
        .expect("content-type", /application\/javascript/)
        .expect(/requested/)
        .end(done);
});

it('should compile requested file', function(done) {
    request.get('/javascripts/app.js')
        .set('Accept', 'application/javascript')
        .expect(200)
        .expect("content-type", /application\/javascript/)
        .expect(/Hello.World/)
        .end(done);
});

it('should compile nested file', function(done) {
    request.get('/javascripts/tree/gamma.js')
        .set('Accept', 'application/javascript')
        .expect(200)
        .expect("content-type", /application\/javascript/)
        .expect(/g.=.3/)
        .end(done);
});

it('should compile required file', function(done) {
    request.get('/javascripts/app.js')
        .set('Accept', 'application/javascript')
        .expect(200)
        .expect("content-type", /application\/javascript/)
        .expect(/included.file/)
        .end(done);
});

it('should compile javascript template', function(done) {
    request.get('/javascripts/app.js')
        .set('Accept', 'application/javascript')
        .expect(200)
        .expect("content-type", /application\/javascript/)
        .expect(/jst\["tmp"\]/)
        .end(done);
});

it('should compile included file', function(done) {
    request.get('/javascripts/app.js')
        .set('Accept', 'application/javascript')
        .expect(200)
        .expect("content-type", /application\/javascript/)
        .expect(/b.=.2/)
        .end(done);
});

it('should compile required directory', function(done) {
    request.get('/javascripts/folders.js')
        .set('Accept', 'application/javascript')
        .expect(200)
        .expect("content-type", /application\/javascript/)
        .expect(/a.=.1/)
        .expect(/b.=.2/)
        .end(done);
});

it('should compile required tree', function(done) {
    request.get('/javascripts/folders.js')
        .set('Accept', 'application/javascript')
        .expect(200)
        .expect("content-type", /application\/javascript/)
        .expect(/g.=.3/)
        .expect(/d.=.4/)
        .end(done);
});

it('should minify javascript', function(done) {
    app = express();
    app.configure(function() {
        app.use(gcp({
            source: source,
            dest: dest,
            force: true,
            minify: true,
            templateName: 'temps'
        }));
    });
    app.configure(config);
    request = supertest(app);
    request.get('/javascripts/app.js')
        .set('Accept', 'application/javascript')
        .expect(200)
        .expect("content-type", /application\/javascript/)
        .expect(/b=2;console/)
        .end(done);
});

it('should allow change of template namespace', function(done) {
    request.get('/javascripts/app.js')
        .set('Accept', 'application/javascript')
        .expect(200)
        .expect("content-type", /application\/javascript/)
        .expect(/temps\.tmp/)
        .end(done);
});

it('should return nothing if require doesnt exist', function(done) {
    request.get('/javascripts/bizzaro.js')
        .set('Accept', 'application/javascript')
        .expect(200)
        .expect("content-type", /application\/javascript/)
        .expect("")
        .end(done);
});

});

after(function(done) {
    deleteFolderRecursive(path.join(dest, 'javascripts'), function(){
        done();
    });
});

function deleteFolderRecursive(path, callback) {
    fs.readdirSync(path).forEach(function(file){
        var curPath = path + "/" + file;
        if(fs.statSync(curPath).isDirectory()) { // recurse
            deleteFolderRecursive(curPath);
        } else { // delete file
            fs.unlinkSync(curPath);
        }
    });
    fs.rmdir(path, callback);
}
