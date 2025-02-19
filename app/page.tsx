"use client";

import React, { useState, useEffect, useRef } from "react";
import { ethers, formatEther, parseEther, toNumber, parseUnits} from "ethers";
import { getContract } from "@/utils/contract";
import { MetaMaskInpageProvider } from "@metamask/providers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/utils/components/ui/card";
import { Button } from "@/utils/components/ui/button";
import { Input } from "@/utils/components/ui/input";
import { Textarea } from "@/utils/components/ui/textarea";
//import {MarketplaceHeader} from "@/utils/components/ui/MarketplaceHeader";
import { AlertCircle, Upload, ShoppingCart, List, Loader2, Trash2, Store, Plus, X , LogOut} from 'lucide-react';
import { Alert, AlertDescription } from "@/utils/components/ui/alert";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/utils/components/ui/DropdownMenu";
import Swal from 'sweetalert2';


declare global {
  interface Window{
    ethereum?:MetaMaskInpageProvider
  }
}
export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dataItems, setDataItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState<string>("");
  const [provider, setProvider] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('browse');
  const [error, setError] = useState("");
  const [contract, setContract] = useState<any>(null);
  const [delisting, setDelisting] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [downloadedItems, setDownloadedItems] = useState<Set<string>>(new Set());
  const [network, setNetwork] = useState<string>("");
  const [currency, setCurrency] = useState<string>("");
  const [balance, setBalance] = useState<string>("");
  const [logo, setLogo] = useState<File | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [purchasedItems, setPurchasedItems] = useState<Set<number>>(new Set());

  useEffect(() => {
    //initializeEthers();
    loadItems();
  }, []);

  // Add this at the top of your component
  useEffect(() => {
    const checkWalletConnection = async () => {
      // Check if user has explicitly disconnected
      if (localStorage.getItem('walletDisconnected') === 'true') {
        return; // Don't auto-connect if user has disconnected
      }
  
      if (typeof window.ethereum !== "undefined") {
        try {
          const accounts = await window.ethereum.request({ 
            method: 'eth_accounts'
          });
          
          if (accounts.length > 0) {
            const provider = await initializeEthers();
            if (!provider) return;
  
            setAccount(accounts[0]);
            const balance = await provider.getBalance(accounts[0]);
            setBalance(formatEther(balance));
          }
        } catch (error) {
          console.error("Error checking wallet connection:", error);
        }
      }
    };
  checkWalletConnection();
}, []); // Empty dependency array means this runs once on mount

  useEffect(() => {
    if (contract && account && activeTab === 'inventory') {
      fetchInventory();
    }
  }, [contract, account, activeTab]);

   // Load items when contract is initialized
   useEffect(() => {
    if (contract) {
      loadItems();
    }
  }, [contract]);

  useEffect(() => {
    if (account && contract && activeTab === 'browse') {
      checkPurchasedItems();
    }
  }, [account, contract, activeTab, dataItems]);

  const fetchInventory = async () => {
    if (!contract || !account) {
      console.error("Contract not initialized or wallet not connected");
      return;
    }
  
    try {
      setLoading(true);
      console.log(`Fetching inventory for user: ${account}`);
      const contract = await getContract(true);
      // Fetch purchased item IDs from smart contract
      const purchasedItemIds = await contract.getUserPurchases(account);
      console.log("Purchased Item IDs:", purchasedItemIds);
      
      // Fetch item details for each purchased item
      const items = await Promise.all(
        purchasedItemIds.map(async (id) => {
          const [seller, price, salesCount, active] = await contract.getDataItem(id);
          const metadata = await contract.getItemMetadata(id);
          const cid = await contract.getCID(id);
          console.log(`Fetched CID: ${cid}`);

          return {
            id: id.toString(),
            seller,
            price,
            salesCount: salesCount.toString(),
            active,
            item_cid: cid,
            title: metadata.title,
            description: metadata.description,
            fileSize: metadata.fileSize,
            fileType: metadata.fileType,
            timestamp: metadata.timestamp,
            logoCid: metadata.logoCid
          };
        })
      );
  
      // Store the purchased items in state
      setInventoryItems(items);
      console.log("Updated inventory:", items);
    } catch (error) {
      console.error("Error fetching inventory:", error);
    } finally {
      setLoading(false);
    }
  };

  const initializeEthers = async () => {
    if (typeof window.ethereum !== "undefined") {
      try {
        console.log('RPC URL:', process.env.NEXT_PUBLIC_AMOY_RPC_URL);
        console.log('Private Key length:', process.env.NEXT_PUBLIC_PRIVATE_KEY?.length);
  
        // Create provider instance
        const provider = new ethers.BrowserProvider(window.ethereum);
        setProvider(provider);
  
        // Fetch network and currency
        const network = await provider.getNetwork();
        setNetwork(network.name);
  
        // Set native currency symbol based on network
        const nativeCurrencySymbol = (() => {
          switch (Number(network.chainId)) {
            case 1: return 'ETH';
            case 3: return 'ETH';
            case 4: return 'ETH';
            case 5: return 'ETH';
            case 42: return 'ETH';
            case 80002: return 'POL';
            default: return 'ETH';
          }
        })();
        setCurrency(nativeCurrencySymbol);

        // Initialize contract
        const contract = await getContract();
        setContract(contract);
  
        // Listen for account changes
        window.ethereum.on('accountsChanged', async (accounts: string[]) => {
          if (accounts.length === 0) {
            setAccount("");
            setBalance("");
            setContract(null);
            setInventoryItems([]);
          } else {
            setAccount(accounts[0]);
            const balance = await provider.getBalance(accounts[0]);
            setBalance(formatEther(balance));
            const contract = await getContract();
            setContract(contract);
          }
        });

        return provider;
      } catch (error) {
        console.error("Error initializing ethers:", error);
        if (error.code === 4001) {
          console.log("User rejected the request");
        } else {
          alert("An error occurred. Please try again.");
        }
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  // Connect wallet function
  const connectWallet = async () => {
    try {
      // Clear the disconnected flag when user explicitly connects
      localStorage.removeItem('walletDisconnected');
      
      // Initialize ethers first
      const provider = await initializeEthers();
      if (!provider) return;
  
      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts) {
        console.log("No accounts found");
        return;
      }
  
      // Set account and fetch balance
      setAccount(accounts[0]);
      const balance = await provider.getBalance(accounts[0]);
      setBalance(formatEther(balance));
  
    } catch (error) {
      if (error.code === 4001) {
        console.log("User rejected the request");
      } else {
        console.error("Error connecting wallet:", error);
        alert("Failed to connect wallet. Please try again.");
      }
    }
  };

   // Disconnect wallet function
   const disconnectWallet = async () => {
    try {
      // Clear all state
      setAccount("");
      setNetwork("");
      setBalance("");
      setCurrency("");
      setActiveTab("browse");
      setContract(null);
      setProvider(null);
      setInventoryItems([]);
      setPurchasedItems(new Set());
  
      // Set disconnected flag in localStorage
      localStorage.setItem('walletDisconnected', 'true');
      
      // No need to request permissions or lock MetaMask
      // Just let the state reset handle the disconnection
  
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
    }
  };

  // Load items from blockchain
  const loadItems = async () => {
    try {
      setLoading(true);
      // Initialize a read-only contract instance if needed
      const contract = await getContract(false);

      const itemCount = await contract.itemCount();
      console.log('Item count:', itemCount.toString());
      
      const items = [];
      for (let i = 0; i < itemCount; i++) {
        const status = await contract.getStatus(i);
        if(status){
          const [seller, price, salesCount, active] = await contract.getDataItem(i);
          const metadata = await contract.getItemMetadata(i);
          items.push({
            id: i,
            seller,
            price,
            salesCount: toNumber(salesCount),
            active,
            title: metadata.title,
            description: metadata.description,
            fileSize: metadata.fileSize,
            fileType: metadata.fileType,
            timestamp: metadata.timestamp,
            logoCid: metadata.logoCid
          });
        }
      }
  
      //console.log('Final items array:', items);
      setDataItems(items);
    } catch (error) {
      console.error("Error loading items:", error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to convert Wei to ETH
  const formatWeiToEth = (weiValue) => {
      try {
        return formatEther(weiValue.toString());
      } catch (error) {
        console.error("Error converting Wei to ETH:", error);
        return "0.00";
      }
    };

  const uploadFile = async () => {
    let uploadedFileCID = null;
    let uploadedLogoCID = null;
    //let uploadedCID = null;
    // Show disclaimer popup
    Swal.fire({
      title: "Important Disclaimer",
      text: "By uploading a file, you confirm that you own the rights to distribute it and that it does not contain any illegal or restricted content. Any and all data uploaded is available for the public. Ensure you have permission to share any sensitive information. We are not responsible for any data infractions / violations",
      icon: "warning",
      confirmButtonText: "I Understand",
      confirmButtonColor: "#3085d6",
      showCancelButton: true,  // Enables a cancel button
      cancelButtonText: "Exit",
      cancelButtonColor: "#d33",
      allowOutsideClick: false
  }).then(async (result) => {
      if (result.isConfirmed) {
    try {
      if (!file || !price || !description) {
        alert("Please fill in all fields and connect your wallet");
        return;
      }

      setUploading(true);

      const data = new FormData();
      data.set("file", file);
      data.set("price", price);
      data.set("title", title);
      data.set("description", description);
      //data.set("sellerAddress", sellerAddress);

      if(logo){
        data.set("logo", logo)
      }

      const response = await fetch("/api/files", {
        method: "POST",
        body: data,
      });

      const { cid, logoCid, fileSize, fileType } = await response.json();
      uploadedFileCID = cid;
      uploadedLogoCID = logoCid;

      //metadata 
      const metadata = {
        title: title,
        description: description,
        fileSize: fileSize,
        fileType: fileType,
        timestamp: Math.floor(Date.now() / 1000),
        logoCid: logoCid || ""

      }
      
      // Step 2: Interact with the smart contract
      console.log("Getting smart contract instance...");
      const contract = await getContract(true);
      console.log("Smart contract instance retrieved.");

      // 2. List the data on the blockchain
      console.log("Calling listData on the smart contract...");
      const tx = await contract.listData(
        cid, 
        parseUnits(price, 18), 
        metadata);
      console.log("Transaction sent. Waiting for confirmation...");
      await tx.wait(); // Wait for confirmation
      console.log("Transaction confirmed.");
  
      // 3. Refresh the items list
      await loadItems();
  
      alert("File uploaded and listed successfully!");
      
      // Clear form
      setFile(null);
      setLogo(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
      setPrice("");
      setDescription("");
      setTitle("")

      setUploading(false);
    } catch (error) {
      console.error("Error in uploadFile:", error);
      setUploading(false);

        // Always try to unpin the main file if it was uploaded
      if (uploadedFileCID) {
        try {
          const unpinFileResponse = await fetch(`/api/files?cid=${uploadedFileCID}`, {
            method: 'DELETE'
          });
          
          if (!unpinFileResponse.ok) {
            const errorData = await unpinFileResponse.json();
            console.error('Failed to delete main file:', errorData.error);
          }
        } catch (unpinError) {
          console.error('Error deleting main file:', unpinError);
        }
      }

      // Only try to unpin the logo if it was uploaded
      if (uploadedLogoCID) {
        try {
          const unpinLogoResponse = await fetch(`/api/files?cid=${uploadedLogoCID}`, {
            method: 'DELETE'
          });
          
          if (!unpinLogoResponse.ok) {
            const errorData = await unpinLogoResponse.json();
            console.error('Failed to delete logo:', errorData.error);
          }
        } catch (unpinError) {
          console.error('Error deleting logo:', unpinError);
        }
      }

        // Clear form
        setFile(null);
        setLogo(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        if (logoInputRef.current) {
          logoInputRef.current.value = '';
        }
        setPrice("");
        setDescription("");
        setTitle("");
      alert("Error uploading file");
    }
  }})
  };

  const fetchData = async (cid: string, title: string) => {
    // Show disclaimer popup
    Swal.fire({
      title: "Important Disclaimer",
      text: "By downloading this file, you acknowledge that it is provided \"as is\" without warranties, and you assume all responsibility for its use, security, and compliance with applicable laws.",
      icon: "warning",
      confirmButtonText: "I Understand",
      confirmButtonColor: "#3085d6",
      showCancelButton: true,  // Enables a cancel button
      cancelButtonText: "Exit",
      cancelButtonColor: "#d33",
      allowOutsideClick: false
  }).then(async (result) => {
      if (result.isConfirmed) {
    try {
      setFetchingId(cid); // Set loading state

      // Open the file in a new tab for direct download
      const fileUrl = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);

      if (!fileUrl.ok) {
        const errorData = await fileUrl.json();
        throw new Error(errorData.error || 'Download failed');
      }

      const blob = await fileUrl.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Mark this item as downloaded
      setDownloadedItems(prev => new Set(prev).add(cid));
      
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file. Please try again.');
    } finally {
      setLoading(false);
      setFetchingId(null);
    }
  }})
  };

  const buyData = async (itemId) => {
    if (!account) {
      alert("Please connect your wallet to make a purchase.");
      return;
    }
    // Show disclaimer popup
    Swal.fire({
      title: "Important Disclaimer",
      text: "All purchases are final; please ensure the data matches your expectations before buying, as we are not responsible for any discrepancies or misuse.",
      icon: "warning",
      confirmButtonText: "I Understand",
      confirmButtonColor: "#3085d6",
      showCancelButton: true,  // Enables a cancel button
      cancelButtonText: "Exit",
      cancelButtonColor: "#d33",
      allowOutsideClick: false
  }).then(async (result) => {
      if (result.isConfirmed) {
    try {
      setLoading(true);
      const contract = await getContract(true);

      // // Fetch past purchase events for the current user
      // const eventFilter = contract.filters.DataPurchased(itemId, account); 
      // const events = await contract.queryFilter(eventFilter, 0, "latest");

      // // If user has already purchased, block the transaction
      // if (events.length > 0) {
      //   alert("You have already purchased this item!");
      //   setLoading(false);
      //   return;
      // }
  
      // Fetch the correct price from the contract
      const item = dataItems.find(item => item.id == itemId);
      if (!item) throw new Error("Item not found");

      const correctPrice = item.price;  // Price from the contract is already in Wei
  
      console.log(`Fetched item price: ${correctPrice.toString()} Wei`);
  
      
      // Call the contract function with the correct price
      const transaction = await contract.buyData(itemId, {
        value: correctPrice,  // Send exact price fetched from contract
      });
  
      console.log("Transaction sent, waiting for confirmation...");
  
      // Wait for transaction confirmation
      await transaction.wait();
  
      console.log("Transaction confirmed!");
      alert(`Purchase successful! Item ID: ${itemId}`);
  
      // Update balance after purchase
      await updateBalance(account);

      // Refresh inventory after purchase
      // fetchInventory();
  
    } catch (error) {
      console.error("Purchase failed:", error);
      if (error.reason) {
        alert(`Transaction failed: ${error.reason}`);
      } else {
        alert("Transaction failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }})
  };

  const deListData = async (itemId: number) => {
    try {
      setDelisting(itemId);
      console.log("Removing: " + itemId);
      setError("");
      
      //Interact with the smart contract
      console.log("Getting smart contract instance...");
      const contract = await getContract(true);
      console.log("Smart contract instance retrieved.");

      // deList the data on the blockchain
      console.log("Calling deListData on the smart contract...");
      const tx = await contract.deListData(itemId);
      console.log("Transaction sent. Waiting for confirmation...");
      await tx.wait(); // Wait for confirmation
      console.log("Transaction confirmed.");
      

      //remove file from IPFS
      const fileCID = await contract.getCID(itemId);
      
      const unpinResponse = await fetch(`/api/files?cid=${fileCID}`, {
        method: 'DELETE'
      });
      
      if (!unpinResponse.ok) {
        const errorData = await unpinResponse.json();
        throw new Error(errorData.error || 'Failed to delete file');
      }

      const data = await unpinResponse.json();
      console.log('File successfully deleted:', data.message);

      //remove logo from IPFS
      const metadata = await contract.getItemMetadata(itemId);

      if (metadata && metadata.logoCid && metadata.logoCid !== "") {
        try {
        const unpinResponse2 = await fetch(`/api/files?cid=${metadata.logoCid}`, {
          method: 'DELETE'
        });

        if (!unpinResponse2.ok) {
          const errorData = await unpinResponse2.json();
          console.error('Failed to delete logo:', errorData.error);
        } else {
          const data2 = await unpinResponse2.json();
          console.log('Logo successfully deleted:', data2.message);
        }
      } catch (unpinError) {
        console.error('Error deleting logo:', unpinError);
      }
    } else {
      console.log('No logo to delete');
    }

      await loadItems();
    } catch (error: any) {
      setError(error.message || "Failed to delist item");
      console.error("Error delisting data:", error);
    } finally {
      setDelisting(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target?.files?.[0] || null);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (file) {
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        alert("Logo file size must be less than 5MB");
        e.target.value = '';
        return;
      }
      // Check file type
      if (!file.type.startsWith('image/')) {
        alert("Please upload an image file");
        e.target.value = '';
        return;
      }
      setLogo(file);
    } else {
      setLogo(null);
    }
  };

  const updateBalance = async (account: string) => {
    if (provider) {
      const balance = await provider.getBalance(account);
      setBalance(formatEther(balance));
    }
  };

  // utility functions
  const formatBytes = (bytes: number | bigint) => {
    if (!bytes) return '0 Bytes';
    
    try {
      // Convert BigInt to number safely using BigInt methods
      const bytesNum = typeof bytes === 'bigint' ? 
        Number(bytes.toString()) : 
        bytes;
  
      if (isNaN(bytesNum)) return '0 Bytes';
      if (bytesNum === 0) return '0 Bytes';
  
      const k = BigInt(1024);
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      
      // Convert to BigInt for calculations
      let i = 0;
      let size = BigInt(bytes);
      
      while (size >= k && i < sizes.length - 1) {
        size = size / k;
        i++;
      }
  
      // Convert final result to number for formatting
      const finalSize = Number(size);
      return `${finalSize.toFixed(0)} ${sizes[i]}`;
    } catch (error) {
      console.error('Error formatting bytes:', error);
      return '0 Bytes';
    }
  };

  const formatFileType = (fileType: string) => {
    if (!fileType) return 'Unknown';
    // Take everything after the "/" and remove the "/"
    return fileType.split('/').pop() || fileType;
  };

  const checkPurchasedItems = async () => {
    if (!account || !contract) return;
    
    try {
      const items = await Promise.all(
        dataItems.map(async (item) => {
          const hasPurchased = await contract.hasPurchased(account, item.id);
          return { id: item.id, purchased: hasPurchased };
        })
      );
  
      setPurchasedItems(new Set(
        items.filter(item => item.purchased).map(item => item.id)
      ));
    } catch (error) {
      console.error("Error checking purchased items:", error);
    }
  };

  const renderLockScreen = () => (
    <div className="absolute inset-0 bg-gray-900 bg-opacity-75 flex flex-col items-center justify-center z-10">
      <div className="flex flex-col items-center space-y-4">
        <img src="/images/lock_icon.ico" alt="Lock Icon" className="h-20 w-20" />
        <p className="text-white text-xl font-semibold text-center">Please log in to access this feature.</p>
      </div>
    </div>
  );


// Create a reusable ListingCard component
const ListingCard = ({ item, showSeller = false, showSalesCount = false, isMyStall = false, isMyInventory = false}) => {
  const isPurchased = purchasedItems.has(item.id);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  return(
  <Card key={item.id} className="overflow-hidden h-[550px] flex flex-col"> {/* Fixed height and flex column */}
    {/* Logo/Image Section - Fixed height */}
    <div className="w-full h-48 bg-gray-800 relative flex-shrink-0"> {/* flex-shrink-0 prevents compression */}
      {item.logoCid ? (
        <img
          src={`https://gateway.pinata.cloud/ipfs/${item.logoCid}`}
          alt={item.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = '/images/default_logo.png';
            e.currentTarget.className = 'w-full h-full object-contain p-4';
          }}
        />
      ) : (
        <img
          src="/images/default_logo.png"
          alt="Default Logo"
          className="w-full h-full object-contain p-4"
        />
      )}
    </div>

    {/* Expandable Title */}
    <CardHeader className="flex-shrink-0">
      <div className="group relative">
        <CardTitle className="text-xl font-bold truncate">
          {item.title}
        </CardTitle>
        {item.title.length > 30 && (
          <div className="absolute z-50 hidden group-hover:block bg-gray-800 p-2 rounded-md shadow-lg -bottom-1 transform translate-y-full w-full">
            <span className="text-sm text-white">{item.title}</span>
          </div>
        )}
      </div>
      
      {/* Expandable Description */}
      <div className="relative min-h-[4rem]">
  <CardDescription 
    className={`text-sm text-gray-400 ${
      isDescriptionExpanded 
        ? 'absolute left-0 right-0 z-50 bg-gray-800 p-3 rounded-md shadow-lg' 
        : 'line-clamp-2 hover:cursor-pointer pr-12'
    }`}
    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
  >
    {item.description}
    {isDescriptionExpanded && (
      <button
        className="absolute top-0 right-0 text-red-400 hover:text-red-500 z-[50] p-1" // Changed from bottom-3 right-3 to top-2 right-2
        onClick={(e) => {
          e.stopPropagation();
          setIsDescriptionExpanded(false);
        }}
      >
        <X className="h-4 w-4" />
      </button>
    )}
  </CardDescription>
  {!isDescriptionExpanded && item.description.length > 100 && (
    <button
      className="absolute bottom-5 right-0 text-blue-400 hover:text-blue-500 bg-gray-900 rounded-full p-1 z-10"
      onClick={(e) => {
        e.stopPropagation();
        setIsDescriptionExpanded(true);
      }}
    >
      <Plus className="h-4 w-4" />
    </button>
  )}
</div>
    </CardHeader>

    {/* Content section with scroll if needed */}
    <CardContent className="flex-1 overflow-y-auto space-y-3">
      {/* Metadata Grid */}
      <div className="grid grid-cols-2 gap-2 text-sm -mt-6"> {/* Added -mt-2 to pull grid up */}
      <div className="text-gray-400">File Size:</div>
      <div className="truncate">{formatBytes(item.fileSize)}</div>
      
      <div className="text-gray-400">File Type:</div>
      <div className="truncate">{formatFileType(item.fileType)}</div>
      
      {showSalesCount && (
        <>
          <div className="text-gray-400">Sales:</div>
          <div className="truncate">{item.salesCount}</div>
        </>
      )}

      {showSeller && (
        <>
          <div className="text-gray-400">Seller:</div>
          <div className="truncate" title={item.seller}>
            {`${item.seller.slice(0, 6)}...${item.seller.slice(-4)}`}
          </div>
        </>
      )}
    </div>

      {/* Price - Fixed position at bottom */}
      <div className="mt-2">
        <p className="text-2xl font-bold mb-2">
          {Number(formatWeiToEth(item.price)).toFixed(3)} ETH
        </p>
      </div>

      {/* Action Buttons - Always at bottom */}
      {(isMyStall || isMyInventory || (!isMyInventory && item.seller.toLowerCase() !== account.toLowerCase())) && (
      <div className="mt-auto pt-2">
      {isMyStall ? (
        <Button 
          onClick={() => deListData(item.id)}
          disabled={delisting === item.id}
          variant="destructive"
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {delisting === item.id ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Trash2 className="mr-2 h-4 w-4" />
              Delist
            </>
          )}
        </Button>
      ) : !isMyInventory && item.seller.toLowerCase() !== account.toLowerCase() ? (
        <Button
          onClick={() => buyData(item.id)}
          disabled={loading || isPurchased}
          className={`w-full ${isPurchased ? 'bg-gray-500' : 'bg-blue-500 hover:bg-blue-600'}`}
        >
          {loading ? 'Processing...' : isPurchased ? 'Purchased' : 'Buy Now'}
        </Button>
      ) : null}

      {isMyInventory && (
        <Button 
          onClick={() => fetchData(item.item_cid, item.title)}
          disabled={fetchingId === item.item_cid}
          className={`w-full ${
            fetchingId === item.item_cid 
              ? 'bg-gray-400' 
              : downloadedItems.has(item.item_cid)
                ? 'bg-green-500 hover:bg-green-600'
                : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {fetchingId === item.item_cid 
            ? 'Fetching...' 
            : downloadedItems.has(item.item_cid)
              ? 'Download Again'
              : 'Download'
          }
        </Button>
      )}
    </div>
      )}
    </CardContent>
  </Card>
  );
};

// Update the tab render functions
const renderBrowseContent = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {loading ? (
      <div className="col-span-full flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    ) : dataItems.length > 0 ? (
      dataItems.map((item) => (
        <ListingCard
          key={item.id}
          item={item}
          showSeller={true}
          isMyStall={false}
        />
      ))
    ) : (
      <p className="col-span-full text-center text-gray-400">
        No items available.
      </p>
    )}
  </div>
);

const renderMyStallContent = () => (
  <div className="relative min-h-[485px]">
    {!account && renderLockScreen()}
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${!account ? 'blur-sm' : ''}`}>
      {loading ? (
        <div className="col-span-full flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : dataItems
          .filter(item => item.seller.toLowerCase() === account.toLowerCase())
          .map((item) => (
            <ListingCard
              key={item.id}
              item={item}
              showSalesCount={true}
              isMyStall={true}
            />
          ))}
    </div>
  </div>
);

const renderInventoryContent = () => (
  <div className="relative min-h-[485px]">
    {!account && renderLockScreen()}
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${!account ? 'blur-sm' : ''}`}>
      {loading ? (
        <div className="col-span-full flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : inventoryItems.map((item) => (
        <ListingCard
          key={item.id}
          item={item}
          showSeller={true}
          showSalesCount={false}
          isMyInventory={true}
        />
      ))}
    </div>
  </div>
);



  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
  <div className="flex items-center">
    <div className="bg-gray-900 flex items-center">
      <img 
        src="icon.ico"
        className="h-10 w-25" 
      />
    </div>
  </div>

  {!account ? (
          <Button onClick={connectWallet} variant="outline">
            Connect Wallet
          </Button>
        ) : (

          <div className="flex items-center text-white space-x-4">
            <div className="relative flex items-center space-x-2 group">
              <span>{network.toUpperCase()}</span>
              <div className="absolute top-full mt-2 flex flex-col items-center hidden group-hover:flex">
                <span className="relative z-10 p-2 text-xs leading-none text-white whitespace-no-wrap bg-black shadow-lg rounded-md">Current Network</span>
              </div>
            </div>
            <div className="relative flex items-center space-x-2 group">
              <span>{parseFloat(balance).toFixed(2)} {currency}</span>
              <div className="absolute top-full mt-2 flex flex-col items-center hidden group-hover:flex">
                <span className="relative z-10 p-2 text-xs leading-none text-white whitespace-no-wrap bg-black shadow-lg rounded-md">Your Balance</span>
              </div>
            </div>
            <DropdownMenu>
            <DropdownMenuTrigger className="px-4 py-2 border rounded cursor-pointer">
              {account.slice(0, 6)}...{account.slice(-4)}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-gray-800 text-white p-2 rounded-md shadow-lg">
              <DropdownMenuItem onClick={() => setActiveTab("my-stall")}>
                <Store className="h-4 w-4" />
                My Stall
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveTab("inventory")}>
                <List className="h-4 w-4" />
                Inventory
              </DropdownMenuItem>
              <DropdownMenuItem onClick={disconnectWallet} className="text-red-500">
                <LogOut className="h-4 w-4" />
                Logout
              </DropdownMenuItem>

            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        )}
      </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-6 mb-6">
          <Button 
            variant={activeTab === 'browse' ? 'default' : 'outline'}
            onClick={() => setActiveTab('browse')}
            className="w-36 h-14 text-lg font-medium border border-white flex items-center justify-center"
          >
            <ShoppingCart className="mr-2 h-5 w-5" />
            Browse
          </Button>
          <Button
            variant={activeTab === 'upload' ? 'default' : 'outline'}
            onClick={() => setActiveTab('upload')}
            className="w-36 h-14 text-lg font-medium border border-white flex items-center justify-center"
          >
            <Upload className="mr-2 h-5 w-5" />
            Upload
          </Button>
          {/* <Button
            variant={activeTab === 'my-stall' ? 'default' : 'outline'}
            onClick={() => setActiveTab('my-stall')}
            className="w-36 h-14 text-lg font-medium border border-white flex items-center justify-center"
          >
            <Store className="mr-2 h-5 w-5" />
            My Stall
          </Button>

          <Button
            variant={activeTab === 'inventory' ? 'default' : 'outline'}
            onClick={() => setActiveTab('inventory')}
            className="w-36 h-14 text-lg font-medium border border-white flex items-center justify-center"
          >
            <Store className="mr-2 h-5 w-5" />
            Inventory
          </Button> */}
        </div>

    {activeTab === 'upload' && (
    <div className="relative min-h-[485px]">
    {!account && renderLockScreen()}
    <Card className={`max-w-2xl mx-auto bg-gray-900 shadow-lg rounded-lg ${!account ? 'blur-sm' : ''}`}>
      <CardContent className="p-8 space-y-6">
        <h2 className="text-2xl font-bold text-white text-center mb-6">Upload Data For Sale</h2>

        {/* Logo Upload */}
        <div>
          <label className="block mb-2 text-lg font-semibold text-gray-300">Logo Image (Optional)</label>
          <div className="relative">
            <input
              type="file"
              ref={logoInputRef}
              onChange={handleLogoChange}
              accept="image/*"
              className="block w-full text-sm text-gray-500 border border-gray-700 rounded-lg bg-gray-800 file:bg-blue-500 file:border-none file:text-white file:py-2 file:px-4 file:cursor-pointer hover:file:bg-blue-600"
            />
            <p className="mt-1 text-sm text-gray-400">Supported formats: JPG, PNG, GIF (Max 5MB)</p>
          </div>
        </div>

        {/* File Upload */}
        <div>
          <label className="block mb-2 text-lg font-semibold text-gray-300">File</label>
          <div className="relative">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 border border-gray-700 rounded-lg bg-gray-800 file:bg-blue-500 file:border-none file:text-white file:py-2 file:px-4 file:cursor-pointer hover:file:bg-blue-600"
            />
          </div>
        </div>

        {/* Title Input */}
        <div>
          <label className="block mb-2 text-lg font-semibold text-gray-300">Title</label>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a title for your listing"
            className="block w-full text-sm text-gray-300 border border-gray-700 rounded-lg bg-gray-800 p-3 focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50 transition-all"
          />
        </div>
        
        {/* Price Input */}
        <div>
          <label className="block mb-2 text-lg font-semibold text-gray-300">Price (ETH)</label>
          <Input
            type="number"
            step="0.0001"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            className="block w-full text-sm text-gray-300 border border-gray-700 rounded-lg bg-gray-800 p-3 focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50 transition-all"
          />
        </div>

        {/* Description Input */}
        <div>
          <label className="block mb-2 text-lg font-semibold text-gray-300">Description</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your data listing..."
            className="block w-full text-sm text-gray-300 border border-gray-700 rounded-lg bg-gray-800 p-3 focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50 transition-all h-32"
          />
        </div>

        {/* Upload Button */}
        <Button
          onClick={uploadFile}
          disabled={uploading || !file || !price || !description}
          className="mt-6 w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? "Uploading..." : "Upload"}
          </Button>
      </CardContent>
    </Card>
  </div>
)}

{activeTab === 'inventory' && renderInventoryContent()}

{activeTab === 'my-stall' && renderMyStallContent()}
  
{activeTab === 'browse' && renderBrowseContent()}
              </div>
            </div>
          );
}