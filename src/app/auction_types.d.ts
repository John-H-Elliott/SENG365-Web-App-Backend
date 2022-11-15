type Auction = {
    "auctionId": number,
    "title": string,
    "categoryId": number,
    "sellerId": number,
    "sellerFirstName": string,
    "sellerLastName": string,
    "reserve": number,
    "numBids": number,
    "highestBid": number,
    "endDate": string
}

type AuctionMax = {
    "auctionId": number,
    "title": string,
    "categoryId": number,
    "sellerId": number,
    "sellerFirstName": string,
    "sellerLastName": string,
    "imageName": string,
    "reserve": number,
    "numBids": number,
    "highestBid": number,
    "endDate": string,
    "description": string
}

type AucSearch = {
    "auctions": Auction[],
    "count": number
}

type AucId = {
    "auctionId": number
}

type Category = {
    "categoryId": number,
    "name": string
}

type CatId = {
    "categoryId": number
}