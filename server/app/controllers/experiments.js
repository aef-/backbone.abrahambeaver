var _ = require( "lodash" ),
    Experiment = require( "../models/experiment" ),
    Variant = require( "../models/variant" );

var actions = {
  list: function( req, res ) {
    Experiment.all( )
      .done( function( e ) {
        console.info( e );
        res.render( "test/list" );
      } );
  }
};

module.exports = actions;
