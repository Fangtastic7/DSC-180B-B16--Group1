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
    // Fetch metadata from Pinata
    const response = await fetch(`https://api.pinata.cloud/data/pinList?hashContains=${cid}`, {
      headers: {
        Authorization: `Bearer ${process.env.PINATA_JWT}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch metadata');
    }

    const metadataJson = await response.json();
    const fileMetadata = metadataJson.rows[0]?.metadata;

    // Extract metadata values if available
    const contentType = fileMetadata?.keyvalues?.contentType || '';
    const originalName = fileMetadata?.keyvalues?.originalName || `file-${cid}`;

    return {
      statusCode: 200,
      body: JSON.stringify({ contentType, originalName }),
    };
  } catch (error) {
    console.error("Error fetching Pinata metadata:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch metadata from Pinata" }),
    };
  }
}