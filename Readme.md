# Grand Central Pipeline

A javascript asset pipeline for Node and Express. Uses Rails-like syntax for requiring and concatenating javascript files. Minifies using UglifyJS in production environments.

## Documentation

### route(app, options)

__Options that can be specified:__

* `source` (*required*) : the directory of the actual javascript files to be compiled.
* `dest` (*required*) : the directory you want the compiled javascript to be stored & requested from.
* `force` (default `false`) : set to true to force compilation whenever javascript is reloaded. Normally it only compiles when a file has changed.
* `minify` (default `false`) : set to true to minify all javascript. If not present, GCP minifies in __production__ and concatenates in __development__.
* `templateName` (default `jst`) : the name of the global client-side object that stores all javascript templates.

Example code in your `app.js` file or wherever you initialize your Express app:
```js
var express = require('express'),
    path = require('path'),
    gcp = require('grand-central-pipeline'),
    app = express();

app.configure(function(){
    app.use(gcp({
        source: path.join(__dirname, 'client'),
        dest: path.join(__dirname, 'public/javascripts')
    }));
    // It's best to put the GCP middleware above Express's static asset pipline:
    app.use(express.static(path.join(__dirname, 'public')));
});
```

All client-side javascript goes in the __source__ directory (`/client` in this case). When a file is requested, it is compiled into a single JS file in the public __dest__ directory (`/public/javascripts` in this case).

Other javascipt files can be required using `//= require` or `//= require_tree`, which will be compiled into the requested file.

In the __development__ environment, required JS files are concatenated and labeled as is. In __production__, they are minified using UglifyJS.

Example in `client/sample.js`:
```js
//= require lib/jquery
//= require_tree ./ui
//= requireTree ./models

$(function(){ document.write("Hello World") });
```
This would output to `javascripts/sample.js`, and will include the required files/directories in the order they are listed. It can be linked to in views as:
```html
<script type="text/javascript" src="javascripts/sample.js"></script>
```

If `javascripts/folder/sample.js` is requested by the client, the corresponding source file should be in `client/folder/sample.js`.

### Templating

Javascript templating is also supported. GCP supports __Underscore (.ejs)__ and __Handlebars (.hbs)__ templates. Any files *required* by the requested JS (as in using `//= require sample.hbs`, not requesting the actual template) with those extensions will be compiled.

The templates can be accessed through `jst['path/file']` or whatever template name you provide in the options.

So if your template's actual path was *client/templates/home/index.ejs* the corresponding client-side javascript would be:
```js
var template = jst['templates/home/index'];
$("div").html(template({ JSONDATA }));
```

Make sure you have the appropriate client-side libraries for templating:

* [Underscore.js](http://underscorejs.org/)
* [Handlebars runtime library](http://handlebarsjs.com/). Each template is also a Handlbars partial with the name `path.file` that can be accessed with `{{> path.file}}`. So for the example below, the partial name would be `list`.

Template in *client/templates/list.hbs*, assuming the template (or folder) is required in app.js:
```html
<script type="text/javascript" src="javascripts/handlebars-runtime.js"></script>
<script type="text/javascript" src="javascripts/app.js"></script>
<script type="text/javascript">
    var template = jst['templates/list'];
    $("#list").html(template({ DATA }));
</script>
```

### Client-side Debugging

[WORK IN PROGRESS] The GCP client-side library handles errors to return the correct file names and line numbers for debugging.

### Miscellaneous

If you don't want a `.js` file to be compiled, add __"_skip"__ to the filename. So `file_skip.js` will be passed over. This also works for folders, so `/files_skip/app.js` and anything in that folder will be skipped.

Use the option `templateDir` if you have a single folder with templates in your __source__ directory. So with the option `templateDir: 'templates'`, the file `project.hbs` within `source/templates` will be called on the client-side with `jst['project']`. You still need to `//= require_tree ./templates` for this to work.
