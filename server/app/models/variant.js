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
  toJson: function( ) {
    var r = {
      name: this.getName( ),
      createdAt: this.getCreatedAt( ),
      type: this.getType( ),
      startedCount: this.getStartedCount( )
    };
    if( this.getExperiment( ).getGoals( ) )
      r.completedCount = 
        _.map( this._completedCountByGoal, function( v, i ) {
          return { name: i, count: v };
        }, this );
    else
      r.completedCount = this.getCompletedCount( );

    return r;
  },
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

    return this.loadAttributes( )
               .then( _.bind( this._setControlInExperiment, this ) )
               .then( _.bind( this.loadCompletedCount, this ) );
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
    return ( this.calculateConversionRate( goal ) * 100 );
  },
  getChangeRate: function( goal ) {
    var cr = this.calculateChangeRate( goal );
    if( cr )
      return ( cr * 100 );
    return null;
  },

  calculateConversionRate: function( goal ) {
    if( !this.getStartedCount( ) )
      return 0;
    return ( parseFloat( this.getCompletedCount( goal ) ) / parseFloat( this.getStartedCount( ) ) );
  },

  calculateChangeRate: function( goal ) {
    if( this.getExperiment( ).hasControl( ) ) {
      var t = this.getExperiment( ).getControl( ).calculateConversionRate( goal );
      if( t )
        return ( ( this.calculateConversionRate( goal ) - t ) / t );
    }
    return null;
  },
  getConversionRateConfidence: function( goal ) {
    return this.calculateConversionRateConfidence( goal ) * 100;
  },
  calculateConversionRateConfidence: function( goal ) {
    return 1.65 * this.calculateStandardError( goal );
  },

  loadAttributes: function( ) {
    return Q.ninvoke( client, "hgetall", this.getKey( ) )
      .then( _.bind( this._setAttributes, this ) ); 
  },

  loadCompletedCount: function( goal ) {
    if( this.getExperiment( ).hasGoals( ) )
      return this.loadCompletedCounts( );
    else
      return Q.ninvoke( client, "get", this.getCompletedKey( ) )
              .then( _.bind( this._setAttribute, this, "completedCount" ) );
  },

  loadCompletedCounts: function( ) {
    return Q.all( _.map( this.getExperiment( ).getGoals( ), this.loadCompletedCountByGoal, this ) );
  },

  loadCompletedCountByGoal: function( goal ) {
    return Q.ninvoke( client, "get", this.getCompletedKey( goal ) )
            .then( _.bind( function( count ) {
              this._completedCountByGoal[ goal ] = count || 0;
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
        return parseInt( this._completedCountByGoal[ goal ] || 0, 10 );
    else
      return parseInt( this._attributes.completedCount, 10 );
  },

  getStartedCount: function( ) {
    return parseInt( this._attributes.startedCount, 10 );
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
      .then( Q.all( _.map( this.getExperiment( ).getGoals( ), this._resetGoal ) ) );
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
    return this;
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
  },
  _setControlInExperiment: function( ) {
    if( this.getExperiment( ).hasControl( ) && this.isControl( ) )
      console.error( "Trying to set multiple controls." );
    if( this.isControl( ) )
      this.getExperiment( ).setControl( this );
  },
  calculateStandardError: function( goal ) {
    return Math.sqrt(
        ( this.calculateConversionRate( goal ) * ( 1 - this.calculateConversionRate( goal ) ) )
        / this.getStartedCount( ) );
  },
  calculateZScore: function( goal ) {
    var control = this.getExperiment( ).getControl( );
    return ( this.calculateConversionRate( goal ) - control.calculateConversionRate( goal ) ) /
      Math.sqrt( Math.pow( control.calculateStandardError( goal ), 2 ) + Math.pow( this.calculateStandardError( goal ), 2 ) );
  },
  getConfidenceLevel: function( goal ) {
    var z = Math.abs( this.calculateZScore( goal ) );
    if( z >= 2.58 )
      return 99;
    else if( z >= 1.96 )
      return 95;
    else if( z >= 1.65 )
      return 90;
    else
      return null;
  }
};

module.exports = Variant;
