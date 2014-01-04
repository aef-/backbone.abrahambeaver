var _ = require( "lodash" ),
    Experiment = require( "../models/experiment" ),
    Variant = require( "../models/variant" );

var actions = {
  start: function( req, res ) {
    var goal = req.query.goal,
        variantName = req.query.variantName,
        experimentName = req.query.experimentName,
        variantType = req.query.variantType;
    var e1 = new Experiment( {
      name: experimentName
    } );
    var v1 = new Variant( e1, {
      name: variantName,
      type: variantType
    } );
    _.bindAll( v1 );
    _.bindAll( e1 );

    e1.exists( )
      .then( function( exists ) {
        if( exists )
          return e1.loadAttributes( )
      } )
      .then( function( ) {
        if( e1.isRunning( ) );
          return v1.start( );
        return false;
      } )
      .done( function( ) {
        res.jsonp( { success: true } );
      } );
  },
  complete: function( req, res ) {
    var goal = req.query.goal,
        variantName = req.query.variantName,
        experimentName = req.query.experimentName;

    var e1 = new Experiment( {
      name: experimentName
    } );
    var v1 = new Variant( e1, {
      name: variantName
    } );
    _.bindAll( v1 );
    _.bindAll( e1 );

    v1.complete( goal )
      .done( function( ) {
        res.jsonp( { success: true } );
      } );
  }
};

module.exports = actions;
