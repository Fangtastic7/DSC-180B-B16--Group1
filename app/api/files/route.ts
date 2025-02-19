import { NextResponse, type NextRequest } from "next/server";
import { pinata } from "@/utils/config"; // Pinata configuration
import { getContract } from "@/utils/contract"; // Contract helper
import { parseEther } from "ethers";
import { v4 as uuidv4 } from "uuid"; // Install 'uuid' for generating unique IDs
import path from "path";
import { promisify } from "util";
import { exec } from "child_process";
import os from "os";
import { promises as fs } from 'fs'


const AWS = require('aws-sdk');
//const fs = require('fs');
AWS.config.update({region:'us-east-1'});
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

async function removePII(fileBuffer: ArrayBuffer): Promise<{
  piiFindings: string[],
  processedFilePath: string
}> {
  try {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pii-'));
    const tempFilePath = path.join(tempDir, 'input.csv');
    const outputFilePath = path.join(tempDir, 'output.csv');
    
    await fs.writeFile(tempFilePath, Buffer.from(fileBuffer));
    
    const pythonScript = path.join(process.cwd(), 'scripts', 'remove_pii.py');
    const execAsync = promisify(exec);
    console.log('Executing Python script...');
    const { stdout, stderr } = await execAsync(
      `python "${pythonScript}" "${tempFilePath}" "${outputFilePath}"`
    );
    
    // Log all output for debugging
    if (stderr) {
      console.log('Python script debug output:', stderr);
    }
    if (stdout) {
      console.log('Python script findings:', stdout);
    }

    // Verify output file exists and has content
    const outputExists = await fs.stat(outputFilePath).catch(() => false);
    if (!outputExists) {
      throw new Error('Output file was not created');
    }

    const outputContent = await fs.readFile(outputFilePath, 'utf-8');
    console.log('Output file first 100 chars:', outputContent.slice(0, 100));
    
    const piiFindings = stdout
      .split('\n')
      .filter(line => line.startsWith('Found'))
      .map(line => line.trim());
    
    return {
      piiFindings,
      processedFilePath: outputFilePath
    };
  } catch (error) {
    console.error('Error in PII removal:', error);
    throw new Error('Failed to process PII removal');
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("Starting POST request at /api/files");

    // Parse form data from the request
    const formData = await request.formData();
    const file = formData.get("file") as unknown as File;
    const logo = formData.get("logo") as unknown as File;
    const price = formData.get("price") as string;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    
    //console.log("Parsed FormData:", { file, price, description });

    if (!file || !price || !title || !description) {
      console.error("Missing required fields:", { file, price, description });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // PII
    let processedFile = file;
    let piiFindings: string[] = [];
    // Check if file is CSV
    if (file.name.toLowerCase().endsWith('.csv')) {
      console.log("Processing CSV file for PII...");
      try {
        const fileBuffer = await file.arrayBuffer();
        const { piiFindings: findings, processedFilePath } = await removePII(fileBuffer);
        
        piiFindings = findings;
        
        // Read the processed file
        const processedBuffer = await fs.readFile(processedFilePath);
        processedFile = new File([processedBuffer], file.name, { type: 'text/csv' });
        
        console.log("PII processing complete. Findings:", piiFindings);
      } catch (error) {
        console.error("Error processing PII:", error);
        return NextResponse.json({ error: "PII processing failed" }, { status: 500 });
      }
    }

    // file metadata
    const fileSize = file.size;
    const fileType = file.type;
    const timestamp = Math.floor(Date.now() / 1000);

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
    
      // Handle logo upload if provided
      let logoCid = "";
      if (logo) {
        const logoArrayBuffer = await logo.arrayBuffer();
        const logoBuffer = Buffer.from(logoArrayBuffer);
        const logoFileName = `logo_${uuidv4()}_${logo.name}`;
    
        const logoParams = {
          Bucket: process.env.S3_BUCKET_NAME as string,
          Key: logoFileName,
          Body: logoBuffer,
          ContentType: logo.type,
        };
    
        await s3.upload(logoParams).promise();

          // Get logo CID from Lambda
        const logoLambdaParams = {
          FunctionName: 'pinataUpload',
          InvocationType: 'RequestResponse',
          Payload: JSON.stringify({ fileName: logoFileName }),
        };
          
        const lambda = new AWS.Lambda();

        const logoResponse = await lambda.invoke(logoLambdaParams).promise();
        const logoPayload = JSON.parse(logoResponse.Payload);
        if (logoPayload.statusCode === 200) {
          const logoResult = JSON.parse(logoPayload.body);
          logoCid = logoResult.cid;
        }
      }

    const bucketName = process.env.S3_BUCKET_NAME as string;
    const uploadResponse = await uploadFile(bucketName);
    
    console.log(`File uploaded successfully: ${uploadResponse.Location}`);
    
    const lambda2 = new AWS.Lambda();
    const params = {
      FunctionName: 'pinataUpload', 
      InvocationType: 'RequestResponse', // Optional: 'Event' for async, 'RequestResponse' for sync
      Payload: JSON.stringify({ fileName }), // Pass the fileName as a payload
    };
    var cid;
    try {
      const response = await lambda2.invoke(params).promise();
      const responsePayload = JSON.parse(response.Payload);
  
      if (responsePayload.statusCode === 200) {
        const result = JSON.parse(responsePayload.body);
        console.log('CID:', result.cid);
        cid = result.cid
        
      } else {
        console.error('Lambda returned an error:', responsePayload);
        throw new Error('Failed to get CID from Lambda');
      }
    } catch (error) {
      console.error('Error invoking Lambda function:', error);
      throw error;
    }
    
  
    // Return the CID to the frontend
    return NextResponse.json({
      cid,
      logoCid,
      fileSize,
      fileType
    });
  } catch (error) {
    console.error("Error in /api/files route:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    console.log("Starting DELETE request at /api/files");

    // Get the CID from the URL or request body
    const { searchParams } = new URL(request.url);
    const cid = searchParams.get('cid');

    if (!cid) {
      console.error("Missing CID parameter");
      return NextResponse.json({ error: "Missing CID parameter" }, { status: 400 });
    }

    console.log("Attempting to unpin file with CID:", cid);

    // Unpin the file from Pinata
    await pinata.unpin([cid]);

    console.log("Successfully unpinned file with CID:", cid);

    return NextResponse.json({ 
      message: "File successfully unpinned",
      cid: cid 
    });

  } catch (error) {
    console.error("Error in /api/files DELETE route:", error);
    
    // Check if the error is due to CID not found
    if ((error as any)?.response?.status === 404) {
      return NextResponse.json({ 
        error: "File not found or already unpinned" 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      error: "Internal Server Error" 
    }, { status: 500 });
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