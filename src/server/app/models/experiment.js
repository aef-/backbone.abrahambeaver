var db = require( "../../lib/db" ),
    client = db.client,
    redis = db.redis,
    Q = require( "q" ),
    _ = require( "lodash" ),
    check = require('validator').check;

function Experiment( attr ) {
  this._uid = null;
  this._attributes = _.defaults( attr || { }, { 
    name: '',  //required
    startedat: null,
    finishedAt: null,
    createdAt: new Date( ).getTime( ),
    resettable: false,
    variants: [ ],
    goals: [ ],
    version: 0
  } );

  this.getKey = function( ) { return "experiments:" + this._uid };
  this.getUidKey = function( ) { return "experiments:" + this.getName( ) };
  this.getVariantsKey = function( ) { return this.getKey( ) + ":variants" };
  this.getGoalsKey = function( ) { return this.getKey( ) + ":goals" };
  this.getExperimentsKey = function( ) { return "experiments" };
  this.getRunningKey = function( ) { return "experiments:running" };
  this.getFinishedKey = function( ) { return "experiments:finished" };
};

/*
Experiment.all = function( ) {
  return _.map( client.smembers( "experiments" ) );
};
*/

Experiment.prototype = {
  load: function( ) {
    check( this.getName( ) ).notEmpty( );

    return Q.ninvoke( client, "hget", this.getUidKey( ), "uid" )
      .then( _.bind( this._loadAttributes, this ) )
      .then( _.bind( this.loadVariants, this ) )
      .then( _.bind( this.loadGoals, this ) );
  },

  getName: function( ) {
    return this._attributes.name;
  },

  getKey: function( ) {
    if( parseInt( this._attributes.version, 10 ) > 0 )
      return "experiments:" + this._uid + ":" + this._attributes.version;
    return "experiments:" + this._uid;
  },

  start: function( ) {
    this._attributes.startedAt = new Date( ).getTime( );
    var d = Q.defer( );

    client.multi( )
      .hset( this.getKey( ), "startedAt", this.getStartedAt( ) )
      .sadd( this.getRunningKey( ), this._uid )
      .exec( function( err, results ) {
        if( typeof err === "array" && err.length )
          d.reject( new Error( err.join( ", " ) ) );
        else
          d.resolve( results );
      } );

    return d;
  },

  finish: function( ) {
    this._attributes.finishedAt = new Date( ).getTime( );
    var d = Q.defer( );

    client.multi( )
      .hset( this.getKey( ), "finishedAt", this.getFinishedAt( ) )
      .srem( this.getRunningKey( ), this._uid )
      .sadd( this.getFinishKey( ), this._uid )
      .exec( function( err, results ) {
        if( typeof err === "array" && err.length )
          d.reject( new Error( err.join( ", " ) ) );
        else
          d.resolve( results );
      } );

    return d; 
  },
 
  save: function( ) {
    check( this.getName( ) ).notEmpty( );
    return this.exists( ).then( _.bind( this._createOrUpdate, this ) );
  },

  incrementVersion: function( ) {
    var p = Q.ninvoke( client, "incr", this.getVersionKey( ) );
    return p.then( _.bind( this._setAttribute, this, "version" ) );
  },

  getVersion: function( ) {
    return this._attributes.version;
  },

  saveVariant: function( variant ) {
    var p = Q.invoke( client, "sadd", this.getVariantsKey( ), variant );
    return p.then( _.bind( this._addVariant, this, variant ) );
  },

  saveGoal: function( goal ) {
    var p = Q.invoke( client, "sadd", this.getGoalsKey( ), goal );
    return p.then( _.bind( this._addGoal, this, goal ) );
  },

  addVariants: function( variants ) {
    _.each( variants, this.addVariant );
  },

  addVariant: function( variant ) {
    this._addVariant( variant, true );
  },

  addGoals: function( goals ) {
    _.each( goals, this.addGoal );
  },

  addGoal: function( goal ) {
    this._addGoal( goal, true );
  },

  isRunning: function( ) {
    return !!this.getStartedAt( ) && !this.getFinishedAt( );
  },

  getCreatedAt: function( ) {
    return this._attributes.createdAt;
  },

  setResettable: function( bool ) {
    this._attributes.resettable = bool;
  },

  isResettable: function( ) {
    return this._attributes.resettable;
  },

  getFinishedAt: function( ) {
    return this._attributes.finishedAt;
  },
  getStartedAt: function( ) {
    return this._attributes.startedAt;
  },

  getWinner: function( ) {
    return this._attributes.winner;
  },

  saveWinner: function( variantName ) {
    return Q.ninvoke( client, "hget", this.getKey( ), "winner", variantName );
  },

  setName: function( name ) {
    this._attributes.name = name;
  },

  getVariants: function( ) {
    return this._attributes.variants;
  },

  loadVariants: function( ) {
    var p = Q.ninvoke( client, "lrange", this.getVariantsKey( ), 0, -1 );
    p.then( _.bind( function( variants ) {
      this._attributes.variants = variants || [ ];
    }, this ) );
    return p;
  },

  getGoals: function( ) {
    return this._attributes.goals;
  },

  loadGoals: function( ) {
    var p = Q.ninvoke( client, "smembers", this.getGoalsKey( ) );
    p.then( _.bind( function( goals ) {
      this._attributes.goals = goals || [ ];
    }, this ) );
    return p;
  },

  reset: function( ) {
    this._attributes.variants.each( function( v ) {
      v.reset( );
    } );
    this.resetWinner( );
    this.incrementVersion( );
  },

  resetWinner: function( ) {
    return Q.ninvoke( client, "hdel", this.getKey( ), "winner" );
  },

  removeVariants: function( ) {
    _.each( this.getVariants( ), function( v ) {
      v.remove( );
    } ); 
  },

  removeGoals: function( ) {
    return Q.ninvoke( client, "del", this.getGoalsKey( ) );
  },

  destroy: function( ) {
    return this.exists( ).then( _.bind( this._destroy, this ) );
  },

  exists: function( ) {
    return Q.ninvoke( client, "exists", this.getKey( ) );
  },

  //private, don't be a hero
  _destroy: function( exists ) {
    if( exists ) {
      var d = Q.defer( );
      client.multi( )
        .del( this.getKey( ) )
        .del( this.getUidKey( ) )
        .del( this.getVariantsKey( ) )
        .del( this.getGoalsKey( ) )
        .srem( this.getRunningKey( ), this._uid )
        .srem( this.getFinishedKey( ), this._uid )
        .srem( this.getExperimentsKey( ), this._uid )
        .exec( function( err, results ) {
          if( typeof err === "array" && err.length )
            d.reject( new Error( err.join( ", " ) ) );
          else
            d.resolve( results );
        } );
    }
    return d;
  },
  _create: function( ) {
    return Q.ninvoke( client, "incr", "global:nextExperimentUid" )
      .then( _.bind( this._saveAttributes, this ) )
      .then( _.bind( function( ) {  
      }, this ) )
      .then( _.bind( function( ) {
        return Q.all( _.each( this._attributes.goals, this.saveGoal, this ) )
      }, this ) );
  },
  _saveAttributes: function( uid ) {
    var d = Q.defer( );
    this._uid = uid;
    client.multi( )
      .hset( this.getUidKey( ), "uid", this._uid )
      .hset( this.getKey( ), "name", this.getName( ) )
      .hset( this.getKey( ), "createdAt", this.getCreatedAt( ) )
      .hset( this.getKey( ), "resettable", this.isResettable( ) )
      .hset( this.getKey( ), "version", this.getVersion( ) )
      .exec( function( err, results ) {
        if( err )
          d.reject( new Error( err ) );
        else
          d.resolve( results );
      } );
    return d;
  },

  _update: function( ) {
             /*
    var goals, alternatives;
    goals = this.loadGoals( );
    variants = this.loadVariants( );
    client.hset( this.getKey( ), "updatedAt", new Date( ).getTime( ), redis.print );
    if( this._attributes.variants.diff( variants ).length > 0 &&
        this._attributes.goals.diff( goals ).length > 0 ) {
      this.reset( );
      this.removeVariants( );
      this.removeGoals( );
      client.del( this.variantsKey( ) );

      _.each( this._attributes.variants, this.addVariant );
      if( !this._attributes.goals.length )
        _.each( this._attributes.goals, this.addGoal );
    } 
    Q.ninvoke( client "hset", this.configKey( ), "resettable", this.resettable )
    */
  },
  _createOrUpdate: function( exists ) {
    return exists ? this._create( ) : this._create( );
  },
  _setAttributes: function( attr ) {
    this._setAttribute( "startedAt", attr.startedAt );
    this._setAttribute( "finishedat", attr.finishedAt );
    this._setAttribute( "createdAt", attr.createdAt );
    this._setAttribute( "resettable", attr.resettable );
    this._setAttribute( "winner", attr.winner );
    this._setAttribute( "version", attr.version );
  },
  _setAttribute: function( key, value ) {
    this._attributes[ key ] = value;
  },
  _addVariant: function( variant, success ) {
    if( success )
      this._attributes.variants.push( variant );
    else {
      console.trace( );
      console.error( "Error: There was a problem adding variant: ", variant );
    }
  },
  _addGoal: function( goal, success ) {
    if( success )
      return this._attributes.goals.push( goal );
    else {
      console.trace( );
      throw new Error( "There was a problem adding goal: ", goal );
    }
  },
  _loadAttributes: function( uid ) {
    this._uid = uid;
    if( ~uid )
      return Q.ninvoke( client, "hgetall", this.getKey( ) )
        .then( _.bind( this._setAttributes, this ) );
      else
        throw new Error( "Cannot load ", this.getName( ) , "does not exist" );
  }
};

module.exports = Experiment;
