//Redis nonsense
var settings = require( "../settings" );

var redis = require( "redis" ),
    client = redis.createClient( settings.redis.port, settings.redis.host );

client.on( "error", function ( err ) {
  console.log( "Error " + err );
} ); 

module.exports.client = client;
module.exports.redis = redis;
