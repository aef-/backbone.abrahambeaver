var fs = require( "fs" ),
    path = require("path");
module.exports = function( appDir ) {
  var controllers = { },
      controller,
      controllerDir = path.join( appDir, "controllers" );
  fs.readdirSync( controllerDir ).forEach( function( name ) {
    var controller = require( path.join( controllerDir, name ) ),
        name = path.basename( controller.name || name, ".js" );
    controllers[ name ] = controller;
  } );

  return controllers;
};
