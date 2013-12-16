var Experiment = require( "../models/experiment" ),
    Variant = require( "../models/variant" );

var actions = {
  list: function( req, res ) {

    var e = new Experiment( { 
      name: "This is a test experiment2"
    } );

    var v1 = new Variant( {
      experimentName: e.getName( ),
      name: "Testing out login without big button",
      type: "control"
    } );
    v1.save( );
    e.addVariant( v1 );

    console.info( e.getVariants( ) );
    
    res.render( "test/list" );
  }
};

module.exports = actions;
