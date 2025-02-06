import { PinataSDK } from "pinata-web3";

// Export an instance of the Pinata SDK using your environment variables
export const pinata = new PinataSDK({
  pinataJwt: `${process.env.PINATA_JWT}`, // JWT token from .env.local
  pinataGateway: `${process.env.NEXT_PUBLIC_GATEWAY_URL}` // Gateway URL from .env.local
});
