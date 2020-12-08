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
