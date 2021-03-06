"use strict";

const config = require('./config/database');

const Promise = require("bluebird");

const mongoose = require('mongoose');
mongoose.Promise = Promise;
mongoose.connect(config.db.uri);

const fs = require('fs');
Promise.promisifyAll(fs);

const path = require('path');

const rt = require('read-torrent');

const Torrent = require('./models/Torrent.js');

const bunyan = require("bunyan");
const logger = bunyan.createLogger({name: "loader"});

const chokidar = require("chokidar");

const TORRENT_PATH = `${__dirname}/torrent`;
const watcher = chokidar.watch(`${TORRENT_PATH}/*.torrent`);

watcher.on("add", (fsfile) => {
  return new Promise((resolve, reject) => {
    rt(fsfile, (err, ftorrent) => {
      if(err) {
        reject(err)
      }
      resolve(ftorrent);
    })
  })
  .then(ftorrent => [ftorrent, Torrent.findById(ftorrent.infoHash).exec()])
  .spread((ftorrent, res) => (res) ? Promise.reject("TEXISTS") : Promise.resolve(ftorrent))
  .then(ftorrent => {
    return [ftorrent, new Torrent({
      '_id': ftorrent.infoHash,
      'title': ftorrent.name,
      'details': ftorrent.announce,
      'size': ftorrent.length,
      'files': ftorrent.files.map(f => f.path),
      'imported': new Date()
    }).save()]
  })
  .spread((ftorrent, res) => Promise.resolve(logger.info(`File ${ftorrent.infoHash} added`)))
  .catch(err => (err==="TEXISTS") ? Promise.resolve(logger.info(`File ${fsfile} already loaded`)) : Promise.reject(err))
  .then(() => fs.unlinkAsync(fsfile))
  .catch(err => Promise.reject(logger.error(err)))
});
