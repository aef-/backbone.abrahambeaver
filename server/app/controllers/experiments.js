var _ = require( "lodash" ),
    Experiment = require( "../models/experiment" ),
    Variant = require( "../models/variant" );

var actions = {
  add: function( req, res ) {
    if( req.body.experiment ) {
    }
    else
      res.render( "experiments/add" );
  },
  list: function( req, res ) {
    Experiment.all( )
      .done( function( e ) {
        res.render( "experiments/list", { experiments: _.invoke( e, "toJson" ) } );
      } );
  }
};

module.exports = actions;
