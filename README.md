# Onfido and Okta Identity Verification Integration
This guide will walk you through setting up a custom application using Okta’s Sign-In Widget and Onfido’s SDK as an example of how Onfido’s Identity Verification (IDV) can be used with Okta to create a higher trust model around privileged application features.

## Pre-Requisites

An Okta account. If you do not have an Okta account, you can create a Developer Edition Account at [https://developer.okta.com/signup/](https://developer.okta.com/signup/)

An Onfido account. If you do not already have one, you can request a Sandbox Account at [https://onfido.com/signup/](https://onfido.com/signup/) 

NodeJS Development Environment (NodeJS 12+)

### Add an OpenID Connect Client in Okta

* Log into the Okta Developer Dashboard, and Create New App
* Choose Single Page App (SPA) as the platform, then populate your new OpenID Connect app with values similar to:

Setting | Value
------------ | -------------
App Name | Onfido Sample App (must be unique)
Login redirect URIs | http://localhost:3000/implicit/callback
Logout redirect URIs | http://localhost:3000/login
Allowed grant types | Authorization Code

> Note: CORS is automatically enabled for the granted login redirect URIs.

### Create an Onfido API Token
* Log into the Onfido Dashboard, select Developers tab from the side menu, select Tokens, and Generate API Token. 
* Set the Token scope for either Sandbox (recommended for this guide) or Live (production or Live Trial).
* Save the API Token generated in a secure location. You will not be able to retrieve this token value after exiting the pop-up window.

### Extend Okta User Profile
Create the following profile attributes:
* Onfido IDV Status
  - Data Type: string
  - Display Name: Onfido IDV Status
  - Variable Name: onfidoIdvStatus
* Onfido Applicant ID
  - Data Type: string
  - Display Name: Onfido Applicant ID
  - Variable Name: onfidoApplicantId

## Create Project Structure

Navigate to the directory where you will be developing this sample and create a new directory:
````bash
mkdir onfido-okta-example
````
Navigate into the newly created directory and create two more directories, one for the frontend (client side) and one for the backend (web server):
````bash
cd onfido-okta-example
mkdir frontend
mkdir backend
````
> Note: Set your git root to the onfido-okta-example directory to track your changes
> ````bash
> git init
> ````

## Creating the Backend
For simplicity we will be using NodeJS with Express to serve the frontend (client) and manage the API calls to both Okta and Onfido where necessary. With this in mind, we will use the [express-generator](https://expressjs.com/en/starter/generator.html) helper to create a default express application to start with.
Navigate to the backend directory:
````bash
cd backend
````
Now use the express application generator without a view engine option and install the express dependencies:
````bash
npx express-generator --no-view
npm install
````
Remove the following files:
````bash
routes/users.js
````
### Install Backend Dependencies
We will be using the Okta APIs and the Onfido APIs to process data and store information relating to the IDV process in our sample. In the backend we will be using the Okta NodeJS SDK and the Onfido Node SDK:
````bash
npm install @okta/okta-sdk-nodejs @onfido/api
````
We will also need to save some data in session for this sample, so we will use express-session:
````bash
npm install express-session
````
> Note: In production it is recommended to not use the default express-session settings we will cover here.

### Building the Service Layer
We need to manage the API requests between our application here and both Onfido’s and Okta’s APIs.

Create a new folder in the root of the backend project named services and a file in the directory called api.js.

````bash
mkdir services
cd services
touch api.js
````
Open the newly created `api.js ` and we will create the following:
````javascript
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
````

### Creating the API Routes
Move back to the main `backend` directory and open the `index.js`found in the routes directory. We will change this to be our default API routes for our front end. Replace the existing code with the following:

````javascript
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
  createOnfidoSDKToken(applicant).then((response) => {
    return res.status(200).json({ sdkToken: response });
  }).catch((error) => {
    return res.status(500).json({ isError: true, message: error });
  });
});

router.post('/check', function(req, res, next) {
  var applicant = req.body.applicantId;
  createOnfidoCheck(applicant).then((response) => {
    return res.status(200).json({ checkStatus: response.status, id: response.id });
  }).check((error) => {
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
````

### Connecting the Pieces
Finally we will connect the routes to our main express api services. Open the `app.js` in the root of the `backend`directory and replace with the following:
````javascript
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');

var indexRouter = require('./routes/index');


var app = express();

const sess = {
  secret: process.env.APP_SECRET_KEY,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, httpOnly: false },
};

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session(sess));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use('/api', indexRouter);

module.exports = app;
````

### Environmental Variables
You may have noticed that in the code we are using a number of environmental variables, let’s create the `.env` file and use `dotenv` to load these when we run our project. From the root of the backend directory create a `.env` file:
````bash
touch .env
````
Add the following to the .env file:
````bash
APP_SECRET_KEY=SOME-RANDOM-APP_SECRET_KEY
OKTA_ORG_URL=https://yourOktaOrgURL
OKTA_TOKEN=yourOktaApiToken
ONFIDO_TOKEN=yourOnfidoToken
PORT=3001
````
Each of these values should be modified using your Okta and Onfido details. The APP_SECRET_KEY should be any long string value to secure cookies. Port can stay 3001 or be changed as needed.
> Note: The github project reference does not contain this `.env` file as it is good practice not to commit these because they can include sensitive information.

Now we will include and configure the dotenv package to load these variables:
````bash
npm install dotenv
````
Lastly we will configure our node run scripts in `package.json` to use `dotenv` at execution to include these environmental variables:

````json
"scripts": {
    "start": "node -r dotenv/config ./bin/www"
  },
````

Our backend is now ready to go! 

## Creating the Frontend
The frontend of our example application will use react and the okta sign-in widget. Okta provides a sample app that we will use for this example application as well:

[https://github.com/okta/samples-js-react/tree/master/custom-login](https://github.com/okta/samples-js-react/tree/master/custom-login)

Simply download the above project and place the files into the frontend directory. Once in place, run (from the frontend directory):
````bash
npm install
````
> Note: if using git, you can use git clone, but this will come with an origin reference for the frontend project to this sample project which can cause some confusion. 

While this project is a good starting point, we need to make some changes to insert Onfido into the flow. For this example application, we want Onfido to be used to verify user’s Identities when accessing a protected resource, not for general login or registration.

We will use Onfido’s Capture Experience Web SDK by installing the following npm package:

````bash
npm install onfido-sdk-ui
````

Delete the following files:
````bash
src/Messages.jsx
````

Create these following new files in the src directory:
````bash
touch Protected.jsx
touch Onfido.jsx
touch Verifying.jsx
touch Verified.jsx
touch callApi.js
touch interval.js
````
The Protected.jsx will be a page behind the Okta sign-in widget that shows needing to have a valid token from Okta to view. The Onfido.jsx will host the Onfido SDK for processing the IDV steps. The Verifying.jsx page will provide a status screen of the IDV process. In this example app, we are waiting for the result from Onfido, but in production we recommend using webhooks (documented here: [https://documentation.onfido.com/#webhooks](https://documentation.onfido.com/#webhooks)) instead. The Verified.jsx page will be the resource that is linked in the Protected.jsx that requires Onfido IDV to be completed to access. The callApi.js and interval.js are two helper functions we will use to simplify API calls and handle an interval for polling our API respectively. 

The callApi.js is fairly straightforward, use the following code to create it:

````javascript
const callApi = async (method, url, path, data) => {
  const res = await fetch(url+path, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data) || undefined,
  });
  return res.json();
}

export default callApi;
````
Similarly the interval.js file is simple, but a neat bit of code for handling polling style calls in react. See: [https://overreacted.io/making-setinterval-declarative-with-react-hooks/](https://overreacted.io/making-setinterval-declarative-with-react-hooks/)

````javascript
import { useEffect, useRef } from 'react';

function useInterval(callback, delay) {
  const savedCallback = useRef();

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    function tick() {
      savedCallback.current();
    }
    if (delay !== null) {
      let id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

export default useInterval
````

Use the following code for the Protected.jsx page:

````javascript
import React, { useState, useEffect } from 'react';
import { useOktaAuth } from '@okta/okta-react';
import { useHistory } from 'react-router-dom';
import { Header, Button } from 'semantic-ui-react';

const Protected = () => {
  const history = useHistory();
  const { authState, oktaAuth } = useOktaAuth();
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    if (!authState.isAuthenticated) {
      // When user isn't authenticated, forget any user info
      setUserInfo(null);
    } else {
      oktaAuth.getUser().then((info) => {
        setUserInfo(info);
      });
    }
  }, [authState, oktaAuth]); // Update if authState changes

  const verifyIdentity = () => {
    history.push('/idv');
  };

  return (
    <div>
      <Header as="h1">
        Authenticated to Protected Resource!
      </Header>
      <p>You have successfully logged into the protected resource. From here if you want to get access to advanced features, use the link below to verify your identity!</p>
      <Button id="login-button" primary onClick={verifyIdentity}>Verify Identity</Button>
    </div>
  )
};

export default Protected
````
This page will contain a link to allow the user to verify their identity using Onfido IDV.

Use the following code for the Onfido.jsx page:

````javascript
import React, { useState, useEffect } from 'react';
import { Redirect } from 'react-router-dom';
import { useOktaAuth } from '@okta/okta-react';
import { useHistory } from 'react-router-dom';
import { init } from 'onfido-sdk-ui';
import callApi from './callApi';

const createApplicant = async (email, firstName, lastName) => {
  return await callApi('POST', process.env.REACT_APP_BACKEND_URL, '/api/applicant', { user: { firstName: firstName, lastName: lastName, email: email } }).then(result => {
    return result;
  });
};

const getSDKToken = async (applicantId) => {
  return await callApi('POST', process.env.REACT_APP_BACKEND_URL, '/api/sdk', {applicantId: applicantId}).then(result => {
    return result;
  });
};

const Onfido = () => {
  const { authState, oktaAuth } = useOktaAuth();
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    if (!authState.isAuthenticated) {
      // When user isn't authenticated, forget any user info
      setUserInfo(null);
    } else {
      oktaAuth.getUser().then((info) => {
        setUserInfo(info);
      });
    }
  }, [authState, oktaAuth]); // Update if authState changes

  const [applicantId, setApplicantId] = useState(null);
  useEffect(() => {
    let applicantId;
    (async function asyncFetchApplicant() {
      applicantId = await createApplicant(userInfo.given_name, userInfo.family_name, userInfo.email);
      setApplicantId(applicantId);
    })();
  });

  const [sdkToken, setSDKToken] = useState(null);
  useEffect(() => {
    let sdkToken;
    (async function asyncFetchSDKToken() {
      sdkToken = await getSDKToken(applicantId);
      setSDKToken(sdkToken);
    })();
  });

  const [handler, setHandler] = useState(null);
  setOnfidoOptions = (sdkToken) => {
    return {
      token: sdkToken,
      containerId: 'onfido-mount',
      useModel: false,
      smsNumberCountryCode: 'US',
      steps: [
        {
          type: 'welcome',
          options: {
            title: 'Verify your Identity',
            descriptions: [
              'To create an account, we will need to verify your identity using a photo ID and a photo of your face.'
            ],
          },
        },
        {
          type: 'document',
          options: {
            documentTypes: {
              driving_licence: {
                country: 'USA'
              },
              passport: {
                country: 'USA'
              },
              national_identity_card: {
                country: 'USA'
              },
              residence_permit: {
                country: 'USA'
              }
            }
          }
        },
        {
          type: 'face',
          options: {
            requestedVariant: 'standard',
          },
        },
      ],
      onComplete: (data) => {
        setHandler({ documentData: data, complete: true, error: undefined });
      },
      onError: (error) => {
        setHandler({ error: error, complete: false, documentData: undefined });
      }
    };
  };

  if (sdkToken === '') {
    return (
      <div>
        <p>Fetching user profile...</p>
      </div>
    );
  };

  if (!handler.complete) {
    if (handler.error !== undefined) {
      return (
        <div>
          <p> Error! You have encountered an unexpected error!</p>
          <p> {handler.error} </p>
        </div>
      );
    } else {
      init(setOnfidoOptions(sdkToken));
      return (
        <div id="onfido-mount" style={{ display: 'flex'}}></div>
      );
    }
  } else {
    return <Redirect to={{ pathname: '/verifying', state: { applicant: applicantId, data: documentData }}} />
  };
};

export default Onfido
````

Lots to unpack here! First we need to create an applicant with Onfido. We will do so with the information provided from the Okta id_token and update the Okta user with the generated Onfido Applicant ID. Once we have the applicant created, we need an SDK token, which we use for the Onfido WebSDK to handle the API calls that it makes in a secure way. 

The SDK’s options are set using a function setOnfidoOptions. These can be configured using the documentation found here: [https://github.com/onfido/onfido-sdk-ui#customising-the-sdk](https://github.com/onfido/onfido-sdk-ui#customising-the-sdk
)


Next we will use the useInterval function to create a page that polls of the Onfido IDV status in the Verifying.jsx page:

````javascript
import React, { useState, useEffect } from 'react';
import { Dimmer, Loader, Segment } from 'semantic-ui-react';
import { Redirect } from 'react-router-dom';
import callApi from './callApi';
import useInterval from './interval';

const startCheck = async (applicantId) => {
  return await callApi('POST', process.env.REACT_APP_BACKEND_URL, '/api/check', { applicantId }).then(result => {
    return result.id;
  });
};

const checkStatus = async (checkId) => {
  return await callApi('POST', process.env.REACT_APP_BACKEND_URL, '/api/status', { checkId }).then(result => {
    return result;
  });
};

const updateUser = async (applicantId, checkResult) => {
  return await callApi('POST', process.env.REACT_APP_BACKEND_URL, '/api/update', { applicantId, checkResult }).then(result => {
    return result;
  });
};

const Verifying = (props) => {
  const [verifyState, setVerifyState] = useState({
    applicant: '',
    checkId: '',
    status: 'start',
    isComplete: undefined,
  });

  const { authState, oktaAuth } = useOktaAuth();
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    if (!authState.isAuthenticated) {
      // When user isn't authenticated, forget any user info
      setUserInfo(null);
    } else {
      oktaAuth.getUser().then((info) => {
        setUserInfo(info);
      });
    }
  }, [authState, oktaAuth]); // Update if authState changes


  useEffect(() => {
    if (verifyState.status === 'start') {
      const app = props.location.state.applicant;
      const asyncCheck = async () => {
        const check = await startCheck(app);
        setVerifyState(prevState => ({
          ...prevState,
          applicant: app,
          checkId: check,
          status: 'in_progress',
          isComplete: false,
        }));
      }
      asyncCheck();
    }
  }, [verifyState, props.location.state.applicant]);

  useInterval(() => {
    if (!verifyState.isComplete && verifyState.isComplete !== undefined) {
      const asyncStatus = async () => {
        var currentStatus = await checkStatus(verifyState.checkId);
        if (currentStatus.checkStatus === 'complete') {
          updateUser(verifyState.applicant, currentStatus.checkResult);
          setVerifyState(prevState => ({
            ...prevState,
            status: 'complete',
            isComplete: true,
          }));
        }
      }
      asyncStatus();
    }
  }, !verifyState.isComplete ? 10000 : null);

  if (verifyState.status === 'in_progress' || verifyState.status === 'start') {
    return (
      <div style={{height: '300px'}}>
        <Segment placeholder>
          <Dimmer active inverted>
            <Loader inverted size="big" content="Verifying" />
          </Dimmer>
        </Segment>
      </div>
    );
  };

  return <Redirect to={{ pathname: '/verified' }} />;
}

export default Verifying
````
This page will create the initial check after the SDK experience is complete. It will then poll the check endpoint from our backend to see when the status has changed to clear or consider, intoning that the IDV process is done with these results. We are not doing any result checking in this example app, but you will be able to see the results of the IDV process using the profile page.

Lastly we will create the Verified.jsx page. This page will only be accessible if the user has completed IDV and the okta user `id_token` has been refreshed and contains the onfidoIdvStatus claim with a value of complete.

````javascript
import React, { useState, useEffect } from 'react';
import { useOktaAuth } from '@okta/okta-react';
import { useHistory } from 'react-router-dom';
import { Header, Button } from 'semantic-ui-react';

const Verified = () => {
  const history = useHistory();
  const { authState, oktaAuth } = useOktaAuth();
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    if (!authState.isAuthenticated) {
      // When user isn't authenticated, forget any user info
      setUserInfo(null);
    } else {
      oktaAuth.getUser().then((info) => {
        setUserInfo(info);
      });
    }
  }, [authState, oktaAuth]); // Update if authState changes

  const profile = () => {
    history.push('/profile');
  };

  const verify = () => {
    history.push('/idv');
  };

  if (!userInfo.onfidoIdvStatus || userInfo.onfidoIdvStatus === '') {
    return (
      <div>
        <Header as="h1">
          Not Verified!
        </Header>
        <p> Your identity has not been verified! You must verify your identity before you can access this page.</p>
        <Button id="idv-button" primary onClick={verify}>Verify Identity</Button>
      </div>
    )
  }

  return (
    <div>
      <Header as="h1">
        Identity Verified!
      </Header>
      <p>You have successfully verified your Identity! You can click on the profile button below to see your profile with IDV status.</p>
      <Button id="profile-button" primary onClick={profile}>View Profile</Button>
    </div>
  )
};

export default Verified
````
To map all of this together we will need to modify the App.jsx to include our new pages as secure routes. Use the following code to do so: 

````javascript
/*
 * Copyright (c) 2018, Okta, Inc. and/or its affiliates. All rights reserved.
 * The Okta software accompanied by this notice is provided pursuant to the Apache License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and limitations under the License.
 */

import React from 'react';
import { Route, useHistory, Switch } from 'react-router-dom';
import { OktaAuth } from '@okta/okta-auth-js';
import { Security, SecureRoute, LoginCallback } from '@okta/okta-react';
import { Container } from 'semantic-ui-react';
import config from './config';
import Home from './Home';
import CustomLoginComponent from './Login';
import Navbar from './Navbar';
import Profile from './Profile';
import Protected from './Protected';
import Onfido from './Onfido';
import Verifying from './Verifying';
import Verified from './Verified';

const oktaAuth = new OktaAuth(config.oidc);

const App = () => {
  const history = useHistory(); // example from react-router

  const customAuthHandler = () => {
    // Redirect to the /login page that has a CustomLoginComponent
    history.push('/login');
  };

  return (
    <Security
      oktaAuth={oktaAuth}
      onAuthRequired={customAuthHandler}
    >
      <Navbar />
      <Container text style={{ marginTop: '7em' }}>
        <Switch>
          <Route path="/" exact component={Home} />
          <Route path="/login/callback" component={LoginCallback} />
          <Route path="/login" component={CustomLoginComponent} />
          <SecureRoute path="/protected" component={Protected} />
          <SecureRoute path="/profile" component={Profile} />
          <SecureRoute path="/idv" component={Onfido} />
          <SecureRoute path="/verifying" component={Verifying} />
          <SecureRoute path="/verified" component={Verified} />
        </Switch>
      </Container>
    </Security>
  );
};

export default App;
````
Now we need to add our Okta OIDC information into the config.js settings. Modify the config.js to look like the following:

````javascript
const CLIENT_ID = process.env.CLIENT_ID || '{clientId}';
const ISSUER = process.env.ISSUER || 'https://{yourOktaDomain}.com/oauth2/default';
const OKTA_TESTING_DISABLEHTTPSCHECK = process.env.OKTA_TESTING_DISABLEHTTPSCHECK || false;
const REDIRECT_URI = `${window.location.origin}/login/callback`;

export default {
  oidc: {
    clientId: CLIENT_ID,
    issuer: ISSUER,
    redirectUri: REDIRECT_URI,
    scopes: ['openid', 'profile', 'email'],
    pkce: true,
    disableHttpsCheck: OKTA_TESTING_DISABLEHTTPSCHECK,
  }
};
````
Then create a .env file in the root of the frontend folder that looks like the following:

````bash
CLIENT_ID=0000000000000000
ISSUER=http://localhost:3000/
OKTA_TESTING_DISABLEHTTPSCHECK=true
REACT_APP_BACKEND_URL=http://localhost:3001/
````
Set the following environment variables as follows:
* CLIENT_ID = your Okta client ID for the application your created in the pre-requisites
* ISSUER = the issuer you created on the Okta application
* OKTA_TESTING_DISABLEHTTPSCHECK = for local development this should be set to true.
* REACT_APP_BACKEND_URL = this should be set to the backend URL, which in this example will be http://localhost:3001

## Testing

You are now able to test the full integration! In each of the directories (backend and frontend) run the following:

````bash
npm start
````

After a moment your browser will load and open to http://localhost/ 

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License
[MIT](https://choosealicense.com/licenses/mit/)