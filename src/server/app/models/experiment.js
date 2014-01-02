var db = require( "../../lib/db" ),
    client = db.client,
    redis = db.redis,
    Q = require( "q" ),
    _ = require( "lodash" ),
    check = require('validator').check;

function Experiment( attr ) {
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

  this.getKey = function( ) { 
    if( parseInt( this.getVersion( ), 10 ) > 0 )
      return "exp:" + this.getName( ) + ":" + this.getVersion( );
    return "exp:" + this.getName( );
  };
  this.getVariantsKey = function( ) { return this.getKey( ) + ":variants" };
  this.getGoalsKey = function( ) { return this.getKey( ) + ":goals" };
  this.getExperimentsKey = function( ) { return "experiments" };
  this.getRunningKey = function( ) { return "exps:running" };
  this.getFinishedKey = function( ) { return "exps:finished" };
};

Experiment.running = function( ) {
  var experiments = [ ];
  return Q.ninvoke( client, "smembers", this.getRunningKey( ) )
          .then( function( expNames ) {
            _.each( expNames, function( name ) { 
              experiments.push( new Experiment( { name:e } ) );
            } );
            experiments.sortBy( experiments, function( e ) {
              return -e.getCreatedAt( );
            } );
            return experiments;
          } );
};

/*
Experiment.findInactive = function( ) {
  return Q.ninvoke( client, "sinter", 
};
*/

Experiment.prototype = {
  toString: function( ) {
    return "Experiment: " + this.getName( );
  }, 
  load: function( ) {
    check( this.getName( ) ).notEmpty( );

    return this.loadAttributes( )
      .then( _.bind( this.loadVariants, this ) )
      .then( _.bind( this.loadGoals, this ) );
  },

  getName: function( ) {
    return this._attributes.name;
  },

  start: function( ) {
    this._attributes.startedAt = new Date( ).getTime( );
    var d = Q.defer( );

    client.multi( )
      .hset( this.getKey( ), "startedAt", this.getStartedAt( ) )
      .sadd( this.getRunningKey( ), this.getName( ) )
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
      .srem( this.getRunningKey( ), this.getName( ) )
      .sadd( this.getFinishKey( ), this.getName( ) )
      .exec( function( err, results ) {
        if( typeof err === "array" && err.length )
          d.reject( new Error( err.join( ", " ) ) );
        else
          d.resolve( results );
      } );

    return d; 
  },
 
  save: function( ) {
    check( this.getName( ), "Experiment name is required in order to save" ).notEmpty( );
    return this.exists( ).then( _.bind( this._createOrUpdate, this ) );
  },

  incrementVersion: function( ) {
    return Q.ninvoke( client, "incr", this.getVersionKey( ) )
            .then( _.bind( this._setAttribute, this, "version" ) );
  },

  getVersion: function( ) {
    return this._attributes.version;
  },

  saveVariant: function( variant ) {
    return Q.invoke( client, "sadd", this.getVariantsKey( ), variant.getName( ) );
  },

  saveGoal: function( goal ) {
    return Q.invoke( client, "sadd", this.getGoalsKey( ), goal );
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

  setWinner: function( variantName ) {
    return Q.ninvoke( client, "hget", this.getKey( ), "winner", variantName )
            .then( _.bind( this._setAttribute, this, "winner", variantName ) );
  },

  setName: function( name ) {
    this._attributes.name = name;
  },

  getVariants: function( ) {
    return this._attributes.variants;
  },

  loadAttributes: function( ) {
    return Q.ninvoke( client, "hgetall", this.getKey( ) )
            .then( _.bind( this._setAttributes, this ) );
  }, 
  loadVariants: function( ) {
    return Q.ninvoke( client, "smembers", this.getVariantsKey( ) )
            .then( _.bind( function( variants ) {
              this._attributes.variants = variants || [ ];
            }, this ) );
  },

  getGoals: function( ) {
    return this._attributes.goals;
  },

  loadGoals: function( ) {
    return Q.ninvoke( client, "smembers", this.getGoalsKey( ) )
            .then( _.bind( function( goals ) {
              this._attributes.goals = goals || [ ];
            }, this ) );
  },

  reset: function( ) {
    return Q.all( this.getVariants( ).each( function( v ) {
      v.reset( );
    } ) )
    .then( this.resetWinner )
    .then( this.incrementVersion );
  },

  resetWinner: function( ) {
    return Q.ninvoke( client, "hdel", this.getKey( ), "winner" );
  },

  removeVariants: function( ) {
    return _.each( this.getVariants( ), function( v ) {
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
    var d = Q.defer( );
    if( exists ) {
      client.multi( )
        .del( this.getKey( ) )
        .del( this.getVariantsKey( ) )
        .del( this.getGoalsKey( ) )
        .srem( this.getRunningKey( ), this.getName( ) )
        .srem( this.getFinishedKey( ), this.getName( ) )
        .srem( this.getExperimentsKey( ), this.getName( ) )
        .exec( function( err, results ) {
          if( typeof err === "array" && err.length )
            d.reject( new Error( err.join( ", " ) ) );
          else
            d.resolve( );
        } );
    }
    else
      d.reject( new Error( "Cannot destroy experiment which does not exist" ) );

    return d.promise;
  },
  _create: function( ) {
    return Q.fcall( _.bind( this._saveAttributes, this ) )
      .then( _.bind( function( ) {
        return Q.all( _.each( this._attributes.variants, this.saveVariant, this ) );
      }, this ) )
      .then( _.bind( function( ) {
        return Q.all( _.each( this._attributes.goals, this.saveGoal, this ) )
      }, this ) );
  },
  _saveAttributes: function( ) {
    var d = Q.defer( );
    client.multi( )
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
    return d.promise;
  },

  _update: function( ) {
    this._create( );
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
    Q.ninvoke( client, "hset", this.configKey( ), "resettable", this.resettable )
    */
  },

  _createOrUpdate: function( exists ) {
    return exists ? this._update( ) : this._create( );
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
  }
};

module.exports = Experiment;
