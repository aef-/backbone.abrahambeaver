var _ = require( "lodash" ),
    Experiment = require( "../app/models/experiment" ),
    Variant = require( "../app/models/variant" );

module.exports = {
  setUp: function( done ) {
    this.experiment = new Experiment( );
    this.variant = new Variant( this.experiment );
    _.bindAll( this.experiment );
    done( );
  },
  tearDown: function( done ) {
    this.experiment.destroy( )
      .fail( function( e ) {
        console.trace( ); 
        console.info( e );
      } ).done( done );
  },
  "should save": function( test ) {
    var self = this;
    self.experiment.setName( "Test Variant: Save" );
    self.experiment.save( )
      .then( self.experiment.exists )
      .then( function( exists ) {
        test.ok( exists, "Experiment does not exist -- was not saved" );
      } )
      .fail( function( e ) {
        console.info( e );
        console.trace( );
        test.ifError( e );
      } )
      .done( test.done );
  },
  "should set defaults": function( test ) {
    var self = this;
    self.experiment.setName( "Test Experiment: Check Config" );
    self.experiment.save( )
      .then( function( ) {
        test.equal( self.experiment.isRunning( ), false, "Test should not be running by default" );
        test.equal( self.experiment.isResettable( ), false, "Test should not be resettable by default" );
        test.equal( self.experiment.getVersion( ), 0, "Test should start on version 0" );
      } )
      .done( test.done );
  },
  "should load": function( test ) {
    var exp2;
    var self = this,
        goals = [ "goal1", "goal2", "goal3", "goal4" ],
        variants = [ new Variant( self.experiment, { name: "LoadVar1" } ), new Variant( self.experiment, { name: "LoadVar2" } ) ];
    self.experiment.setName( "Test Experiment: Load" );
    self.experiment.setResettable( true );
    self.experiment.addGoals( goals );
    self.experiment.addVariants( variants );
    self.experiment.save( )
      .then( function( ) {
        exp2 = new Experiment( { name: "Test Experiment: Load" } );
        return exp2.load( );
      } )
      .then( function( ) {
        test.ok( !_.difference( goals, exp2.getGoals( ) ).length, 
          "Expected goals: " + goals.join( ", " ) + " do not match received goals: " + exp2.getGoals( ).join( ", " ) );
        test.ok( exp2.getVariants( ).length === variants.length, 
          "Expected variants: " + variants.join( ", " ) + " do not match received variants: " + exp2.getVariants( ).join( ", " ) );
        test.ok( exp2.isResettable( ), "Experiment should be resettable" );
      } )
      .done( test.done );
  }/*
  "should reset": function( test ) {
    var self = this;
    self.experiment.setName( "Test Experiment: Reset" );
    self.experiment.save( )
  }
  */
};
