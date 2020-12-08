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
