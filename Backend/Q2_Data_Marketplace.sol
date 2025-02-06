// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DataMarketplace {
    struct DataItem {
        address seller;
        uint price; // Price in wei
        string description; // Description of the data
        uint salesCount; // Number of times sold
    }

    mapping(uint256 => DataItem) public dataItems; // Maps item IDs to DataItem
    mapping(uint256 => string) private cidMapping; // Maps item IDs to their CID (hidden from public)
    mapping(address => uint256[]) public userPurchases; // Maps buyers to purchased item IDs
    uint256 public itemCount; // Counter for items listed

    // Events
    event DataListed(uint256 itemId, address indexed seller, uint price, string description);
    event DataPurchased(uint256 itemId, address indexed buyer, uint salesCount);

    // List a new data item for sale
    function listData(
        string calldata cid,
        uint price,
        string calldata description
    ) external {
        require(price > 0, "Price must be greater than zero");

        uint256 newItemId = itemCount;
        dataItems[newItemId] = DataItem({
            seller: msg.sender,
            price: price,
            description: description,
            salesCount: 0
        });
        cidMapping[newItemId] = cid; // Store the CID privately
        itemCount++;

        emit DataListed(newItemId, msg.sender, price, description);
    }

    // Buy a data item
    function buyData(uint256 itemId) external payable {
        DataItem storage item = dataItems[itemId];
        require(item.seller != address(0), "Item does not exist");
        require(msg.sender != item.seller, "Cannot buy your own item");
        require(msg.value == item.price, "Incorrect payment amount");

        // Increment sales count
        item.salesCount++;
        userPurchases[msg.sender].push(itemId);

        // Transfer payment to the seller
        (bool sent, ) = item.seller.call{value: msg.value}("");
        require(sent, "Failed to send Ether");

        emit DataPurchased(itemId, msg.sender, item.salesCount);
    }

    // Get public details of a data item
    function getDataItem(uint256 itemId) external view returns (address, uint, string memory, uint) {
        DataItem storage item = dataItems[itemId];
        require(item.seller != address(0), "Item does not exist");
        return (item.seller, item.price, item.description, item.salesCount);
    }

    // Get private CID (only accessible to seller or buyer)
    function getCID(uint256 itemId) external view returns (string memory) {
        DataItem storage item = dataItems[itemId];
        require(item.seller == msg.sender || hasPurchased(msg.sender, itemId), "Access denied");
        return cidMapping[itemId];
    }

    // Check if a user has purchased an item
    function hasPurchased(address user, uint256 itemId) public view returns (bool) {
        uint256[] memory purchases = userPurchases[user];
        for (uint i = 0; i < purchases.length; i++) {
            if (purchases[i] == itemId) {
                return true;
            }
        }
        return false;
    }
}