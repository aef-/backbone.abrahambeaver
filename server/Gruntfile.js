module.exports = function(grunt) {
  grunt.initConfig({
    watch: {
      express: {
        files: [ '**/*.js' ],
        tasks: [ 'express:dev' ],
        options: {
          spawn: false
        }
      }
    },
    express: {
      options: {
        port: 3000,
        background: false
      },
      dev: {
        options: {
          script: './app.js'
        }
      },
      prod: {
        options: {
          script: './app.js',
          node_env: 'production',
          background: true
        }
      },
      test: {
        options: {
          script: './app.js',
        }
      }
    },
    nodeunit: {
      all: [ "tests/*.js" ],
      options: {
        reporter: "default",
        reporterOutput: true
      }
    }
  } );

  grunt.loadNpmTasks( "grunt-express-server" );
  grunt.loadNpmTasks( "grunt-contrib-watch" );
  grunt.loadNpmTasks( "grunt-contrib-nodeunit" );
  grunt.registerTask( "server", [ "express:dev", "watch" ] );
};
