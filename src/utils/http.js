export async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const bodyText = await response.text();

  let parsedBody = null;
  if (bodyText) {
    try {
      parsedBody = JSON.parse(bodyText);
    } catch {
      parsedBody = bodyText;
    }
  }

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status} for ${url}`);
    error.status = response.status;
    error.payload = parsedBody;
    throw error;
  }

  return parsedBody;
}
