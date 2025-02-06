import { NextResponse, type NextRequest } from "next/server";
import { pinata } from "@/utils/config"; // Pinata configuration
import { getContract } from "@/utils/contract"; // Contract helper
import { parseEther } from "ethers";

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

    // Step 1: Upload file to Pinata
    console.log("Uploading file to Pinata...");

    const metadata = {
      name: file.name,
      keyvalues: {
        contentType: file.type,
        originalName: file.name,
        fileSize: file.size.toString(),
        uploadDate: new Date().toISOString()
      }
    };

    console.log("Uploading file to Pinata with metadata:", metadata);
    const fileUploadResponse = await pinata.upload.file(file);
    console.log("Pinata upload response:", fileUploadResponse);

    const cid = fileUploadResponse.IpfsHash; // Extract the CID
    console.log("File uploaded to Pinata with CID:", cid);


    // Simplified response to indicate success
    //return NextResponse.json({ message: "Data listed successfully." });
    return NextResponse.json({cid});
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

    console.log("Fetching metadata from Pinata for CID:", cid);

    try {
      // First fetch metadata
      const metadataResponse = await fetch(
        `https://api.pinata.cloud/data/pinList?hashContains=${cid}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.PINATA_JWT}`
          }
        }
      );

      if (!metadataResponse.ok) {
        throw new Error('Failed to fetch metadata');
      }

      const metadataJson = await metadataResponse.json();
      const fileMetadata = metadataJson.rows[0]?.metadata;
      
      // Get the content type and original filename from metadata
      const contentType = fileMetadata?.keyvalues?.contentType || '';
      const originalName = fileMetadata?.keyvalues?.originalName || `file-${cid}`;

      // Construct the full URL to access the file
      const fileUrl = `${process.env.NEXT_PUBLIC_GATEWAY_URL}/files/${cid}?download=true`;

      // Create response with redirect and proper headers
      const response = NextResponse.redirect(fileUrl);

      // Add content type and filename headers if metadata was found
      if (contentType) {
        response.headers.set('Content-Type', contentType);
      }
      response.headers.set('Content-Disposition', `attachment; filename="${originalName}"`);

      console.log("Redirecting to file with metadata:", {
        contentType,
        originalName,
        fileUrl
      });

      return response;

    } catch (metadataError) {
      console.error("Error fetching metadata:", metadataError);
      // If metadata fetch fails, still try to download the file
      console.log("Proceeding with download without metadata");
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_GATEWAY_URL}/files/${cid}?download=true`);
    }

  } catch (error) {
    console.error("Error fetching data from Pinata:", error);
    return NextResponse.json({ error: "Failed to fetch file" }, { status: 500 });
  }
}
