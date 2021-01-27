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