var db = require( "../../lib/db" ),
    client = db.client,
    redis = db.redis,
    Q = require( "q" ),
    _ = require( "lodash" ),
    check = require('validator').check;
 

var _VARIANT_TYPES = [ "variant", "control" ];
var Variant = function( attr, experiment ) {
  this._uid = null;
  this._attributes =
    _.defaults( attr || { }, {
      name: '',  //required
      createdAt: new Date( ).toISOString( ),
      type: null, //control | variant
      startedCount: 0,
      completedCount: 0
    } );

  this._experiment = experiment;

  this.getKey = function( ) { return "variants:" + this._uid };
  this.getCompletedKey = function( goal ) {
    var key = this.getKey( );
    if( goal )
      key = key + ":" + goal;
    key = key + ":completedCount";
    return key;
  };
};

Variant.prototype = {
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
    check( this.getName( ), "Variant name is required in order to load" ).notEmpty( );

    return Q.ninvoke( client, "hget", this.getUidKey( ), "uid" )
      .then( _.bind( this._loadAttributes, this ) )
      .then( _.bind( this.loadVariants, this ) )
      .then( _.bind( this.loadGoals, this ) ); 
  },
  save: function( ) {
          console.info( this.getType( ) );
    check( this.getName( ), "Variant name is required in order to save" ).notEmpty( );
    check( this.getType( ), "Variant type is required to be 'control' or 'variant'" ).isIn( _VARIANT_TYPES );
    return this.exists( ).then( _.bind( this._createOrUpdate, this ) );
  },
  start: function( ) {
    return Q.ninvoke( client, "hincrby", this.getKey( ), "startedCount", 1 )
  },
  complete: function( ) {
    return Q.ninvoke( client, "hincrby", this.getKey( ), "completedCount", 1 )
  },
  conversionRate: function( goal ) {
    if( !this.getStartedCount( ) )
      return 0;
    return parseFloat( this.getCompletedCount( goal ) ) / parseFloat( this.getStartedCount( ) );
  },

  loadCompletedCount: function( goal ) {
    return parseInt( client.hget( this.getKey( ), this.completedKey( goal ) ), 10 );
  },

  loadStartedCount: function( ) {
    return parseInt( client.hget( this.getKey( ), "startedCount" ), 10 );
  },

  getCompletedCount: function( ) {
    return
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
  },
  destroy: function( ) {
    return this.exists( ).then( _.bind( this._destroy, this ) );
  },
  //private -- don't be a hero
  _destroy: function( exists ) {
    if( exists ) {
      var d = Q.defer( );
      var m = client.multi( );
      m.del( this.getKey( ) )
       .del( this.getCompletedKey( ) );

      _.each( this.experiment.getGoals( ), function( g ) {
        m.del( this.getCompletedKey( g ) );
      } );


      m.exec( function( err, results ) {
          if( typeof err === "array" && err.length )
            d.reject( new Error( err.join( ", " ) ) );
          else
            d.resolve( results );
        } );
    }
    return d; 
  },
  _create: function( ) {
    return Q.ninvoke( client, "incr", "global:nextVariantUid" )
      .then( _.bind( this._saveAttributes, this ) );
  },
  _createOrUpdate: function( exists ) {
    return exists ? this._create( ) : this._create( );
  },

  _setAttributes: function( attr ) {
    //this._setAttribute( "name", attr.name );
    this._setAttribute( "createdAt", attr.createdAt );
    this._setAttribute( "type", attr.type );
    this._setAttribute( "startedCount", attr.winner );
  }, 
  _loadAttributes: function( uid ) {
    this._uid = uid;
    if( ~uid )
      return Q.ninvoke( client, "hgetall", this.getKey( ) )
        .then( _.bind( this._setAttributes, this ) );
      else
        throw new Error( "Cannot load ", this.getName( ) , "does not exist" );
  },
  _saveAttributes: function( uid ) {
    var d = Q.defer( );
    this._uid = uid;
    client.multi( )
      .hset( this.getUidKey( ), "uid", this._uid )
      .hset( this.getKey( ), "name", this.getName( ) )
      .hset( this.getKey( ), "createdAt", this.getCreatedAt( ) )
      .hset( this.getKey( ), "type", this.getType( ) )
      .exec( function( err, results ) {
        if( err )
          d.reject( new Error( err ) );
        else
          d.resolve( results );
      } );
    return d;
  }, 
};

module.exports = Variant;
