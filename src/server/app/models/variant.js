var db = require( "../../lib/db" ),
    client = db.client,
    redis = db.redis,
    Q = require( "q" ),
    _ = require( "lodash" ),
    check = require('validator').check;
 

var _VARIANT_TYPES = [ "variant", "control" ];
var Variant = function( experiment, attr ) {
  this._attributes =
    _.defaults( attr || { }, {
      name: '',  //required
      createdAt: new Date( ).getTime( ),
      type: "variant", //control | variant
      startedCount: 0,
      completedCount: 0
    } );

  this._completedCountByGoal = {
  };

  this._experiment = experiment;

  this.getKey = function( ) { 
    return "exp:" + this.getExperiment( ).getName( ) + ":var:" + this.getName( ) 
  };

  this.getCompletedKey = function( goal ) {
    var key = this.getKey( );
    if( goal )
      key = key + ":" + goal;
    key = key + ":completedCount";
    return key;
  };

  check( this.getExperiment( ), "Variants require an experiment to be instantiated" ).notEmpty( );
};

Variant.prototype = {
  toString: function( ) {
    return "Variant: " + this.getName( );
  },
  exists: function( ) {
    return Q.ninvoke( client, "exists", this.getKey( ) );
  },
  getName: function( ) {
    return this._attributes.name;
  },
  setName: function( name ) {
    this._attributes.name = name;
  },
  setType: function( type ) {
    this._attributes.type = type;
  },
  getType: function( ) {
    return this._attributes.type;
  },
  getExperiment: function( ) {
    return this._experiment;
  },
  load: function( ) {
    check( this.getExperiment( ), "Variants require an experiment in order to load" ).notEmpty( );
    check( this.getName( ), "Variant name is required in order to load" ).notEmpty( );

    return this.loadAttributes( );//load completed count?
  },
  save: function( ) {
    check( this.getName( ), "Variant name is required in order to save" ).notEmpty( );
    check( this.getType( ), "Variant type is required to be one of [" + _VARIANT_TYPES.join( ", " ) + "]" )
      .isIn( _VARIANT_TYPES );
    return this.exists( ).then( _.bind( this._createOrUpdate, this ) );
  },
  start: function( ) {
    return Q.ninvoke( client, "hincrby", this.getKey( ), "startedCount", 1 )
            .then( _.bind( this._setAttribute, this, "startedCount" ) );
  },
  complete: function( goal ) {
    return Q.ninvoke( client, "incr", this.getCompletedKey( goal ) )
            .then( _.bind( function( count ) {
              if( goal )
                this._completedCountByGoal[ goal ] = count;
              else
                this._attributes.completedCount = count;
            }, this ) );
  },
  getConversionRate: function( goal ) {
    if( !this.getStartedCount( ) )
      return 0;
    return parseFloat( this.getCompletedCount( goal ) ) / parseFloat( this.getStartedCount( ) );
  },

  loadAttributes: function( ) {
    return Q.ninvoke( client, "hgetall", this.getKey( ) )
      .then( _.bind( this._setAttributes, this ) ); 
  },

  loadCompletedCount: function( goal ) {
    if( this.getExperiment( ).getGoals( ).length )
      return this.loadCompletedCounts( );
    else
      return Q.ninvoke( client, "hget", this.getCompletedKey( ) )
              .then( _.bind( this._setAttribute, this, "completedCount" ) );
  },

  loadCompletedCounts: function( ) {
    return Q.all( _.each( this.getExperiment( ).getGoals( ), this.loadCompletedCountByGoal ) );
  },

  loadCompletedCountByGoal: function( goal ) {
    return Q.ninvoke( client, "hget", this.getCompletedKey( goal ) )
            .then( _.bind( function( count ) {
              this._completedCountByGoal[ goal ] = count;
            }, this ) );
  },

  getCreatedAt: function( ) {
    return this._attributes.createdAt;
  },

  getCompletedCount: function( goal ) {
    if( goal )
      if( !~this.getExperiment( ).getGoals( ).indexOf( goal ) )
        throw new Error( "Trying to get count of goal '" + goal +"' which is not part of the experiment" );
      else
        return this._completedCountByGoal[ goal ] || 0;
    else
      return this._attributes.completedCount;
  },

  getStartedCount: function( ) {
    return this._attributes.startedCount;
  },

  getUnfinishedCount: function( goal ) {
    return this.getStartedCount( ) - this.getCompletedCount( goal );
  },

  isControl: function( ) {
    return this.getType( ) === "control";
  },

  reset: function( ) {
    return Q.ninvoke( client, "hset", this.getKey( ), "startedCount", 0 )
      .then( _.bind( this._setAttribute, this, "startedCount", 0 ) )
      .then( _.bind( this.resetCompletedCounts, this ) );
  },

  resetCompletedCounts: function( ) {
    return this._resetGoal( )
      .then( Q.all( _.each( this.getExperiment( ).getGoals( ), this._resetGoal ) ) );
  },
  destroy: function( ) {
    return this.exists( ).then( _.bind( this._destroy, this ) );
  },

  //private -- don't be a hero
  _resetGoal: function( goal ) {
    return Q.ninvoke( client, "del", this.getCompletedKey( goal ) )
            .then( _.bind( function( ) {
              if( goal )
                this._completedCountByGoal[ goal ] = 0;
              else
                this._attributes.completedCount = 0; 
            }, this ) );
  },

  _destroy: function( exists ) {
    var d = Q.defer( );
    if( exists ) {
      var m = client.multi( );
      m.del( this.getKey( ) )
       .del( this.getCompletedKey( ) );

      _.each( this.getExperiment( ).getGoals( ), function( g ) {
        m.del( this.getCompletedKey( g ) );
      }, this );


      m.exec( function( err, results ) {
        if( typeof err === "array" && err.length )
          d.reject( new Error( err.join( ", " ) ) );
        else
          d.resolve( );
      } );
    }
    else
      d.reject( new Error( "Cannot destroy Variant which does not exist" ) );

    return d.promise;
  },
  _create: function( ) {
    return this._saveAttributes( );
  },
  _createOrUpdate: function( exists ) {
    return exists ? this._create( ) : this._create( );
  },
  _setAttribute: function( key, value ) {
    this._attributes[ key ] = value;
  },

  _setAttributes: function( attr ) {
    this._setAttribute( "name", attr.name );
    this._setAttribute( "createdAt", attr.createdAt );
    this._setAttribute( "type", attr.type );
    this._setAttribute( "startedCount", attr.startedCount );
  },
  _saveAttributes: function( ) {
    var d = Q.defer( );
    client.multi( )
      .hset( this.getKey( ), "name", this.getName( ) )
      .hset( this.getKey( ), "createdAt", this.getCreatedAt( ) )
      .hset( this.getKey( ), "type", this.getType( ) )
      .exec( function( err, results ) {
        if( err )
          d.reject( new Error( err ) );
        else
          d.resolve( results );
      } );
    return d.promise;
  }
};

module.exports = Variant;
