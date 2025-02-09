import { PinataSDK } from 'pinata-web3';
import AWS from 'aws-sdk';
const s3 = new AWS.S3({
accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT, // JWT token from .env.local
  pinataGateway: process.env.NEXT_PUBLIC_GATEWAY_URL, // Gateway URL from .env.local
});


export const handler = async (event) => {
  const fn = event.fileName;
  const bucketName = process.env.S3_BUCKET_NAME;
  const downloadFileFromS3 = async (bucketName, fn) => {
    const params = {
      Bucket: bucketName,
      Key: event.fileName,
    };
  
    try {
      const data = await s3.getObject(params).promise();
      return data.Body; // Return the file content as a buffer
    } catch (err) {
      console.error("Error downloading file from S3:" , err);
      throw new Error("Failed to download file from S3 " + event.fileName);
    }
  };
  console.log(`Downloading file from S3: ${event.fileName}`);
  const fileBuffer = await downloadFileFromS3(bucketName);
  console.log("File downloaded from S3");
  const filePinata = new File([fileBuffer], event.fileName);
  // Upload file to Pinata
  console.log("Uploading file to Pinata...");
  const fileUploadResponse = await pinata.upload.file(filePinata);
  console.log("Pinata upload response:", fileUploadResponse);

  const cid = fileUploadResponse.IpfsHash;
  console.log("File uploaded to Pinata with CID:", cid);
  const deleteFileFromS3 =  async (bucketName, fn) =>  {
    const params = {
      Bucket: bucketName,
      Key: event.fileName,
    };
  
    try {
      await s3.deleteObject(params).promise();
      console.log(`File deleted successfully from S3: ${fn}`);
    } catch (err) {
      console.error("Error deleting file from S3:", err);
      throw new Error("Failed to delete file from S3");
    }
  };
  // Delete the file from S3
  console.log(`Deleting file from S3: ${fn}`);
  await deleteFileFromS3(bucketName);

return {
  statusCode: 200,
  body: JSON.stringify({ cid }),
  };
};
