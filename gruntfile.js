module.exports = function (grunt) {
  var data = require('./app/version.json')
  grunt.initConfig({
    watch: {
      client: {
        files: 'app/*.ts',
        tasks: [
          'exec:compile',
          'copy:bundle',
          'exec:aot',
        ],
        options: {
          debounceDelay: 1000,
        },
      },
    },
    exec: {
      nextVersion: {
        command: 'node tools/nextVersion',
      },
      index: {
        command: 'npm run index',
      },
      compileServer: {
        command: 'npm run compile-server',
      },
      compile: {
        command: 'npm run compile',
      },
      aot: {
        command: 'npm run aot',
      },
      generateSitemap: {
        command: 'npm run generateSitemap',
      },
      add: {
        command: 'git add .',
      },
      commit: {
        command: `git commit -m"Release v${data.version + 1}"`,
      },
      push: {
        command: 'git push azure master',
      },
    },
    copy: {
      bundle: {
        files: [
          { src: ['app/GA.js'], dest: 'aot/GA.js' },
          { src: ['dist/bundle.js'], dest: 'aot/bundle.js' },
          { src: ['dist/sw.js'], dest: 'aot/sw.js' },
        ],
      },
    },

  })

  grunt.loadNpmTasks('grunt-exec')
  grunt.loadNpmTasks('grunt-contrib-copy')
  grunt.loadNpmTasks('grunt-contrib-watch')

  grunt.registerTask('schema', [
    'exec:compileSchema',
    'exec:schema',
    'copy:schema',
  ])

  grunt.registerTask('server', [
    'exec:compileServer',
    // 'exec:generateSitemap',
  ])

  grunt.registerTask('client', [
    'exec:nextVersion',
    'exec:compile',
    'copy:bundle',
    'exec:aot',
  ])

  grunt.registerTask('default', [
    'schema',
    'server',
    'client',
  ])

  grunt.registerTask('release', [
    'default',
    'exec:add',
    'exec:commit',
    'exec:push',
  ])

}
