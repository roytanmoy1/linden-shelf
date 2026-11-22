import { catalogueFixture, fixturePhotoBase64 } from './fixtures.ts';

globalThis.fetch = async (input, options) => {
  const request = new Request(input, options);
  request.signal.throwIfAborted();
  if (request.method === 'GET' && request.url === 'https://fakestoreapi.com/img/test-jacket.jpg') {
    return new Response(Buffer.from(fixturePhotoBase64, 'base64'), { headers: { 'Content-Type': 'image/png' } });
  }
  if (request.method !== 'GET' || request.url !== 'https://fakestoreapi.com/products') {
    throw new Error('Unexpected outbound request from the isolated reviewer API');
  }
  return Response.json(catalogueFixture());
};
