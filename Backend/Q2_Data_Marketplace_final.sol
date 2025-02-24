// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DataMarketplace {
    struct FileMetadata {
        string title;
        string description;
        uint256 fileSize;
        string fileType;
        uint256 timestamp;
        string logoCid;
    }
    struct DataItem {
        address seller;
        uint256 price;
        uint256 salesCount;
        bool active;
        FileMetadata metadata;
    }

    mapping(uint256 => DataItem) public dataItems; // Maps item IDs to DataItem
    mapping(uint256 => string) private cidMapping; // Maps item IDs to their CID (hidden from public)
    mapping(address => uint256[]) public userPurchases; // Maps buyers to purchased item IDs
    uint256 public itemCount; // Counter for items listed

    // Events
    event DataListed(uint256 itemId, address indexed seller, uint price, string description);
    event DataPurchased(uint256 itemId, address indexed buyer, uint salesCount);
    event DataRemoved(uint256 itemId, address indexed seller);

    // List a new data item for sale
    function listData(
        string calldata cid,
        uint256 price,
        FileMetadata calldata metadata
    ) external {
        require(price > 0, "Price must be greater than zero");

        uint256 newItemId = itemCount;
        dataItems[newItemId] = DataItem({
            seller: msg.sender,
            price: price,
            salesCount: 0,
            active: true,
            metadata: metadata
        });
        cidMapping[newItemId] = cid; // Store the CID
        itemCount++;

        emit DataListed(newItemId, msg.sender, price, metadata.title);
    }

    // **Updated Buy Data Function - Prevents Duplicate Purchases**
    function buyData(uint256 itemId) external payable {
        DataItem storage item = dataItems[itemId];
        require(item.seller != address(0), "Item does not exist");
        require(msg.sender != item.seller, "Cannot buy your own item");
        require(msg.value == item.price, "Incorrect payment amount");
        require(!hasPurchased(msg.sender, itemId), "You already purchased this item!");

        // Increment sales count
        item.salesCount++;
        userPurchases[msg.sender].push(itemId);

        // Transfer payment to the seller
        (bool sent, ) = item.seller.call{value: msg.value}("");
        require(sent, "Failed to send POL");

        emit DataPurchased(itemId, msg.sender, item.salesCount);
    }

    // **Fetch all purchases made by a user**
    function getUserPurchases(address user) external view returns (uint256[] memory) {
        return userPurchases[user];
    }

    // **Check if a user has purchased an item**
    function hasPurchased(address user, uint256 itemId) public view returns (bool) {
        uint256[] memory purchases = userPurchases[user];
        for (uint i = 0; i < purchases.length; i++) {
            if (purchases[i] == itemId) {
                return true;
            }
        }
        return false;
    }

    // **Fetch data item details**
    function getDataItem(uint256 itemId) external view returns (
        address seller,
        uint256 price,
        uint256 salesCount,
        bool active) {
        DataItem storage item = dataItems[itemId];
        require(item.seller != address(0), "Item does not exist");
        return (
            item.seller,
            item.price,
            item.salesCount,
            item.active);
    }

    // **Get Metadata details**
    function getItemMetadata(uint256 itemId) external view returns (FileMetadata memory) {
        DataItem storage item = dataItems[itemId];
        require(item.seller != address(0), "Item does not exist");
        return item.metadata;
    }

    // **Get CID (Only accessible to buyer or seller)**
    function getCID(uint256 itemId) external view returns (string memory) {
        DataItem storage item = dataItems[itemId];
        require(item.seller == msg.sender || hasPurchased(msg.sender, itemId), "Access denied");
        return cidMapping[itemId];
    }

    // **Check if an item is still active**
    function getStatus(uint256 itemId) external view returns (bool) {
        DataItem storage item = dataItems[itemId];
        require(item.seller != address(0), "Item does not exist");
        return item.active;
    }

    // **Delist an item from sale**
    function deListData(uint256 itemId) external {
        DataItem storage item = dataItems[itemId];
        require(msg.sender == item.seller, "Only the seller can delist");
        require(item.seller != address(0), "Item does not exist");
        require(item.active == true, "Item is already inactive");

        item.active = false;
        emit DataRemoved(itemId, msg.sender);
    }
}