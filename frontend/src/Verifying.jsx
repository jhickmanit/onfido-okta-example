import React, { useState, useEffect } from 'react';
import { Dimmer, Loader, Segment } from 'semantic-ui-react';
import { useOktaAuth } from '@okta/okta-react';
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

const updateUser = async (user, checkResult) => {
  return await callApi('POST', process.env.REACT_APP_BACKEND_URL, '/api/update', { user, checkResult }).then(result => {
    return result;
  });
};

const Verifying = (props) => {
  const [verifyState, setVerifyState] = useState({
    applicant: '',
    checkId: '',
    status: 'start',
    isComplete: undefined,
    result: '',
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
          updateUser(userInfo, currentStatus.checkResult);
          setVerifyState(prevState => ({
            ...prevState,
            status: 'complete',
            isComplete: true,
            result: currentStatus.checkResult,
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

  return <Redirect to={{ pathname: '/verified', state: { result: verifyState.result } }} />;
}

export default Verifying
