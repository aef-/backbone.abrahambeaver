var db = require( "../../lib/db" ),
    client = db.client,
    redis = db.redis,
    Q = require( "q" ),
    _ = require( "lodash" ),
    check = require('validator').check;

var Experiment = function( attr ) {
  this._attributes = 
    _.defaults( attr, { 
      name: '',  //required
      startTime: null,
      createdAt: null,
      updatedAt: null,
      running: false,
      resettable: false,
      variants: [ ],
      goals: [ ],
      version: 0
    } );

  this.configKey = function( ) { return this.name + ":config" };
  this.attributesKey = function( ) { return this.name + ":attributes" };
  this.variantsKey = function( ) { return this.name + ":variants" };
  this.goalsKey = function( ) { return this.name + ":goals" };
  this.versionKey = function( ) { return this.name + ":version" };
  this.completedCountKey = function( ) { return this.name + ":completedCount" };

  this.load( );
};

Experiment.all = function( ) {
  return _.map( client.smembers( "experiments" ), Experiment.find );
};

Experiment.load = function( name ) {
  return Q.ninvoke( client, "exists", name )
  .then( function( exists ) {
    var experiment = null;
    if( exists ) {
      experiment = new Experiment( { name: name } );
      experiment.load( );
    } 
    return experiment;
  } );
};

Experiment.prototype = {
  load: function( ) {
    Q.ninvoke( client, "hgetall", this.configKey( ) )
     .then( function( err, config ) {
       this._attributes.resettable = config.resettable;
     } );

    Q.ninvoke( client, "hgetall", this.getKey( ) )
     .then( function( err, attr ) {
       this._attributes.startTime = attr.startTime;
       this._attributes.winner = attr.winner;
     } );

    this.loadVariants( );
    this.loadGoals( );
    this.loadVersion( );
  },

  getName: function( ) {
    return this._attributes.name;
  },

  getKey: function( ) {
    if( parseInt( this._attributes.version, 10 ) > 0 )
      return this.getName( ) + ":" + this._attributes.version;
    return this.getName( );
  },

  finishedKey: function( ) {
    return this.getKey( ) + ":finished";
  },

  start: function( ) {
    this._attributes.startTime = new Date( ).getTime( );
    client.hset( this.getKey( ), "startTime", this.getStartTime( ) );
  },

  save: function( ) {
    var goals, alternatives;

    check( this.getName( ) ).notEmpty( );

    Q.ninvoke( client, "exists", this.getName( ) )
    .then( function( exists ) {
      if( !exists ) {
        client.hset( this.getKey( ), "createdAt", new Date( ).getTime( ), redis.print );
        client.sadd( "experiments", this.getName( ) );
        _.each( this._attributes.variants, this.addVariant );
        _.each( this._attributes.goals, this.addGoal );
      }
      /*
      else {
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
      }
      */

      client.hset( this.configKey( ), "resettable", this.resettable, redis.print );
    } );

    return this;
  },

  incrementVersion: function( ) {
    var p = Q.ninvoke( client, "incr", this.versionKey );
    p.then( function( digit ) {
      this._attributes.version = digit;
    } );
    return p;
  },

  getVersion: function( ) {
    return this._attributes.version;
  },

  addVariant: function( variant ) {
    var p = Q.invoke( client, "rpush", this.variantsKey( ), variant );
    p.then( function( ) {
      this._attributes.variants.push( variant );
    } );
    return p; 
  },

  addGoal: function( goal ) {
    var p = Q.nivoke( client, "rpush", this.goalsKey( ), goal );
    p.then( function( ) {
      this._attributes.goals.push( goal );
    } );
    return p;
  },

  getStartTime: function( ) {
    return Q.ninvoke( client, "hget", this.getKey( ), "startTime" );
  },

  getWinner: function( ) {
    return Q.ninvoke( client, "hget", this.getKey( ), "winner" );
  },

  setWinner: function( variantName ) {
    return Q.ninvoke( client, "hget", this.getKey( ), "winner", variantName );
  },

  getVariants: function( ) {
    return this._attributes.variants;
  },

  loadVersion: function( ) {
    var p = Q.ninvoke( client, "get", this.versionKey( ) );
    p.then( function( err, verison ) { 
      this._attributes.version = parseInt( version, 10 ) || 0;
    } );
    return p; 
  },
  loadVariants: function( ) {
    var p = Q.ninvoke( client, "lrange", this.variantsKey( ), 0, -1 );
    p.then( function( err, variants ) { 
      this._attributes.variants = variants || [ ];
    } );
    return p;
  },

  getGoals: function( ) {
    return this._attributes.goals;
  },

  loadGoals: function( ) {
    var p = Q.ninvoke( client, "lrange", this.goalsKey( ), 0, -1 );
    p.then( function( err, goals ) {
      this._attributes.goals = goals || [ ];
    } );
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
    return Q.ninvoke( client, hdel, this.attributesKey( ), "winner" );
  },

  removeVariants: function( ) {
    _.each( this.getVariants( ), function( v ) {
      v.remove( );
    } ); 
  },

  removeGoals: function( ) {
    return Q.ninvoke( client, del, this.goalsKey( ) );
    
  }
};

module.exports = Experiment;
