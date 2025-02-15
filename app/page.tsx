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
import { AlertCircle, Upload, ShoppingCart, List, Loader2, Trash2, Store } from 'lucide-react';
import { Alert, AlertDescription } from "@/utils/components/ui/alert";


declare global {
  interface Window{
    ethereum?:MetaMaskInpageProvider
  }
}
export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
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

  useEffect(() => {
    //initializeEthers();
    loadItems();
  }, []);

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
          const item = await contract.getDataItem(id);
          const cid = await contract.getCID(id);
          console.log(`Fetched CID: ${cid}`);

          return {
            id: id.toString(),
            seller: item[0],
            price: item[1],  // Convert Wei to POL
            item_cid: cid,
            description: item[2],
            salesCount: item[3].toString(),
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
      // Initialize ethers first
      const provider = await initializeEthers();
      if (!provider) return;

      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length === 0) {
        console.log("No accounts found");
        return;
      }

      // Set account and fetch balance
      setAccount(accounts[0]);
      const balance = await provider.getBalance(accounts[0]);
      setBalance(formatEther(balance));

    } catch (error) {
      console.error("Error connecting wallet:", error);
      alert("Failed to connect wallet. Please try again.");
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
          const item = await contract.getDataItem(i);
          items.push({
            id: i,
            seller: item[0],
            price: item[1],
            description: item[2],
            salesCount: toNumber(item[3]),
          });
        }
      }
  
      console.log('Final items array:', items);
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
    let uploadedCID = null;
    try {
      if (!file || !price || !description) {
        alert("Please fill in all fields and connect your wallet");
        return;
      }

      setUploading(true);

      const data = new FormData();
      data.set("file", file);
      data.set("price", price);
      data.set("description", description);
      //data.set("sellerAddress", sellerAddress);

      const response = await fetch("/api/files", {
        method: "POST",
        body: data,
      });

      const { cid } = await response.json();
      uploadedCID = cid;
      
      // Step 2: Interact with the smart contract
      console.log("Getting smart contract instance...");
      const contract = await getContract();
      console.log("Smart contract instance retrieved.");

      // 2. List the data on the blockchain
      console.log("Calling listData on the smart contract...");
      const tx = await contract.listData(cid, parseUnits(price, 18), description);
      console.log("Transaction sent. Waiting for confirmation...");
      await tx.wait(); // Wait for confirmation
      console.log("Transaction confirmed.");
  
      // 3. Refresh the items list
      await loadItems();
  
      alert("File uploaded and listed successfully!");
      
      // Clear form
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setPrice("");
      setDescription("");

      setUploading(false);
    } catch (error) {
      console.error("Error in uploadFile:", error);
      setUploading(false);
      //removes from pinata if failed transaction
      const unpinResponse = await fetch(`/api/files?cid=${uploadedCID}`, {
        method: 'DELETE'
      });
      
      if (!unpinResponse.ok) {
        const errorData = await unpinResponse.json();
        throw new Error(errorData.error || 'Failed to delete file');
      }

        // Clear form
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setPrice("");
        setDescription("");
      alert("Error uploading file");
    }
  };

  const fetchData = async (cid: string, description: string) => {
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
      a.download = `${description}`;
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
  };

  const buyData = async (itemId) => {
    if (!account) {
      alert("Please connect your wallet to make a purchase.");
      return;
    }
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
      

      //remove from IPFS
      const cid = await contract.getCID(itemId);
      
      const unpinResponse = await fetch(`/api/files?cid=${cid}`, {
        method: 'DELETE'
      });
      
      if (!unpinResponse.ok) {
        const errorData = await unpinResponse.json();
        throw new Error(errorData.error || 'Failed to delete file');
      }
      
      const data = await unpinResponse.json();
      console.log('File successfully deleted:', data.message);

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

  const updateBalance = async (account: string) => {
    if (provider) {
      const balance = await provider.getBalance(account);
      setBalance(formatEther(balance));
    }
  };

  const showLoginPopup = () => {
    alert("Please log in to make a purchase.");
  };

  const renderLockScreen = () => (
    <div className="absolute inset-0 bg-gray-900 bg-opacity-75 flex flex-col items-center justify-center z-10" style={{ top: '50%', transform: 'translateY(-50%)' }}>
      <div className="flex flex-col items-center space-y-4">
        <img src="/images/lock_icon.ico" alt="Lock Icon" className="h-20 w-20" />
        <p className="text-white text-xl font-semibold text-center">Please log in to access this feature.</p>
      </div>
    </div>
  );

  const renderInventoryContent = () => (
    <div className="relative min-h-[485px]"> {/* Added min-height */}
      {!account && renderLockScreen()}
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${!account ? 'blur-sm' : ''}`}>
        {loading ? (
          <div className="col-span-full flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : inventoryItems.length > 0 ? (
          inventoryItems.map((item, index) => (
            <Card key={`${item.id}-${index}`}>
              <CardHeader>
                <CardTitle>{item.description}</CardTitle>
                <CardDescription>Price: {Number(formatWeiToEth(item.price)).toFixed(3)} ETH</CardDescription>
              </CardHeader>
              <CardContent>
                <p>Sold {item.salesCount} times</p>
                <p className="text-gray-400 text-sm">Seller: {item.seller}</p>
                <Button 
                  onClick={() => fetchData(item.item_cid, item.description)}
                  disabled={fetchingId === item.item_cid}
                  className={`w-full ${
                    fetchingId === item.item_cid 
                      ? 'bg-gray-400' 
                      : downloadedItems.has(item.item_cid)
                        ? 'bg-green-500 hover:bg-green-600'
                        : 'bg-blue-500 hover:bg-blue-600'
                  } text-white font-bold py-2 px-4 rounded-lg mt-4`}
                >
                  {fetchingId === item.item_cid 
                    ? 'Fetching...' 
                    : downloadedItems.has(item.item_cid)
                      ? 'Download Again'
                      : 'Download'
                  }
                </Button>
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="col-span-full text-center text-gray-400">
            No purchased items found.
          </p>
        )}
      </div>
    </div>
  );

  const renderMyStallContent = () => (
    <div className="relative min-h-[485px]"> {/* Added min-height */}
      {!account && renderLockScreen()}
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${!account ? 'blur-sm' : ''}`}>
        {loading ? (
          <div className="col-span-full flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : dataItems
            .filter(item => item.seller.toLowerCase() === account.toLowerCase())
            .map((item, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-lg">{item.description}</CardTitle>
                  <CardDescription>Sold {item.salesCount} times</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold mb-4">{Number(formatWeiToEth(item.price)).toFixed(3)} ETH</p>
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
                </CardContent>
              </Card>
            ))}
        {!loading && dataItems.filter(item => item.seller.toLowerCase() === account.toLowerCase()).length === 0 && (
          <p className="col-span-full text-center text-gray-400">No items available.</p>
        )}
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
            <div className="flex items-center space-x-2">
              <span>{account.slice(0, 6)}...{account.slice(-4)}</span>
            </div>
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
          <Button
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
          </Button>
        </div>

        {activeTab === 'upload' && (
        <div className="relative">
          {!account && renderLockScreen()}
          <Card className={`max-w-2xl mx-auto bg-gray-900 shadow-lg rounded-lg ${!account ? 'blur-sm' : ''}`}>
            <CardContent className="p-8 space-y-6">
              <h2 className="text-2xl font-bold text-white text-center mb-6">Upload Data For Sale</h2>

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

            {/* Price Input */}
            <div>
              <label className="block mb-2 text-lg font-semibold text-gray-300">Price (POL)</label>
              <Input
                type="number"
                step="0.001"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Enter price in POL"
                className="block w-full text-sm text-gray-300 border border-gray-700 rounded-lg bg-gray-800 p-3 focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50 transition-all"
              />
            </div>

            {/* Description Input */}
            <div>
              <label className="block mb-2 text-lg font-semibold text-gray-300">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your data..."
                className="block w-full text-sm text-gray-300 border border-gray-700 rounded-lg bg-gray-800 p-3 focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50 transition-all"
              />
            </div>

            {/* Upload Button */}
            <button
              onClick={uploadFile}
              disabled={uploading}
              className="mt-6 w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </CardContent>
        </Card>
        </div>
          )}

{activeTab === 'inventory' && renderInventoryContent()}

{activeTab === 'my-stall' && renderMyStallContent()}
  

        {(activeTab === 'browse') && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : dataItems.length > 0 ? (
              dataItems
                .filter(item => {
                  if (activeTab === 'browse') {
                    // Show all items except the current user's in browse tab
                    return item.seller.toLowerCase();
                    // return item.seller.toLowerCase() !== account.toLowerCase();
                  } else if (activeTab === 'my-stall') {
                    // Show only the current user's items in my stall tab
                    return item.seller.toLowerCase() === account.toLowerCase();
                  }
                  return false;
                })
                .map((item, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="text-lg">{item.description}</CardTitle>
                      <CardDescription>
                        Sold {item.salesCount} times
                      </CardDescription>
                    </CardHeader>
                    <CardContent>

        <p className="text-2xl font-bold mb-4">{Number(formatWeiToEth(item.price)).toFixed(3)} ETH</p>
        <div className="flex gap-2">
          {activeTab === 'browse' && (
                        <>
                          {/* Only show Buy Now button if it's not the seller's own listing */}
                          {item.seller.toLowerCase() !== account.toLowerCase() && (
                            <Button 
                              onClick={() => buyData(item.id)}
                              disabled={loading}
                              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {loading ? 'Processing...' : 'Buy Now'}
                            </Button>
                          )}
                        </>
                      )}

        
        </div>

        </CardContent>
              </Card> ))
                    ) : (
                      <p className="col-span-full text-center text-gray-400">No items available.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
}