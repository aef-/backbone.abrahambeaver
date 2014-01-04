/* Backbone.AbrahamBeaver v.pre
 * by aef- (http://github.com/aef-)
 */

( function( Backbone, _, $, undefined ) {
  var extend = Backbone.Model.extend,
      cookiePrefixes = {
        variant: "ABeaver_Variant_",
        completed: "ABeaver_Completed_",
      }; 

  var AB = Backbone.AB = {
        url: "http://localhost:4000",
        tests: { },
        expires: 600,
        _add: function( name, test ) {
          this.tests[ name ] = test;
          return this.tests[ name ];
        },
        complete: function( name, goal ) {
          if( name )
            this.tests[ name ].complete( goal );
        }
      };

  var View = Backbone.AB.View = function( opts ) {
    if( !this.variants.length )
      throw new Error( "Test ", this.name, " has no variants" );
    this.selected = this.loadVariant( );

    if( !this.selected ) {
      var variantWeightTotal = 0;
      _.each( this.variants, function( v ) {
        v.weight = v.weight || 1;
        variantWeightTotal += v.weight;
      } );

      var random = Math.ceil( Math.random( ) * variantWeightTotal );
      _.each( this.variants, function( v, i ) {
        random -= v.weight;
        if( random <= 0 ) {
          this.selected = i;
          return false;
        }
      }, this );

      this.start( );

      this.saveVariant( this.selected );
    }

    AB._add( this.name, this );

    return new this.variants[ this.selected ].view( opts );
  };

  View.extend = extend;

  View.prototype = {
    persist: true,
    reset: function( ) {
      $.removeCookie( cookiePrefixes.variant + this.name );
      $.removeCookie( cookiePrefixes.completed + this.name );
    },
    loadVariant: function( variantName ) {
      return $.cookie( cookiePrefixes.variant + this.name );
    },
    saveVariant: function( variantName ) {
      $.cookie( cookiePrefixes.variant + this.name, variantName, { expires: AB.expires } );
    },
    setCompletedCookie: function( ) {
      $.cookie( cookiePrefixes.completed + this.name, "1" );
    },
    hasCompleted: function( ) {
      return !!$.cookie( cookiePrefixes.completed + this.name );
    }, 
    complete: function( goal ) {
      if( this.hasCompleted( ) )
        return;

      $.ajax( AB.url + "/complete", {
        dataType: "jsonp",
        data: {
          experimentName: this.name,
          variantName: this.variants[ this.selected ].name, 
          goal: goal
        }
      } );

      if( this.persist )
        this.setCompletedCookie( );
      else
        this.reset( );
    },
    start: function( ) {
      var data = {
        experimentName: this.name,
        variantName: this.variants[ this.selected ].name
      };

      if( this.variants[ this.selected ].type === "control" )
        data.variantType = "control";

      $.ajax( AB.url + "/start", {
        dataType: "jsonp",
        data: data
      } );
    }
  };

  var Variant = Backbone.AB.Variant = function( options ) {
    _.defaults( this, options );
  };

} )( Backbone, _, $, undefined );
