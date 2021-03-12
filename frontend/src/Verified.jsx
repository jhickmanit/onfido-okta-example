import React, { useState, useEffect } from 'react';
import { useOktaAuth } from '@okta/okta-react';
import { useHistory } from 'react-router-dom';
import { Header, Button } from 'semantic-ui-react';

const Verified = (props) => {
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

  if (userInfo === undefined || userInfo === null) {
    return (
      <div>
        <p>Fetching user profile...</p>
      </div>
    )
  }

  const result = props.location.state.result;

  if (result === 'clear' || userInfo['onfidoIdvStatus'] === 'clear') {
    return (
      <div>
        <Header as="h1">
          Identity Verified!
        </Header>
        <p>You have successfully verified your Identity! You can click on the profile button below to see your profile with IDV status.</p>
        <Button id="profile-button" primary onClick={profile}>View Profile</Button>
      </div>
    )
  }
  
  return (
    <div>
      <Header as="h1">
        Not Verified!
      </Header>
      <p> Your identity has not been verified or failed to be verified! You must verify your identity before you can access this page, click below to try again.</p>
      <Button id="idv-button" primary onClick={verify}>Verify Identity</Button>
    </div>
  )
};

export default Verified
