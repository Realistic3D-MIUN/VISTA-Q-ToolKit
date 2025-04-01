const express = require('express');
const pageRoutes = require('../routes/pageRoutes');
const apiRoutes = require('../routes/apiRoutes');
const error = require('../middleware/error');
const path = require('path')

module.exports = function(app) {
  app.use(express.json());
  app.use('/', pageRoutes);
  app.use('/api', apiRoutes);
  app.use(error);

  // Set two folders public which will be used to serve static content since we are not using any AWS bucket for images
  //app.use("/favicon.ico", express.static(path.join(__dirname,'/../public/favicon.ico')));
  app.use('/public',express.static(path.join(__dirname,'/../public')));
  //app.use('/uploads', express.static(path.join(__dirname,'/../uploads')));
}