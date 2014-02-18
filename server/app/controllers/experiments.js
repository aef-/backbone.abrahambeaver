var _ = require( "lodash" ),
    Q = require( "q" ),
    Experiment = require( "../models/experiment" ),
    Variant = require( "../models/variant" );

var actions = {
  complete: function( req, res ) {
    var variantName = req.query.variantName;
  },
  show: function( req, res ) {
    var experimentName = decodeURIComponent( req.params.experiment );
    var e = new Experiment( {
      name: experimentName
    } ),
    variants = null;

    e.load( )
      .then( function( ) {
        variants = _.map( e.getVariantNames( ), function( name ) {
          return new Variant( e, { name: name } );
        } );
        return Q.all( _.invoke( variants, "load" ) );
      } )
      .done( function( a ) {
        console.info( a );
        res.render( "experiments/show", {
          experiment: e,
          variants: variants
        } );
      } );
  },
  list: function( req, res ) {
    Experiment.all( )
      .done( function( e ) {
        res.render( "experiments/list", { experiments: e } );
      } );
  }
};

module.exports = actions;
