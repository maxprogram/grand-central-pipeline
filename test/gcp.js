var assert = require('assert'),
    path = require('path'),
    fs = require('fs'),
    express = require('express'),
    gcp = require('..'),
    supertest = require('supertest');

var source = path.join(__dirname, 'helpers'),
    dest = path.join(__dirname, 'javascripts'),
    app, request, config;

before(function(done) {
    fs.mkdirSync(dest);

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

    app.configure(function() {
        app.use(gcp({
            source: path.join(__dirname, 'helpers'),
            dest: dest
        }));
    });
    app.configure(config);
    request = supertest(app);
    done();
});

describe('grand-central-pipeline', function() {

it('should compile requested file', function(done) {
    request.get('/app.js')
        .set('Accept', 'application/javascript')
        .expect(200)
        .expect("content-type", /application\/javascript/)
        .expect(/Hello.World/)
        .end(done);
});

it('should compile required file', function(done) {
    request.get('/app.js')
        .set('Accept', 'application/javascript')
        .expect(200)
        .expect("content-type", /application\/javascript/)
        .expect(/included.file/)
        .end(done);
});

it('should compile javascript template', function(done) {
    request.get('/app.js')
        .set('Accept', 'application/javascript')
        .expect(200)
        .expect("content-type", /application\/javascript/)
        .expect(/jst\["tmp"\]/)
        .end(done);
});

it('should compile javascript template', function(done) {
    request.get('/app.js')
        .set('Accept', 'application/javascript')
        .expect(200)
        .expect("content-type", /application\/javascript/)
        .expect(/Batman/)
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
    request.get('/app.js')
        .set('Accept', 'application/javascript')
        .expect(200)
        .expect("content-type", /application\/javascript/)
        .expect(/a=88;console/)
        .end(done);
});

it('should allow change of template namespace', function(done) {
    request.get('/app.js')
        .set('Accept', 'application/javascript')
        .expect(200)
        .expect("content-type", /application\/javascript/)
        .expect(/temps\.tmp/)
        .end(done);
});

it('should return nothing if require doesnt exist', function(done) {
    request.get('/bizzaro.js')
        .set('Accept', 'application/javascript')
        .expect(200)
        .expect("content-type", /application\/javascript/)
        .expect("")
        .end(done);
});

});

after(function(done) {
    deleteFolderRecursive(dest, function(){
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
