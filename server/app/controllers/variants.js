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

    v1.save( )
      .then( function( ) {
        e1.addVariant( v1.getName( ) );
        return e1.save( );
      } )
      .then( v1.start )
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
    e1.addGoal( goal );

    e1.save( )
      .then( function( ) {
        v1.complete( goal );
      } )
      .done( function( ) {
        res.jsonp( { success: true } );
      } );
  }
};

module.exports = actions;
