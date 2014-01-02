var _ = require( "lodash" ),
    Experiment = require( "../models/experiment" ),
    Variant = require( "../models/variant" );

var actions = {
  list: function( req, res ) {
    var e1 = new Experiment( { 
      name: "Experiment 1"
    } );
    var e2 = new Experiment( { 
      name: "Experiment 2"
    } );
    var e3 = new Experiment( { 
      name: "Experiment 3"
    } );
    var e4 = new Experiment( { 
      name: "Experiment 4"
    } );
    var v1 = new Variant( e1, {
      name: "Variant 1",
      type: "control"
    } );
    var v2 = new Variant( e1, {
      name: "Variant 2"
    } );

    _.bindAll( v1 );
    _.bindAll( v2 );
    _.bindAll( e1 );
    _.bindAll( e2 );
    _.bindAll( e3 );
    _.bindAll( e4 );

    e1.addVariant( v1 );
    e1.addVariant( v2 );
    v1.save( )
      .then( v2.save )
      .then( e1.save )
      .then( e2.save )
      .then( e3.save )
      .then( e4.save )
      .done( function( ) {
        res.render( "test/list" );
      } );
  }
  start: function( req, res ) {
    var varName = req.body.variantName,
        expName = req.body.experimentName;

    var e = new Experiment( { name: expName } ),
        v = new Variant( e, { name: varName } );
    v.start( ).done( function( ) {
      // return json res..
    } );
  },
  complete: function( req, res ) {
    var varName = req.body.variantName,
        expName = req.body.experimentName,
        goal = req.body.goal;

    var e = new Experiment( { name: expName } ),
        v = new Variant( e, { name: varName } );
    v.complete( goal ).done( function( ) {

      // return json res..
    } );
  } 
};

module.exports = actions;
