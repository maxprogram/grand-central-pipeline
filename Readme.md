# Grand Central Pipeline



## Documentation

### route(app, options)

__Options that can be specified:__

* ``
* ``

All client-side javascript goes in the __/client__ directory. When a file is requested, it is compiled into a single JS file in the public __/javascripts__ directory. Other javascipt files can be required using `//= require` or `//= require_tree`, which will be compiled into the requested file.

In the *development* environment, required JS files are concatenated and labeled as is. The GCE client-side library handles errors to return the correct file names and line numbers for debugging.

In *production*, they are minified using UglifyJS.

__/client/test.js__:
```js
//= require lib/jquery
//= require_tree ./ui

$(function(){ document.write("Hello World") });
```
This would output to __javascripts/test.js__, and will include the required files/directories in the order they are listed. It can be linked to in views as:
```html
<script type="text/javascript" src="javascripts/test.js"></script>
```
__Templating__

Javascript templating is also supported. Templates should go in the *client/templates* folder. GCE supports __Underscore (.ejs)__ and __Handlebars (.hbs)__ templates. The templates can be accessed through `app.jst['path/file']`.

So if your template's actual path was *client/templates/home/index.ejs* the corresponding Backbone code would be:
```js
var template = app.jst['home/index'];
this.$el.html(template({ DATA }));
```

A Handlebars file (.hbs) requires the [Handlebars runtime library](http://handlebarsjs.com/) not included in GCE. Each template is also a Handlbars partial with the name `path.file` that can be accessed with `{{> path.file}}`. So for the example below, the partial name would be `list`.

Template in *client/templates/list.hbs*, assuming the template (or folder) is required in app.js:
```html
<script type="text/javascript" src="javascripts/handlebars-runtime.js"></script>
<script type="text/javascript" src="javascripts/app.js"></script>
<script type="text/javascript">
    var template = app.jst['list'];
    $("#list").html(template({ DATA }));
</script>
```
