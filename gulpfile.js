var browserify = require('browserify');
var connect = require('gulp-connect');
var gulp = require('gulp');
var path = require('path');
var rename = require('gulp-rename');
var source = require('vinyl-source-stream');
var stylus = require('gulp-stylus');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');

var PATH = {
  src: './src',
  main: 'element.js',
  stylus: 'element.styl',
  srcFiles: './src/**/*',
  dist: './dist',
  distFileJS: 'brick-select.js',
  distFileCSS: 'brick-select.css'
};

gulp.task('build', ['browserify', 'stylus', 'compress']);

gulp.task('browserify', function () {
  browserify({debug: true})
    //.add(path.join(PATH.src, PATH.main))
    .add(PATH.src + '/' + PATH.main)
    .bundle()
    .pipe(source(PATH.distFileJS))
    .pipe(gulp.dest(PATH.dist));
});

gulp.task('stylus', function () {
  gulp.src(path.join(PATH.src,PATH.stylus))
    .pipe(stylus())
    .pipe(concat(PATH.distFileCSS))
    .pipe(gulp.dest(PATH.dist));
});

gulp.task('compress', function () {
  gulp.src(path.join(PATH.dist,PATH.distFileJS))
    .pipe(uglify())
    .pipe(rename(function (file) {
      file.basename += '-min';
    }))
    .pipe(gulp.dest(PATH.dist));
});

gulp.task('connect', function() {
  connect.server({
    port: 3001
  });
});

gulp.task('watch', function () {
  gulp.watch(PATH.srcFiles, ['build']);
});

gulp.task('server', ['build','connect','watch']);
