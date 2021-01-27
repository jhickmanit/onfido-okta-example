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
Login redirect URIs | http://localhost:3000/login/callback
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

>Note: Once you have created the profile attributes above, make sure they are mapped to the application profile as well if it was created under the default Okta profile.

### Add Custom Claim to Okta Authorization Server
  1. Login to your Okta instance as an Admin and navigate to Security > API.
  2. On the default Authorization server, click the "Edit" Icon.
  3. Click on the Claims tab and select Add Claim.
  4. Create the following claims:
     1. onfidoApplicantId
        * Name: onfidoApplicantId
        * Include in token type: ID Token | Always
        * Value type: Expression
        * Value: user.onfidoApplicantId
        * Include In: The following scopes - profile
      2. onfidoIdvStatus
        * Name: onfidoIdvStatus
        * Include in token type: ID Token | Always
        * Value type: Expression
        * Value: user.onfidoIdvStatus
        * Include In: The following scopes - profile

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
Open the newly created `api.js ` and use the file in this repository to create the content. 

A few notes on the api.js file:

Pay note to the `process.env` variables in the Okta and Onfido Clients, they will be set in the .env file for the backend.
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
````

Notice the updateOktaUser function in that it uses the partial update call. This is because we are only passing in specific values and don't want the left out values to be set to null.

````javascript
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
````

### Creating the API Routes
Move back to the main `backend` directory and open the `index.js`found in the routes directory. Copy the `routes/index.js` file in this repository to overwrite the file.

A note on the status route and the behavior here: this is not recommended for production. Onfido offers a webhook functionality to send an event when checks are complete. This should be used instead of the polling status behavior in this example.

````javascript
router.post('/status', function(req, res, next) {
  var checkId = req.body.checkId;
  getOnfidoCheckResult(checkId).then((response) => {
    return res.status(200).json({ checkStatus: response.status, checkResult: response.result });
  }).catch((error) => {
    return res.status(500).json({ isError: true, message: error });
  });
});

````

### Connecting the Pieces
Finally we will connect the routes to our main express api services. Open the `app.js` in the root of the `backend`directory and replace with the `app.js` found in this repository.

One note here is the CORS setup. This is required to allow communication between this express layer and the react frontend. We use credentials = true here because we want to persist cookies (READ: session) between requests.
````javascript
const corsOptions = {
  origin: 'http://localhost:3000',
  optionsSuccessStatus: 200,
  credentials: true,
};
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

The callApi.js is fairly straightforward, simply copy it from this repository into the callApi.js file created above.

````javascript
const callApi = async (method, url, path, data) => {
  const res = await fetch(url+path, {
    method,
    credentials: 'include',
    body: JSON.stringify(data) || undefined,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });
  if (res.ok) {
    return res.json();
  } else {
    return res;
  }
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

Copy the code in the repository for Protected.jsx, Home.jsx, Navbar.jsx, Onfido.jsx, Verified.jsx, and Verifying.jsx into their respective files.

A few notes:

On the Onfido.jsx file we setup the Onfido configuration like below:

````javascript
const initOnfido = async (sdkToken) => {
    setLoading(true)
    const instance = init({
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
    })
    setOnfidoInstance(instance)
    setLoading(false)
  }
````
This can be edited to meet the use case you wish to achieve as documented here: https://github.com/onfido/onfido-sdk-ui#customising-the-sdk

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
Then create a `testenv` file in the root of the project folder that looks like the following:

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