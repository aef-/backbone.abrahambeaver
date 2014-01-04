var _ = require( "lodash" ),
    Experiment = require( "../app/models/experiment" ),
    Variant = require( "../app/models/variant" );

module.exports = {
  setUp: function( done ) {
    var self = this;
    this.experiment = new Experiment( );
    this.experiment.setName( "Variant Testing" );
    _.bindAll( this.experiment );
    this.experiment.save( )
      .then( function( ) {
        self.variant = new Variant( self.experiment );
        _.bindAll( self.variant );
        self.variant.setName( "Test Variant: Setup" );
        self.variant.save( )
        .done( function( ) {
          done( );
        } );
      } );
  },
  tearDown: function( done ) {
    var self = this;
    this.experiment.destroy( )
      .then( this.variant.destroy )
      .then( function( ) {
        self.variant.setName( "Test Variant: Setup" )
        return self.variant.destroy( );
      } )
      .fail( function( e ) {
        console.info( e );
      } )
      .done( done );
  },
  "should save": function( test ) {
    var self = this;
    self.variant.setName( "Test Variant: Save" );
    self.variant.setType( "variant" );
    self.variant.save( )
      .then( self.variant.exists )
      .then( function( exists ) {
        test.ok( exists, "Variant does not exist -- was not saved" );
      } )
      .fail( function( e ) {
        console.info( e );
        console.trace( );
        test.ifError( e );
      } )
      .done( test.done );
  },
  "should load": function( test ) {
    var var2, self = this;
    self.variant.setName( "Test Variant: Load" );
    self.variant.setType( "control" );
    self.variant.save( )
      .then( function( ) {
        var2 = new Variant( self.experiment, { name: "Test Variant: Load" } );
        return var2.load( );
      } )
      .then( function( ) {
        test.ok( var2.isControl( ), "Variant should be control" );
      } )
      .done( test.done );
  },
  "should start": function( test ) {
    var self = this;
    self.variant.setName( "Test Variant: Start" );
    self.variant.save( )
      .then( self.variant.start )
      .then( self.variant.start )
      .then( function( ) {
        test.equal( self.variant.getStartedCount( ), 2, "Started count should be two" );
      } )
      .done( test.done );
  },
  "should complete": function( test ) {
    var self = this;
    self.variant.setName( "Test Variant: Complete" );
    self.variant.save( )
      .then( function( ) {
        return self.variant.complete( );
      } )
      .then( function( ) {
        return self.variant.complete( );
      } ) 
      .then( function( t ) {
        test.equal( self.variant.getCompletedCount( ), 2, "Completed count should be two" );
      } )
      .done( test.done ); 
  },
  "should calculate conversion rate": function( test ) {
    var self = this;
    self.variant.setName( "Test Variant: Conversion Rate" );
    self.variant.save( )
      .then( self.variant.start )
      .then( self.variant.start )
      .then( self.variant.complete )
      .then( function( ) {
        test.equal( self.variant.getConversionRate( ), 0.5, "Conversion rate should be 0.5" );
      } )
      .done( test.done ); 
  },
  "should reset": function( test ) {
    var self = this;
    self.variant.setName( "Test Variant: Reset" );
    self.variant.save( )
      .then( self.variant.start )
      .then( self.variant.start )
      .then( self.variant.complete )
      .then( self.variant.reset )
      .then( function( ) {
        test.equal( self.variant.getCompletedCount( ), 0, "Completed count should be zeroed out" );
        test.equal( self.variant.getStartedCount( ), 0, "Started count should be zeroed out" );
      } )
      .done( test.done ); 
  },
  "should handle goals": function( test ) {
    var self = this, goals = [ "Goal1", "Goal2", "Goal3" ];
    self.variant.setName( "Test Variant: Goals" );
    self.experiment.addGoals( goals );
    self.experiment.addVariants( [ self.variant ] );
    self.experiment.save( )
      .then( self.variant.save )
      .then( self.variant.start )
      .then( self.variant.start )
      .then( self.variant.start )
      .then( self.variant.start )
      .then( self.variant.start )
      .then( self.variant.complete )
      .then( function( ) {
        return self.variant.complete( goals[ 0 ] );
      } )
      .then( function( ) {
        return self.variant.complete( goals[ 0 ] );
      } ) 
      .then( function( ) {
        return self.variant.complete( goals[ 2 ] );
      } )
      .then( function( ) {
        test.equal( self.variant.getStartedCount( ), 5, "Started count should be five" );
        test.equal( self.variant.getCompletedCount( ), 1, "Completed count should be 1 without goal defined" );
        test.equal( self.variant.getCompletedCount( goals[ 0 ] ), 2, "Completed count should be 2 for goal " + goals[ 0 ] );
        test.equal( self.variant.getCompletedCount( goals[ 1 ] ), 0, "Completed count should be 0 for goal " + goals[ 1 ] );
        test.equal( self.variant.getCompletedCount( goals[ 2 ] ), 1, "Completed count should be 1 for goal " + goals[ 2 ] );
        test.equal( self.variant.getConversionRate( ), 0.2, "Conversion rate should be 0.2 for completed without goal" );
        test.equal( self.variant.getConversionRate( goals[ 0 ] ), 0.4, "Conversion rate should be 0.4 for goal " + goals[ 0 ] );
        test.equal( self.variant.getConversionRate( goals[ 1 ] ), 0, "Conversion rate should be 0 for goal " + goals[ 1 ] );
        test.equal( self.variant.getConversionRate( goals[ 2 ] ), 0.2, "Conversion rate should be 0.2 for goal " + goals[ 2 ] );
      } )
      .then( self.variant.reset )
      .then( function( ) {
        _.each( goals, function( g ) {
          test.equal( self.variant.getCompletedCount( g ), 0, "Completed count for goal '" + g + "' should be zeroed out" );
        } );
        test.equal( self.variant.getCompletedCount( ), 0, "Completed count for no goal should be zeroed out" );
        test.equal( self.variant.getStartedCount( ), 0, "Started count should be zeroed out" );
      } )
      .done( test.done ); 
  }
};
