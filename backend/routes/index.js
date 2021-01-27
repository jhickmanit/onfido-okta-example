var express = require('express');
var router = express.Router();

var { 
  updateOktaUser,
  createOnfidoApplicant,
  createOnfidoSDKToken,
  createOnfidoCheck,
  getOnfidoCheckResult
} = require('../services/api');

router.post('/applicant', function(req, res, next) {
  var user = req.body.user;
  req.session.user = user;
  createOnfidoApplicant(user.firstName, user.lastName, user.email).then((response) => {
    updateOktaUser(user.email, response.id, '').then((updated) => {
      return res.status(200).json({ applicantId: response.id });
    }).catch((error) => {
      return res.status(500).json({ isError: true, message: error });
    });
  }).catch((error) => {
    return res.status(500).json({ isError: true, message: error });
  });
});

router.post('/sdk', function(req, res, next) {
  var applicant = req.body.applicantId;
  createOnfidoSDKToken(applicant.applicantId).then((response) => {
    return res.status(200).json({ sdkToken: response });
  }).catch((error) => {
    return res.status(500).json({ isError: true, message: error });
  });
});

router.post('/check', function(req, res, next) {
  var applicant = req.body.applicantId;
  createOnfidoCheck(applicant.applicantId).then((response) => {
    return res.status(200).json({ checkStatus: response.status, id: response.id });
  }).catch((error) => {
    return res.status(500).json({ isError: true, message: error });
  });
});

router.post('/status', function(req, res, next) {
  var checkId = req.body.checkId;
  getOnfidoCheckResult(checkId).then((response) => {
    return res.status(200).json({ checkStatus: response.status, checkResult: response.result });
  }).catch((error) => {
    return res.status(500).json({ isError: true, message: error });
  });
});

router.post('/update', function(req, res, next) {
  var { user, checkResult } = req.body;
  updateOktaUser(user.email, '', checkResult).then((response) => {
    return res.status(200).json({ status: 'success'});
  }).catch((error) => {
    return res.status(500).json({ isError: true, message: error });
  });
});

module.exports = router;
