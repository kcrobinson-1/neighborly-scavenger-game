async function invokeJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return {
    body,
    response,
    text,
  };
}

function formatBody(body) {
  if (typeof body === "string") {
    return body;
  }

  return JSON.stringify(body);
}

function formatHttpResult(result) {
  return [
    `status=${result.response.status}`,
    `body=${formatBody(result.body)}`,
  ].join(" ");
}

function assertHttpStatus(result, expectedStatus, message) {
  if (result.response.status !== expectedStatus) {
    throw new Error(`${message}\n${formatHttpResult(result)}`);
  }
}

module.exports = {
  assertHttpStatus,
  formatHttpResult,
  invokeJson,
};
