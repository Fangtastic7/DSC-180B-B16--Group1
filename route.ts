import { NextResponse, type NextRequest } from "next/server";
import { pinata } from "@/utils/config"; // Pinata configuration
import { getContract } from "@/utils/contract"; // Contract helper
import { parseEther } from "ethers";
import { v4 as uuidv4 } from "uuid"; // Install 'uuid' for generating unique IDs

const AWS = require('aws-sdk');
const fs = require('fs');
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});



export async function POST(request: NextRequest) {
  try {
    console.log("Starting POST request at /api/files");

    // Parse form data from the request
    const formData = await request.formData();
    const file = formData.get("file") as unknown as File;
    const price = formData.get("price") as string;
    const description = formData.get("description") as string;
    
    console.log("Parsed FormData:", { file, price, description });

    if (!file || !price || !description) {
      console.error("Missing required fields:", { file, price, description });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate a unique file name for S3
    const fileName = `${uuidv4()}_${file.name}`;

    const uploadFile = async (bucketName: string) => {
      const params = {
        Bucket: bucketName,
        Key: fileName,
        Body: buffer,
        ContentType: file.type, // Set content type for proper file handling in S3
      };

      return s3.upload(params).promise(); // Return a promise to wait for the upload
    };
    
    const bucketName = process.env.S3_BUCKET_NAME as string;
    const uploadResponse = await uploadFile(bucketName);
    
    console.log(`File uploaded successfully: ${uploadResponse.Location}`);
    
    const lambda = new AWS.Lambda();
    var cid;
    const params = {
      FunctionName: 'pinataUpload', // Replace with your Lambda function name
      InvocationType: 'RequestResponse', // Optional: 'Event' for async, 'RequestResponse' for sync
      Payload: JSON.stringify({ fileName }), // Pass the fileName as a payload
    };
  
    try {
      const response = await lambda.invoke(params).promise();
      const responsePayload = JSON.parse(response.Payload);
  
      if (responsePayload.statusCode === 200) {
        const result = JSON.parse(responsePayload.body);
        console.log('CID:', result.cid);
        cid = result.cid
        
      } else {
        console.error('Lambda returned an error:', responsePayload);
      }
    } catch (error) {
      console.error('Error invoking Lambda function:', error);
    }
    
  
    // Return the CID to the frontend
    return NextResponse.json({ cid });
  } catch (error) {
    console.error("Error in /api/files route:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    console.log("Starting DELETE request at /api/files");

    // Get the CID from the URL query params
    const { searchParams } = new URL(request.url);
    const cid = searchParams.get('cid');  

    if (!cid) {
      console.error("Missing CID parameter");
      return NextResponse.json({ error: "Missing CID parameter" }, { status: 400 });
    }

    const lambda = new AWS.Lambda();
    const params = {
      FunctionName: 'pinataDelete',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({ cid }),
    };

    // Invoke the Lambda function
    const lambdaResponse = await lambda.invoke(params).promise();
    const lambdaPayload = JSON.parse(lambdaResponse.Payload);

    if (lambdaPayload.statusCode !== 200) {
      throw new Error(lambdaPayload.body.error || "Failed to unpin file");
    }

    console.log("Successfully unpinned file with CID:", cid);
    return NextResponse.json({ message: "File successfully unpinned", cid });

  } catch (error) {
    console.error("Error in /api/files DELETE route:", error);

    if (error.message.includes("File not found")) {
      return NextResponse.json({ error: "File not found or already unpinned" }, { status: 404 });
    }

    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get CID from query params
    const { searchParams } = new URL(request.url);
    const cid = searchParams.get("cid");

    if (!cid) {
      return NextResponse.json({ error: "Missing CID parameter" }, { status: 400 });
    }
    const lambda = new AWS.Lambda();
    const params = {
      FunctionName: 'pinataGet', // Ensure this matches your deployed Lambda function name
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({ cid }),
    };

    try {
      // Invoke Lambda function to fetch metadata
      const lambdaResponse = await lambda.invoke(params).promise();
      const lambdaPayload = JSON.parse(lambdaResponse.Payload);
      const metadata = JSON.parse(lambdaPayload.body);

      if (lambdaPayload.statusCode !== 200) {
        throw new Error("Metadata fetch failed");
      }

      const contentType = metadata?.contentType || '';
      const originalName = metadata?.originalName || `file-${cid}`;
      const fileUrl = `${process.env.NEXT_PUBLIC_GATEWAY_URL}/files/${cid}?download=true`;

      const response = NextResponse.redirect(fileUrl);

      // Add headers based on metadata
      if (contentType) {
        response.headers.set('Content-Type', contentType);
      }
      response.headers.set('Content-Disposition', `attachment; filename="${originalName}"`);

      return response;

    } catch (lambdaError) {
      console.error("Error calling Lambda function:", lambdaError);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_GATEWAY_URL}/files/${cid}?download=true`);
    }

  } catch (error) {
    console.error("Error handling request:", error);
    return NextResponse.json({ error: "Failed to fetch file" }, { status: 500 });
  }
}