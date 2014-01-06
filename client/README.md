# Backbone.AbrahamBeaver Client

## Installation

Include the contents of src and lib on your website.
Ensure backbone.abrahambeaver server is running.

## Usage

Coming soon

## Example

Take a view you would like to change, it can be any component. In this example we'll be testing whether blue or red links result in more people logging into our site.

We start with our view, which could be referenced in various different spots throughout the code.

```js
var NavView = Backbone.View.extend( {
  className: "blue",
  template: '<a href="#">Login</a> | <a href="#">Leave</a>',
  events: {
    "click a": "onClick"
  },
  render: function( ) {
    this.$el.html( this.template );
    this.$el.addClass( this.className );
  },
  onClick: function( e ) {
    var action = $( e.target ).text( );
    if( action === "Login" )
      showLoginModal( );
    else
      leave( );
  }
} );
  
```

We then define our experiment, rename some variables and create a new variant.

```js
var NavBlue = Backbone.View.extend( {
  className: "blue",
  ....
} );

var NavRed = NavBlue.extend( {
  className: "red"
} );

NavView =
  Backbone.AB.View.extend( {
    name: "Are red links better for user engagement?",
    variants: [
      new Backbone.AB.Variant( {
        name: "Blue Link",
        weight: 1,
        type: "control",
        view: NavBlue
      } ),
      new Backbone.AB.Variant( {
        name: "Red Link",
        weight: 1,
        view: NavRed
      } )
    } );
```

This is done so no other change is required in the code for objects referencing NavView. NavView will load either of the variants based on their weight.

The last thing we need to do is add a line of code defining when a test has been completed. This can be done in various different spots.

```js
var NavBlue = Backbone.View.extend( {
  className: "blue",
  ....
  onClick: function( e ) {
    var action = $( e.target ).text( );
    Backbone.AB.complete( "Are red links better for user engagement?", action ); // action is the goal, it is not required
    if( action === "Login" )
      showLoginModal( );
    else
      leave( );
  }
} );

## License

(The MIT License)

Copyright (c) 2014 Adrian Fraiha &lt;aef+backbone.abrahambeaver@catch-colt.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
