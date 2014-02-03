var express = require( "express" ),
    http = require( "http" ),
    path = require( "path" ),
    settings = require( "./settings" ),
    app = express( ),
    appDir = path.join( __dirname, "app" );

var controllers = require( "./lib/controllers" )( appDir );

//helpers
app.locals._ = require( 'lodash' );
app.locals._str = require( 'underscore.string' );
app.locals.moment = require( 'moment' );

app.set( "port", process.env.PORT || settings.server.port );
app.set( "views", path.join( appDir, "views" ) );
app.set( "view engine", "jade" );
app.use( express.favicon(  ) );
app.use( express.logger( "dev" ) );
app.use( express.json(  ) );
app.use( express.urlencoded(  ) );
app.use( express.methodOverride(  ) );
app.use( app.router );
app.use( express.static( path.join( __dirname, "public" ) ) );

// development only
if ( "development" == app.get( "env" ) ) {
  app.use( express.errorHandler( ) );
}

//API
//app.post( "/complete/:name" );

//Routes
app.get( "/", controllers.experiments.list );
app.get( "/experiments/:experiment", controllers.experiments.show );
//here are json calls
app.get( "/start", controllers.variants.start );
app.get( "/complete", controllers.variants.complete );
app.get( "/finish", controllers.experiments.finish );
//app.get( "/", testController.list  );

http.createServer( app ).listen( app.get( "port" ), function(  ){
  console.log( "Express server listening on port " + app.get( "port" ) );
} );
