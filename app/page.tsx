"use client";

import React, { useState, useEffect, useRef } from "react";
import { ethers, formatEther, toNumber, parseUnits} from "ethers";
import { getContract } from "@/utils/contract";
import { MetaMaskInpageProvider } from "@metamask/providers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/utils/components/ui/card";
import { Button } from "@/utils/components/ui/button";
import { Input } from "@/utils/components/ui/input";
import { Textarea } from "@/utils/components/ui/textarea";
import { Upload, ShoppingCart, List, Loader2, Trash2, Store, Plus, X , LogOut, Download, Search } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/utils/components/ui/DropdownMenu";
import Swal from 'sweetalert2';
import { motion } from "framer-motion";
import { toast } from 'react-toastify';


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
  const [activeTab, setActiveTab] = useState('home');
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
  const [removePii, setRemovePii] = useState(false); // Default to false
  const [searchQuery, setSearchQuery] = useState("");
  const handlePiiToggle = () => {
    setRemovePii((prev) => !prev); // Toggle between true and false
  };

  useEffect(() => {
    //initializeEthers();
    loadItems();
  }, []);

  useEffect(() => {
    // Only run on client side
    if (typeof window !== 'undefined') {
      const savedTab = localStorage.getItem('activeTab');
      if (savedTab) {
        setActiveTab(savedTab);
      }
    }
  }, []);

  useEffect(() => {
    // Only handle beforeunload event
    const handleBeforeUnload = () => {
      // Don't clear localStorage here
    };
  
    window.addEventListener('beforeunload', handleBeforeUnload);
  
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handleAlert = (alert: string, message: string) => {
      if (alert === 'Success') {
      toast.success(message, {
        position: "top-left",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
        });
      }
      else if (alert === 'Error') {
        toast.error(message, {
          position: "top-left",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: false,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
          });
        }
  } 

  // Add this to your existing useEffect for ethereum events
  useEffect(() => {
    if (typeof window.ethereum !== "undefined") {
      window.ethereum.on('chainChanged', () => {
        if (account) {
          updateBalance(account);
        }
      });
    }

    return () => {
      if (typeof window.ethereum !== "undefined") {
        window.ethereum.removeListener('chainChanged', () => {});
      }
    };
  }, [account]);

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
          
          if ((accounts as string[]).length > 0) {
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

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    localStorage.setItem('activeTab', tab);
  };

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
          handleAlert('Error',"An error occurred. Please try again.");
        }
      }
    } else {
      handleAlert('Error,',"Please install MetaMask!");
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
      } else if (error.code === -32002) {
        handleAlert('Error',"MetaMask is already processing a connection request. Please check your MetaMask window");
      }else {
        console.error("Error connecting wallet:", error);
         handleAlert('Error',"Failed to connect wallet. Please try again.");
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
      handleTabChange('home');
      setContract(null);
      setProvider(null);
      setInventoryItems([]);
      setPurchasedItems(new Set());
  
      // Set disconnected flag in localStorage
      localStorage.setItem('walletDisconnected', 'true');

      setActiveTab("home");
      
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

    if (parseFloat(price) < 0.001){
      handleAlert('Error',"Minimum price is 0.001 ETH");
      return;
    }

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
         handleAlert('Error',"Please fill in all fields and connect your wallet");
        return;
      }

      setUploading(true);

      const data = new FormData();
      data.set("file", file);
      data.set("price", price);
      data.set("title", title);
      data.set("description", description);
      data.set("removePii", removePii.toString());

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
      await updateBalance(account);
      console.log("Transaction confirmed.");
  
      // 3. Refresh the items list
      await loadItems();
  
      handleAlert('Success',"File uploaded and listed successfully!");
      
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
      setRemovePii(false);

      setUploading(false);
    } catch (error) {
      if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
        // User rejected the transaction - clean up IPFS files before returning
        if (uploadedFileCID) {
          try {
            await fetch(`/api/files?cid=${uploadedFileCID}`, {
              method: 'DELETE'
            });
          } catch (unpinError) {
            console.error('Error deleting main file:', unpinError);
          }
        }
    
        if (uploadedLogoCID) {
          try {
            await fetch(`/api/files?cid=${uploadedLogoCID}`, {
              method: 'DELETE'
            });
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
        setRemovePii(false);
        setUploading(false);
        return;
      }
      console.error("Error in uploadFile:", error);
      
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
        setRemovePii(false);
        handleAlert('Error',"Error uploading file");
    } finally {
      setUploading(false);
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
       handleAlert('Error','Failed to download file. Please try again.');
    } finally {
      setLoading(false);
      setFetchingId(null);
    }
  }})
  };

  const buyData = async (itemId) => {
    if (!account) {
       handleAlert('Error',"Please connect your wallet to make a purchase.");
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

      // Fetch the correct price from the contract
      const item = dataItems.find(item => item.id == itemId);
      if (!item) throw new Error("Item not found");

      const correctPrice = item.price;  // Price from the contract is already in Wei

      // Check user's balance before attempting purchase
      const userBalance = await provider.getBalance(account);
      if (userBalance < correctPrice) {
        handleAlert('Error', `Insufficient funds. You need more ETH to make this purchase.`);
        return;
      }
  
      console.log(`Fetched item price: ${correctPrice.toString()} Wei`);
  
      
      // Call the contract function with the correct price
      const transaction = await contract.buyData(itemId, {
        value: correctPrice,  // Send exact price fetched from contract
      });
  
      console.log("Transaction sent, waiting for confirmation...");
  
      // Wait for transaction confirmation
      await transaction.wait();
  
      //console.log("Transaction confirmed!");

      // Update balance after purchase
      await updateBalance(account);

      handleAlert('Success',`Purchase successful! Item ID: ${itemId}`);
  
      // Refresh inventory after purchase
      // fetchInventory();
  
    } catch (error) {
      //console.error("Purchase failed:", error);
      // Check for user rejection from MetaMask
      if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
        // User rejected the transaction - no need to show an error message
        console.log("Transaction was rejected by user");
        return;
      }
      
      // Handle other specific error cases
      if (error.code === 'INSUFFICIENT_FUNDS') {
        handleAlert('Error', `Insufficient funds to complete this purchase.`);
      } 
      // Handle transaction reverted by contract
      else if (error.code === 'CALL_EXCEPTION') {
        handleAlert('Error', "Transaction was rejected. This could be because the item is no longer available or there was a contract error");
      }
      // Handle network errors
      else if (error.code === 'NETWORK_ERROR') {
        handleAlert('Error', "Network error occurred. Please check your connection and try again");
      }
      // Handle other contract errors with reason
      else if (error.reason) {
        handleAlert('Error', `Transaction failed: ${error.reason}`);
      }
      // Fallback error message for unexpected errors
      else {
        handleAlert('Error', "Transaction failed. Please try again");
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
      await updateBalance(account);
      await loadItems();
    } catch (error: any) {
      setError(error.message || "Failed to delist item");
      if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
        // User rejected the transaction - no need to show an error message
        console.log("Transaction was rejected by user");
        return;
      }
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
         handleAlert('Error',"Logo file size must be less than 5MB");
        e.target.value = '';
        return;
      }
      // Check file type
      if (!file.type.startsWith('image/')) {
         handleAlert('Error',"Please upload an image file");
        e.target.value = '';
        return;
      }
      setLogo(file);
    } else {
      setLogo(null);
    }
  };

  const updateBalance = async (account: string) => {
    if (provider && account) {
      try {
        const balance = await provider.getBalance(account);
        setBalance(formatEther(balance));
      } catch (error) {
        console.error("Error updating balance:", error);
      }
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
    <div className="absolute inset-x-0 top-0 bottom-0 bg-gray-900/75 backdrop-blur-sm flex flex-col items-center justify-center z-40">
      <div className="flex flex-col items-center space-y-4">
        <img src="/images/lock_icon.ico" alt="Lock Icon" className="h-20 w-20" />
        <p className="text-white text-xl font-semibold text-center">Please connect your wallet to access this feature.</p>
      </div>
    </div>
  );


// Create a reusable ListingCard component
const ListingCard = ({ item, showSeller = false, showSalesCount = false, isMyStall = false, isMyInventory = false}) => {
  const isPurchased = purchasedItems.has(item.id);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  return(
  <Card key={item.id} className="overflow-hidden h-auto min-h-[550px] flex flex-col bg-gray-900"> {/* Fixed height and flex column */}
    {/* Logo/Image Section - Fixed height */}
    <div className="w-full h-36 sm:h-48 bg-gray-800 relative flex-shrink-0"> {/* flex-shrink-0 prevents compression */}
      {item.logoCid ? (
        <img
          src={`https://gateway.pinata.cloud/ipfs/${item.logoCid}`}
          alt={item.title}
          className="w-full h-full object-contain p-0" /* Originally w-full h-full object-cover */
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
    <CardHeader className="flex-shrink-0 bg-gray-900 p-4 sm:p-6">
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
    <CardContent className="flex-1 overflow-y-auto space-y-3 bg-gray-900 p-4 sm:p-6">
      {/* Metadata Grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm -mt-6">
      {/* Row 1 */}
      <div className="flex flex-col">
        <div className="text-gray-400">File Size:</div>
        <div className="truncate font-medium">{formatBytes(item.fileSize)}</div>
      </div>
      
      <div className="flex flex-col">
        <div className="text-gray-400">File Type:</div>
        <div className="truncate font-medium">{formatFileType(item.fileType)}</div>
      </div>
  
      {/* Row 2 */}
      {showSeller && (
        <div className="flex flex-col">
          <div className="text-gray-400">Seller:</div>
          <div className="truncate font-medium" title={item.seller}>
            {`${item.seller.slice(0, 4)}...${item.seller.slice(-3)}`}
          </div>
        </div>
      )}

      {(showSalesCount || !isMyStall) && (
        <div className="flex flex-col">
          <div className="text-gray-400">{isMyStall ? 'Sales:' : 'Purchases:'}</div>
          <div className="truncate font-medium">{item.salesCount}</div>
        </div>
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
          className={`w-full ${isPurchased ? 'bg-gray-500' : 'bg-blue-500 hover:bg-blue-600'} flex items-center justify-center space-x-2 font-bold`}
        >
          <ShoppingCart className="h-4 w-4" />
          <span>{loading ? 'Processing...' : isPurchased ? 'Purchased' : 'Buy Now'}</span>
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
        } flex items-center justify-center space-x-2`}
      >
        <Download className="h-4 w-4" />
        <span className="font-bold">
          {fetchingId === item.item_cid 
            ? 'Fetching...' 
            : downloadedItems.has(item.item_cid)
              ? 'Download Again'
              : 'Download'
          }
        </span>
      </Button>
      )}
    </div>
      )}
    </CardContent>
  </Card>
  );
};

const renderBrowseContent = () => {
  // Convert searchQuery to lowercase for case-insensitive search
  const filteredItems = dataItems.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {loading ? (
        <div className="col-span-full flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : filteredItems.length > 0 ? (
        filteredItems.map((item) => (
          <ListingCard
            key={item.id}
            item={item}
            showSeller={true}
            showSalesCount={true}
            isMyStall={false}
          />
        ))
      ) : (
        <p className="col-span-full text-center text-gray-400">
          No matching items found.
        </p>
      )}
    </div>
  );
};

const renderMyStallContent = () => {
  const filteredItems = dataItems
  .filter(item => 
    item.seller.toLowerCase() === account.toLowerCase() &&
    (item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
     item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  return (
    <div className="relative min-h-[485px]">
      {!account && renderLockScreen()}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 ${!account ? 'blur-sm' : ''}`}>
        {loading ? (
          <div className="col-span-full flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <ListingCard
              key={item.id}
              item={item}
              showSalesCount={true}
              isMyStall={true}
            />
          ))
        ) : (
          <p className="col-span-full text-center text-gray-400">
            No matching items found.
          </p>
        )}
      </div>
    </div>
  );
};

const renderInventoryContent = () => {
  const filteredItems = inventoryItems.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );
  return (
    <div className="relative min-h-[485px]">
      {!account && renderLockScreen()}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 ${!account ? 'blur-sm' : ''}`}>
        {loading ? (
          <div className="col-span-full flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <ListingCard
              key={item.id}
              item={item}
              showSeller={true}
              showSalesCount={false}
              isMyInventory={true}
            />
          ))
        ) : (
          <p className="col-span-full text-center text-gray-400">
            No matching items found.
          </p>
        )}
      </div>
    </div>
  );
};



return (
  <div className="min-h-screen relative bg-[url('/images/zoom_background.jpg')] bg-cover bg-center bg-fixed">
  {/* Add an overlay to ensure text readability */}
  <div className="absolute inset-0 bg-gray-900/40"></div>

    {/* Main content container */}
    <div className="relative z-10 min-h-screen text-white">
      {/* Navigation bar with semi-transparent background */}
      <div className="sticky top-0 bg-gray-900/75 backdrop-blur-sm border-b border-gray-800 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
      <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0">
      {/* Clickable Logo */}
      <div 
        className="bg-gray-900 flex items-center cursor-pointer hover:opacity-80 transition-all duration-200"
        onClick={() => handleTabChange('home')}
      >
        <img 
          src="icon.ico"
          className="h-10 w-25" 
        />
      </div>
    {/* Navigation Buttons */}
    <div className="flex gap-2 sm:gap-4 sm:ml-4">
      <Button 
        variant="ghost"
        onClick={() => handleTabChange('browse')}
        className={`h-10 px-4 font-bold flex items-center justify-center border-none relative
          ${activeTab === 'browse' 
            ? 'text-white after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-blue-500' 
            : 'text-gray-400 hover:text-white hover:bg-gray-800'
          } transition-all duration-200`}
      >
        Browse
      </Button>
      <Button
        variant="ghost"
        onClick={() => handleTabChange('upload')}
        className={`h-10 px-4 font-bold flex items-center justify-center border-none relative
          ${activeTab === 'upload' 
            ? 'text-white after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-blue-500' 
            : 'text-gray-400 hover:text-white hover:bg-gray-800'
          } transition-all duration-200`}
        //disabled={!account}
      >
        Upload
      </Button>
      <Button 
    variant="ghost"
    onClick={() => window.open('https://adityamelkote.github.io/DSC180B/', '_blank')}
    className="h-10 px-4 font-bold flex items-center justify-center border-none text-gray-400 hover:text-white hover:bg-gray-800 transition-all duration-200"
  >
    About
  </Button>
    </div>
  </div>

  {!account ? (
    <Button onClick={connectWallet} variant="outline" className = "w-full sm:w-[160px] border border-white text-white hover:bg-gray-800 hover:text-white transition-all duration-200 font-bold">
      Connect Wallet
    </Button>
  ) : (
    <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
      {/* Network and Balance info */}
      <div className="flex items-center space-x-4 w-full sm:w-auto justify-center sm:justify-start">
        <div className="relative flex items-center space-x-2 group text-sm sm:text-base">
          <span className="font-bold">{network.toUpperCase()}</span>
          <div className="absolute top-full mt-2 flex flex-col items-center hidden group-hover:flex">
            <span className="relative z-10 p-2 text-xs leading-none text-white whitespace-no-wrap bg-black shadow-lg rounded-md">
              Current Network
            </span>
          </div>
        </div>
        <div className="relative flex items-center space-x-2 group text-sm sm:text-base">
          <span className="font-bold">{parseFloat(balance).toFixed(2)} {currency}</span>
          <div className="absolute top-full mt-2 flex flex-col items-center hidden group-hover:flex">
            <span className="relative z-10 p-2 text-xs leading-none text-white whitespace-no-wrap bg-black shadow-lg rounded-md">
              Your Balance
            </span>
          </div>
        </div>
      </div>

      {/* Dropdown Menu */}
      <div className="w-full sm:w-auto">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full sm:w-[160px] px-4 py-2 border rounded cursor-pointer hover:text-white hover:bg-gray-800 transition-all duration-200 font-bold text-sm sm:text-base">
            {account.slice(0, 6)}...{account.slice(-4)}
          </DropdownMenuTrigger>
          <DropdownMenuContent 
          align="end" 
          className="w-[160px] bg-gray-800 text-white p-2 rounded-md shadow-lg z-50" 
        >
          <DropdownMenuItem 
            onClick={() => handleTabChange("my-stall")}
            className="flex items-center space-x-2 px-3 py-2 hover:bg-gray-700 rounded-md cursor-pointer"
          >
            <Store className="h-4 w-4" />
            <span>My Stall</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handleTabChange("inventory")}
            className="flex items-center space-x-2 px-3 py-2 hover:bg-gray-700 rounded-md cursor-pointer"
          >
            <List className="h-4 w-4" />
            <span>Inventory</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={disconnectWallet} 
            className="flex items-center space-x-2 px-3 py-2 hover:bg-red-600 text-red-500 hover:text-white rounded-md cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )}
</div>
</div>
</div>

<div className="max-w-7xl mx-auto px-6 py-8">
    {activeTab === 'upload' && (
        <div className="space-y-6 relative">
    <h1 className="text-3xl font-bold text-white">Upload Data</h1>
    <div className="relative min-h-[485px]">
    {!account && renderLockScreen()}
    <Card className={`w-full max-w-2xl mx-auto bg-gray-900 shadow-lg rounded-lg ${!account ? 'blur-sm' : ''}`}>
      <CardContent className="p-4 sm:p-8 space-y-4 sm:space-y-6">
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
          <p className="mt-1 text-sm text-gray-400">Minimum price: 0.001 ETH</p>
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
        {/* Remove PII Checkbox */}
        <div>
              <label className="block mb-2 text-lg font-semibold text-gray-300">
                <input
                  type="checkbox"
                  checked={removePii}
                  onChange={handlePiiToggle} // Toggle the value of `removePii` when clicked
                  className="mr-2"
                />
                Remove PII from the file
              </label>
            </div>

        {/* Upload Button */}
        <Button
        onClick={uploadFile}
        disabled={uploading || !file || !price || !description}
        className="mt-6 w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
      >
        <Upload className="h-4 w-4" />
        <span>{uploading ? "Uploading..." : "Upload"}</span>
        </Button>
      </CardContent>
    </Card>
  </div>
  </div>
)}

{activeTab === 'home' && (
  <div className="min-h-screen flex flex-col items-center justify-center text-center p-4 sm:p-6">
    {/* Title with fade-in effect */}
    <motion.h1 
      className="text-4xl sm:text-6xl font-bold leading-tight"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 2 }}
    >
      Welcome to the Data Match
    </motion.h1>

    {/* Subtitle with slight delay */}
    <motion.p 
      className="text-lg sm:text-xl text-gray-300 max-w-xl mt-4"
      initial={{ opacity: 0, y: -10 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 1, delay: 1 }}
    >
      High-Quality Data Marketplace secured by Blockchain Tech
    </motion.p>

    {/* Buttons with delay after text appears */}
    <motion.div 
      className="mt-6 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1, delay: 1 }}
    >
      <Button 
        onClick={() => setActiveTab('browse')} 
        className="bg-white text-gray-900 px-6 py-3 rounded-lg font-bold hover:bg-gray-200 transition-all duration-200"
      >
        Browse Datasets
      </Button>
      <Button 
        onClick={() => setActiveTab('upload')} 
        className="bg-gray-700 text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-800 transition-all duration-200"
      >
        Upload Data
      </Button>
    </motion.div>
  </div>
)}

{activeTab === 'browse' && (
  <div className="space-y-6">
  {/* Flex container for title and search bar */}
  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
  <h1 className="text-2xl sm:text-3xl font-bold text-white">Marketplace</h1>
  <div className="relative w-full max-w-md">
    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
    <input
      type="text"
      placeholder="Search datasets..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="w-full p-2 pl-10 border border-gray-600 rounded-md bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
</div>

  {renderBrowseContent()}
</div>
)}

{activeTab === 'my-stall' && (
  <div className="space-y-6">
    {/* Flex container for title and search bar */}
    <div className="flex justify-between items-center">
      <h1 className="text-3xl font-bold text-white">My Stall</h1>
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search your listings..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2 pl-10 border border-gray-600 rounded-md bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
</div>
    {renderMyStallContent()}
  </div>
)}

{activeTab === 'inventory' && (
  <div className="space-y-6">
    {/* Flex container for title and search bar */}
    <div className="flex justify-between items-center">
      <h1 className="text-3xl font-bold text-white">My Inventory</h1>
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search your purchases..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2 pl-10 border border-gray-600 rounded-md bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
    {renderInventoryContent()}
  </div>
)}
              </div>
            </div>
            </div>
          );
}