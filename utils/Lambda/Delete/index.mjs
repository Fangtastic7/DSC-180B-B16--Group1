import { PinataSDK } from 'pinata-web3';

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT, // JWT token from .env.local
  pinataGateway: process.env.NEXT_PUBLIC_GATEWAY_URL, // Gateway URL from .env.local
});

export async function handler(event) {
  const cid = event.cid;
  if (!cid) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing CID parameter" }),
    };
  }

  try {
    // Call Pinata unpin API to unpin the file
    const response = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${process.env.PINATA_JWT}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: "File not found or already unpinned" }),
        };
      }
      throw new Error(`Failed to unpin file: ${response.statusText}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "File successfully unpinned", cid }),
    };
  } catch (error) {
    console.error("Error unpinning file:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
}