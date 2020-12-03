const okta = require('@okta/okta-sdk-nodejs');
const onfido = require('@onfido/api');
 
const oktaClient = new okta.Client({
 orgUrl: process.env.OKTA_ORG_URL,
 token: process.env.OKTA_TOKEN,
});
 
const onfidoClient = new onfido.Onfido({
 apiToken: process.env.ONFIDO_TOKEN,
 region: onfido.Region.US,
});

/// Gets an Okta user by login id or email
const getOktaUser = (userId) => {
 return oktaClient.getUser(userId).then((response) => {
   return response;
 });
};

/// updates an Okta user with either the Onfido applicant id or the status of an IDV check
const updateOktaUser = (userId, applicantId, idvStatus) => {
 const user = { profile: {} };
 if (applicantId !== '') {
   user.profile.onfidoApplicantId = applicantId;
 };
 if (idvStatus !== '') {
   user.profile.onfidoIdvStatus = idvStatus;
 };
 return oktaClient.partialUpdateUser(userId, user, {}).then((response) => {
   return response;
 });
};

/// gets an Okta user by their Onfido applicantId
const getOktaUserByApplicant = async (applicantId) => {
  let user;
  await oktaClient.listUsers({ search: `profile.onfidoApplicantId eq "${applicantId}"` }).each((oktaUser) => {
   if (oktaUser.profile.onfidoApplicantId === applicantId) {
     user = oktaUser;
   }
 });
 return user;
};
 
/// creates an Onfido applicant based off a firstName, lastName, email
const createOnfidoApplicant = (firstName, lastName, email) => {
 return onfidoClient.applicant.create({ firstName, lastName, email }).then((response) => {
   return response;
 });
};

/// creates an Onfido SDK Token for a specific applicant
const createOnfidoSDKToken = (applicantId) => {
 return onfidoClient.sdkToken.generate({ applicantId, referrer: '*://*/*'}).then((response) => {
   return response;
 });
};

/// creates a Onfido check for an applicant with default document and facial_similarity_photo reports
const createOnfidoCheck = (applicantId) => {
 return onfidoClient.check.create({ applicantId, reportNames: ['document, facial_similarity_photo']}).then((response) => {
   return response;
 });
};
 
/// gets the result of an Onfido check based on the check id
const getOnfidoCheckResult = (checkId) => {
 return onfidoClient.check.find(checkId).then((response) => {
   return response;
 });
};
 
const services = {
 getOktaUser,
 updateOktaUser,
 getOktaUserByApplicant,
 createOnfidoApplicant,
 createOnfidoSDKToken,
 createOnfidoCheck,
 getOnfidoCheckResult
};
 
module.exports = services;
