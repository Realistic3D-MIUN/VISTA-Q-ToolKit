const _ = require('lodash');
const express = require('express');
const Joi = require('joi');
const formidable = require('formidable');
const path = require('path');
const fs = require('fs');
const {spawn} = require('child_process');
const router = express.Router();


router.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '/../views/homepage.html'));
});
//===========================
// Monocular Data
//===========================
router.get('/mono', function (req, res) {
  res.sendFile(path.join(__dirname, '/../views/mono.html'));
});
router.get('/mono_train', function (req, res) {
  res.sendFile(path.join(__dirname, '/../views/mono_train.html'));
});


router.get('/mono360', function (req, res) {
  res.sendFile(path.join(__dirname, '/../views/mono_360.html'));
});
router.get('/mono360_train', function (req, res) {
  res.sendFile(path.join(__dirname, '/../views/mono_360_train.html'));
});


router.get('/mono_video', function (req, res) {
  res.sendFile(path.join(__dirname, '/../views/mono_video.html'));
});
router.get('/mono_video_train', function (req, res) {
  res.sendFile(path.join(__dirname, '/../views/mono_video_train.html'));
});


router.get('/mono_360_video', function (req, res) {
  res.sendFile(path.join(__dirname, '/../views/mono_360_video.html'));
});
router.get('/mono_360_video_train', function (req, res) {
  res.sendFile(path.join(__dirname, '/../views/mono_360_video_train.html'));
});


router.get('/mono_double', function (req, res) {
  res.sendFile(path.join(__dirname, '/../views/mono_double.html'));
});


//===========================
// Stereo Data
//===========================
router.get('/stereo', function (req, res) {
  res.sendFile(path.join(__dirname, '/../views/stereo.html'));
});
router.get('/stereo_train', function (req, res) {
  res.sendFile(path.join(__dirname, '/../views/stereo_train.html'));
});


router.get('/stereo_video', function (req, res) {
  res.sendFile(path.join(__dirname, '/../views/stereo_video.html'));
});

router.get('/stereo_video_train', function (req, res) {
  res.sendFile(path.join(__dirname, '/../views/stereo_video_train.html'));
});

//===========================
// Light Field Data
//===========================
router.get('/lightfield', function (req, res) {
  res.sendFile(path.join(__dirname, '/../views/lightfield.html'));
});

router.get('/lightfield_focus', function (req, res) {
  res.sendFile(path.join(__dirname, '/../views/lightfield_focus.html'));
});

router.get('/lightfield_train', function (req, res) {
  res.sendFile(path.join(__dirname, '/../views/lightfield_train.html'));
});

router.get('/lightfield_focus_train', function (req, res) {
  res.sendFile(path.join(__dirname, '/../views/lightfield_focus_train.html'));
});


//===========================
// Mixed Data
//===========================
router.get('/mixed', function (req, res) {
  res.sendFile(path.join(__dirname, '/../views/mixed.html'));
});

module.exports = router;