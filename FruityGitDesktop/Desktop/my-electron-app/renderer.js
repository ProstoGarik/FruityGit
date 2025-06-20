document.getElementById('initButton').addEventListener('click', async () => {
  const repoName = document.getElementById('repoName').value.trim();
  const responseDiv = document.getElementById('response');
  
  if (!repoName) {
    responseDiv.textContent = 'Please enter a repository name';
    return;
  }

  try {
    responseDiv.textContent = 'Sending request...';
    
    const response = await fetch(`http://192.168.135.52:8000/api/git/${repoName}/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.text();
      responseDiv.textContent = `Success: ${data}`;
    } else {
      const error = await response.text();
      responseDiv.textContent = `Error: ${error}`;
    }
  } catch (error) {
    responseDiv.textContent = `Failed to send request: ${error.message}`;
  }
});