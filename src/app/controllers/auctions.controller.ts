import {Request, Response} from "express";
import Logger from '../../config/logger';
import * as auctions from '../models/auctions.model';
import {getAuth, getOne} from "../models/user.model";
import fs from "mz/fs";


const imageDirectory = './storage/images/';

const viewAuctions = async (req: Request, res: Response):Promise<void> => {
    Logger.http(`GET all or a subset of the auctions.`)
    let query = "where true";
    let sort = " ";

    if (req.query.hasOwnProperty("sellerId")) {
        query += ` and seller_id = ${req.query.sellerId}`;
    }
    if (req.query.hasOwnProperty("categoryIds")) {
        const ids = req.query.categoryIds;
        query += ` and category_id in (${ids})`;
    }
    if (req.query.hasOwnProperty("bidderId")) {
        query += ` and user_id = ${req.query.bidderId}`;
    }
    if (req.query.hasOwnProperty("q")) {
        query += ` and (title like "%${req.query.q}%" or description like "%${req.query.q}%")`;
    }


    let sortType = "";
    if ((!req.query.hasOwnProperty("sortBy")) || (req.query.sortBy === `CLOSING_SOON`)) {
        sortType += `CLOSING_SOON`;
    } else {
        sortType += `${req.query.sortBy}`;
    }
    switch (sortType) {
        case 'ALPHABETICAL_ASC':
            sort += "order by title";
            break;
        case 'ALPHABETICAL_DESC':
            sort += "order by title desc";
            break;
        case 'BIDS_ASC':
            sort += "order by highestBid";
            break;
        case 'BIDS_DESC':
            sort += "order by highestBid desc";
            break;
        case 'CLOSING_LAST':
            sort += "order by endDate desc";
            break;
        case 'RESERVE_ASC':
            sort += "order by reserve";
            break;
        case 'RESERVE_DESC':
            sort += "order by reserve desc";
            break;
        case 'CLOSING_SOON':
            sort += "order by endDate";
            break;
    }

    if (req.query.hasOwnProperty("count")) {
        sort += ` limit ${req.query.count}`;
    } else {
        sort += ` limit 9999999999`;
    }
    if (req.query.hasOwnProperty("startIndex")) {
        sort += ` offset ${req.query.startIndex}`;
    }

    try {
        const result = await auctions.findAuc(query, sort);
        res.status(200).send(result );
        return;
    } catch(err) {
        res.status(500).send(`ERROR finding auctions: ${err}`);
        return;
    }
};

const addAuction = async (req: Request, res: Response):Promise<void> => {
    Logger.http(`POST creating a auction item.`)

    if (!req.header("X-Authorization")) {
        res.status(401).send(`Please ensure token is given.`);
        return;
    }
    const token = req.header("X-Authorization");

    if (!(req.body.title && req.body.description && req.body.categoryId && req.body.endDate)){
        res.status(400).send("Please provide all needed fields.");
        return;
    }

    if (Date.now() >= Date.parse(req.body.endDate)) {
        res.status(400).send("Please provide a date in the future.");
        return;
    }

    let reserve: number;
    if (!req.body.reserve) {
        reserve = 1;
    } else {
        reserve = parseInt(req.body.reserve, 10);
    }
    const title = req.body.title;
    const description = req.body.description;
    const categoryId = parseInt(req.body.categoryId, 10);
    const endDate = req.body.endDate;
    try {
        if (!(await auctions.checkCat(req.body.categoryId))) {
            res.status(400).send("Please provide an existing category.");
            return
        }

        const result = await getAuth(token);
        if (result.length !== 1) {
            res.status(401).send("No user with that token.");
        }
        const addResult = await auctions.createAuc(title, description, categoryId, endDate, reserve, result[0].userId);
        res.status(201).send(addResult);
        return;
    } catch(err) {
        res.status(500).send(`ERROR making auctions: ${err}`);
        return;
    }
};

const viewOne = async (req: Request, res: Response):Promise<void> => {
    Logger.http(`GET view an auction item.`)
    if ((req.params.id.replace(/\s/g, "") === "") || isNaN(Number(req.params.id)) || ((Number(req.params.id) % 1) !== 0)) {
        res.status(404).send(`Auction can not be found.`);
        return;
    }
    const id = req.params.id;
    try {
        const result = await auctions.getOne(parseInt(id, 10));
        if (result.length === 0) {
            res.status(404).send("No auction found.");
            return;
        }
        delete result[0].imageName;
        res.status(200).send(result[0]);
        return;
    } catch(err) {
        res.status(500).send(`ERROR finding auctions: ${err}`);
        return;
    }
};

const updateAuction = async (req: Request, res: Response):Promise<void> => {
    Logger.http(`PATCH update auction for Id: ${req.params.id}`)
    if ((req.params.id.replace(/\s/g, "") === "") || isNaN(Number(req.params.id)) || ((Number(req.params.id) % 1) !== 0)) {
        res.status(404).send(`Auction can not be found.`);
        return;
    }
    const id = req.params.id;

    if (!req.header("X-Authorization")) {
        res.status(401).send("Please ensure token is given.");
        return;
    }
    const token = req.header("X-Authorization"); // Check if user auth.

    try {
        const auctionItem = await auctions.getOne(parseInt(id, 10)); // Gets a user to be updated.
        if (auctionItem.length === 0) {
            res.status(404).send("Could not find a auction with that id.");
            return;
        }
        const userResult = await getOne(auctionItem[0].sellerId); // Gets an auction to be updated.
        if (userResult.length === 0) {
            res.status(404).send("Could not find the user associated with the auction.");
            return;
        } else if ((!userResult[0].auth_token) || (userResult[0].auth_token !== token)) {
            res.status(403).send("Invalid token used.");
            return;
        }

        if (req.body.hasOwnProperty("title")) {
            auctionItem[0].title = req.body.title;
        }

        if (req.body.hasOwnProperty("description")) {
            auctionItem[0].description = req.body.description;
        }

        if (req.body.hasOwnProperty("categoryId")) {
            if (!(await auctions.checkCat(req.body.categoryId))) {
                res.status(400).send("Please provide an existing category.");
                return
            }
            auctionItem[0].categoryId = req.body.categoryId;
        }

        if (req.body.hasOwnProperty("endDate")) {
            if (Date.now() >= Date.parse(req.body.endDate)) {
                res.status(400).send("Please provide a date in the future.");
                return;
            }
            auctionItem[0].endDate = req.body.endDate;
        }

        if (req.body.hasOwnProperty("reserve")) {
            if (req.body.reserve <= 0) {
                res.status(400).send("Please provide a reserve of at least 1.");
                return;
            }
            auctionItem[0].reserve = req.body.reserve;
        }

        await auctions.alter(auctionItem[0], parseInt(id, 10));
        res.status(200).send( `Auction ${id} data updated.` );
        return;
    } catch(err) {
        res.status(500).send(`ERROR updating auction : ${err}`);
        return;
    }
};

const removeAuction = async (req: Request, res: Response):Promise<void> => {
    Logger.http(`DELETE auction with Id: ${req.params.id}`)
    if ((req.params.id.replace(/\s/g, "") === "") || isNaN(Number(req.params.id)) || ((Number(req.params.id) % 1) !== 0)) {
        res.status(404).send(`Auction can not be found.`);
        return;
    }
    const id = req.params.id;

    if (!req.header("X-Authorization")) {
        res.status(401).send("Please ensure token is given.");
        return;
    }
    const token = req.header("X-Authorization"); // Check if user auth.

    try {
        const auctionItem = await auctions.getOne(parseInt(id, 10)); // Gets an auction to be updated.
        if (auctionItem.length === 0) {
            res.status(404).send("Could not find a auction with that id.");
            return;
        } else if (auctionItem[0].numBids !== 0) {
            res.status(403).send("Bids already made on this auction.");
            return;
        }
        const userResult = await getOne(auctionItem[0].sellerId); // Gets a user to be updated.
        if (userResult.length === 0) {
            res.status(404).send("Could not find the user associated with the auction.");
            return;
        } else if ((!userResult[0].auth_token) || (userResult[0].auth_token !== token)) {
            res.status(403).send("Invalid token used.");
            return;
        }

        if (auctionItem[0].imageName !== null) {
            if (await fs.exists(`${imageDirectory}${auctionItem[0].imageName}`)) {
                await fs.unlink(`${imageDirectory}${auctionItem[0].imageName}`); // create/replace image in local
            }
        }

        await auctions.deleteAuc(parseInt(id, 10));
        res.status(200).send( `Auction ${id} data was deleted.` );
        return;
    } catch(err) {
        res.status(500).send(`ERROR deleting auction : ${err}`);
        return;
    }
};

const viewCategories = async (req: Request, res: Response):Promise<void> => {
    Logger.http(`GET all Categories.`)

    try {
        const result = await auctions.getCat();
        res.status(200).send(result);
        return;
    } catch(err) {
        res.status(500).send(`ERROR login user : ${err}`);
        return;
    }
};

const getAucImage = async (req: Request, res: Response):Promise<void> => {
    Logger.http(`GET auction photo for: ${req.params.id}`)
    if ((req.params.id.replace(/\s/g, "") === "") || isNaN(Number(req.params.id)) || ((Number(req.params.id) % 1) !== 0)) {
        res.status(404).send(`Auction can not be found.`);
        return;
    }
    const id = req.params.id;

    try {
        const result = await auctions.getAucImage(parseInt(id, 10));
        if((result.length === 0) || (result[0].imageFilename === null)) {
            res.status(404).send(`Auction photo can not be found.`);
            return;
        }
        const imageBuffer = await fs.readFile(`${imageDirectory}${result[0].imageFilename}`);
        const splitStrings =  result[0].imageFilename.split('.');
        let ext = (splitStrings[splitStrings.length - 1]).toLowerCase();
        if (ext === 'jpg') {
            ext = 'jpeg';
        }
        res.contentType(`image/${ext}`);
        res.status(200).send(imageBuffer);
        return;
    } catch(err) {
        res.status(500).send(`ERROR getting all categories: ${err}`);
        return;
    }
};

const setAucImage = async (req: Request, res: Response):Promise<void> => {
    Logger.http(`PUT a auction photo for: ${req.params.id}`)
    if ((req.params.id.replace(/\s/g, "") === "") || isNaN(Number(req.params.id)) || ((Number(req.params.id) % 1) !== 0)) {
        res.status(404).send(`Auction can not be found.`);
        return;
    }
    const id = req.params.id;

    if (!req.header("X-Authorization")) {
        res.status(401).send("Please ensure token is given.");
        return;
    }
    const token = req.header("X-Authorization");

    if (!req.header("Content-Type")) {
        res.status(400).send("No content type specified.");
        return;
    }
    const data = req.body;
    const type =  req.header("Content-Type").substring(6).toLowerCase();
    let ext = "";
    switch (type) {
        case "png":
            ext = "png";
            break;
        case "jpeg":
            ext = "jpg";
            break;
        case "gif":
            ext = "gif";
            break;
        default:
            res.status(400).send("Invalid content type given.");
            return;
    }

    try {
        const auctionItem = await auctions.getOne(parseInt(id, 10)); // Gets an auction to be updated.
        if (auctionItem.length === 0) {
            res.status(404).send("Could not find a auction with that id.");
            return;
        }

        const userResult = await getOne(auctionItem[0].sellerId); // Gets a user to be updated.
        if (userResult.length === 0) {
            res.status(404).send("Could not find the user associated with the auction.");
            return;
        } else if ((!userResult[0].auth_token) || (userResult[0].auth_token !== token)) {
            res.status(403).send("Invalid token used.");
            return;
        }

        const currImage = await auctions.getAucImage(parseInt(id, 10));
        await auctions.setAucImage(parseInt(id, 10), ext);
        await fs.writeFileSync(`${imageDirectory}auction_${id}.${ext}`, data); // create/replace image in local
        if (currImage[0].imageFilename !== null) {
            res.status(200).send(`Image updated for user ${id}`);
            return;
        } else {
            res.status(201).send(`Image created for user ${id}`);
            return;
        }

    } catch(err) {
        res.status(500).send(`ERROR adding auction photo ${id}: ${err}`);
        return;
    }
};

const viewBids = async (req: Request, res: Response):Promise<void> => {
    Logger.http(`GET auction bids for: ${req.params.id}`)
    if ((req.params.id.replace(/\s/g, "") === "") || isNaN(Number(req.params.id)) || ((Number(req.params.id) % 1) !== 0)) {
        res.status(404).send(`Auction can not be found.`);
        return;
    }
    const id = req.params.id;

    try {
        const auctionItem = await auctions.getOne(parseInt(id, 10)); // Gets an auction to be updated.
        if (auctionItem.length === 0) {
            res.status(404).send("Could not find a auction with that id.");
            return;
        }


        const bidResults = await auctions.viewBids(parseInt(id, 10));
        res.status(200).send(bidResults);
        return;
    } catch(err) {
        res.status(500).send(`ERROR getting bids ${id}: ${err}`);
        return;
    }
};

const makeBid = async (req: Request, res: Response):Promise<void> => {
    Logger.http(`POST auction bids for: ${req.params.id}`)
    if ((req.params.id.replace(/\s/g, "") === "") || isNaN(Number(req.params.id)) || ((Number(req.params.id) % 1) !== 0)) {
        res.status(404).send(`Auction can not be found.`);
        return;
    }
    const id = req.params.id;

    if (!req.header("X-Authorization")) {
        res.status(401).send("Please ensure token is given.");
        return;
    }
    const token = req.header("X-Authorization");

    if (!req.body.hasOwnProperty("amount")) {
        res.status(400).send("Please enter a bid.");
        return;
    }
    const amount = req.body.amount;

    try {
        const auctionItem = await auctions.getOne(parseInt(id, 10)); // Gets an auction to be updated.
        if (auctionItem.length === 0) {
            res.status(404).send("Could not find a auction with that id.");
            return;
        }

        if ((auctionItem[0].highestBid === null) && (parseInt(req.params.amount, 10) < auctionItem[0].reserve)) {
            res.status(400).send("Please bid that meets the reserved price.");
            return;
        } else if (parseInt(req.params.amount, 10) <= auctionItem[0].highestBid) {
            res.status(400).send("Please enter a bid greater than current max bif.");
            return;
        }


        const result = await getAuth(token);
        if (result.length !== 1) {
            res.status(401).send("No user with that token.");
        } else if (auctionItem[0].sellerId === result[0].userId) {
            res.status(403).send("You can not bid on your own auction.");
            return;
        }
        await auctions.makeBid(parseInt(id, 10), result[0].userId, parseInt(amount, 10));
        res.status(201).send();
        return;
    } catch(err) {
        res.status(500).send(`ERROR creating a bid: ${err}`);
        return;
    }
};



export {viewAuctions, addAuction, viewOne, updateAuction, removeAuction, viewCategories,
    getAucImage, setAucImage, viewBids, makeBid}
