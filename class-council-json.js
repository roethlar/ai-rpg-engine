function malformed(response) {
  const error = new Error('The model returned malformed JSON.');
  error.code = 'CLASS_COUNCIL_JSON';
  error.rawText = response;
  return error;
}

/** Parse an envelope only; the caller must still validate its exact role schema. */
export function parseClassCouncilJson(response, { stage } = {}) {
  if (typeof response !== 'string') throw malformed(response);
  let source = response.trim();
  const fence = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/iu.exec(source);
  if (fence) {
    source = fence[1].trim();
  } else if (stage === 'interaction') {
    // Captured labels contain no structure; never search past a damaged object.
    source = source.replace(/^(?:inputKind|input)(?=\{)/u, '');
  }

  let value;
  try { value = JSON.parse(source); }
  catch { throw malformed(response); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw malformed(response);
  return value;
}
