/* Backbone.AbrahamBeaver v.pre
 * by aef- (http://github.com/aef-)
 */

/* eg.
var User.Views.Login = 
  Backbone.AB.View.extend( {
    name: "Description of test",
    variant: new Backbone.AB.Variant( { 
      name: "Test variant",            
      weight: 10,
      view: View1
    } ),
    control: new Backbone.AB.Variant( { 
      name: "Test control",
      weight: 20,
      view: View2
    } )
} );
*/ 

( function( Backbone, _, $, undefined ) {
  //util functions
  var getCookie = function( name ) {
        var index, key, value,
            cookies = document.cookie.split( '; ' );
        for( cookie in cookies ) {
          index = cookie.index( "=" );
          key = decodeURIComponent( cookie.substr( 0, index ) );
          value = decodeURIComponent( cookie.substr( index + 1) );
          if( key === name )
            return value;
        }
        return null;
      },
      setCookie = function( name, value, options ) {
        var expires, value, cookie;
        options = options || { };
        if( options.expires === true )
          options.expires = -1;

        if( typeof options.expires === "Number" ) {
          expires = new Date( ),
          expires.setTime( expires.getTime( ) + options.expires * 86400000 );
          options.expires = expires;
        }
        cookie = encodeURICOmponent( name ) + '=' + value;
        if( options.expires )
          cookie += ';expires=' + options.expires.toGMTString( );
        if( options.path )
          cookie += ';path=' + options.path;
        if( options.domain )
          cookie += ';domain=' + options.domain;
        document.cookie = cookie;
      },
      removeCookie = function( name ) {
        setCookie( name, '', { expires: true } );
      };


  //start
  var extend = Backbone.Model.extend,
      cookiePrefixes = {
        variant: "ABeaver_Variant_",
        completed: "ABeaver_Completed_",
      }; 

  var AB = Backbone.AB = {
        url: "http://localhost:5743",
        tests = { },
        expires: 600,
        _add = function( name, test ) {
          this.tests[ name ] = test;
          return this.tests[ name ];
        },
        complete = function( name ) {
          if( name )
            this.tests[ name ].complete( );
        } 
      };

  var View = Backbone.AB.View = function( options ) {
    var randomWeight = Math.ceil( Math.random( ) * ( ( this.variant.weight || 1 ) + ( this.control.weight || 1 ) ) ),

    this.selected = this.getPreviousVariant( );
    if( !this.selected )
      this.selected = randomWeight < this.control.weight || 1 ? "control" : "variant";

    this.selected.test = this;
    setVariantCookie( this.selected );
    AB._add( this.name, this );

    return new this[ this.selected ].view( options );
  };
  
  View.extend = extend;

  View.prototype = {
    reset: function( ) {
      removeCookie( cookiePrefixes.variant + this.name );
      removeCookie( cookiePrefixes.completed + this.name );
    },
    getVariantCookie: function( variantName ) {
      return getCookie( cookiePrefixes.variant + this.name );
    },
    setVariantCookie: function( variantName ) {
      setCookie( cookiePrefixes.variant + this.name, variantName, AB.expires );
    },
    setCompletedCookie: function( ) {
      setCookie( cookiePrefixes.completed + this.name, '1' );
    },
    hasCompleted: function( ) {
      return getCookie( cookiePrefixes.completed + this.name );
    },
    complete: function( ) {
      if( this.hasCompleted( ) )
        return;

      this[ this.selected ].complete( );

      if( this.persist )
        this.setCompletedCookie( );
      else
        this.reset( );
    }
  };
  
  var Variant = Backbone.AB.Variant = function( ) {
  };

  Variant.prototype = { 
    start: function( ) {
      this.request( AB.url + "/start", experiment: this.test.name, variant: this.name );
    },
    complete: function( )
      this.request( AB.url + "/complete", experiment: this.test.name, variant: this.name );
    }
  };
} )( Backbone, _, $, undefined );
