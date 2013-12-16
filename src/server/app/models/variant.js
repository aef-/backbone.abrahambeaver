var db = require( "../../lib/db" ),
    client = db.client,
    redis = db.redis,
    _ = require( "lodash" ),
    check = require('validator').check,
    experiment = require( "./experiment" );

var Variant = function( attr, experimentName ) {
  this._attributes = 
    _.defaults( attr, { 
      name: '',  //required
      createdAt: new Date( ).toISOString( ),
      type: null, //control | variant
      startedCount: 0,
      completedCount: 0,
      experimentName: experimentName
    } );  
    this.experiment = null;

    this.load( );
};

Variant.prototype = {
  getKey: function( ) {
    return this.getExperimentName( ) + ":" + this.getName( );
  },
  getExperiment: function( ) {
    var experiment;
    client.exists( this.getExperimentName( ), _.bind( function( exists ) {
      if( exists )
        this.experiment = Experiment.load( this.getExperimentName( ) );
    }, this ) );
  },
  getName: function( ) {
    return this._attributes.name;
  },
  getType: function( ) {
    return this._attributes.type;
  },
  getExperimentName: function( ) {
    return this._attributes.experimentName;
  },
  load: function( ) {
    check( this.getType( ) ).notEmpty( );
    check( this.getExperimentName( ) ).notEmpty( );

    //var attr = client.hgetall( this.getKey( ) );

  },
  save: function( ) {
    check( this.getName( ) ).notEmpty( );
    check( this.getType( ) ).notEmpty( );
    check( this.getExperimentName( ) ).notEmpty( );

    client.exists( this.getKey( ), _.bind( function( exists ) { 
      if( exists )
        client.hset( this.getKey( ), "updatedAt", this.createdAt( ) );
      client.hsetnx( this.getKey( ), "createdAt", new Date( ).getTime( ), redis.print );
      client.hsetnx( this.getKey( ), "type", this.getType( ) );
      client.hsetnx( this.getKey( ), "startedCoutn", 0 );
      client.hsetnx( this.getKey( ), "completedCount", 0 );

    }, this ) );
  },
  start: function( ) {
    //incr start count
  },
  complete: function( ) {
    //incr complete count
  },
  conversionRate: function( goal ) {
    if( !this.getStartedCount( ) )
      return 0;
    return parseFloat( this.getCompletedCount( goal ) ) / parseFloat( this.getStartedCount( ) );
  },

  completedKey: function( goal ) {
    var key = "completedCount";
    if( goal )
      key = key + ":" + goal;
    return key;
  },

  getCompletedCount: function( goal ) {
    return parseInt( client.hget( this.getKey( ), this.completedKey( goal ) ), 10 );
  },

  getStartedCount: function( ) {
    return parseInt( client.hget( this.getKey( ), "startedCount" ), 10 );
  },

  getUnfinishedCount: function( ) {
    return this.getStartedCount( ) - this.getCompletedCount( );
  },

  isControl: function( ) {
    return this.getType( ) === "control";
  },

  reset: function( ) {
    client.hmset( this.getKey( ), "startedCount", 0, "completedCount", 0 );
    if( !this.experiment.getGoals( ).length )
      this.resetGoals( );
  },

  resetGoal: function( goal ) {
    return client.hset( this.getKey( ), this.completedKey( goal ), 0 );
  },
  resetGoals: function( ) {
    _.each( this.experiment.getGoals( ), this.resetGoal );
  } 
};

module.exports = Variant;
