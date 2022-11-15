import {getPool} from "../../config/db";

import Logger from "../../config/logger";

const findAuc = async(whereQ: string, sort: string) : Promise<AucSearch> => {
    Logger.info(`Finding auctions or subset.`);
    const conn = await getPool().getConnection();

    const values = "auction.id as auctionId, title, category_id as categoryId, seller_id as sellerId," +
        " first_name as sellerFirstName, last_name as sellerLastName, reserve, (select count(auction_id) from auction_bid where auction_bid.auction_id = auction.id) as numBids, " +
        " (select max(amount) from auction_bid where auction_bid.auction_id = auction.id) as highestBid, end_date as endDate";
    const aucQuery = `select distinct ${values} from auction inner join user u on auction.seller_id = u.id left join auction_bid ab on auction.id = ab.auction_id ${whereQ} ${sort}`;
    const [ aucResult ] = await conn.query(aucQuery);

    const countQuery = `select count(distinct auction.id) as count from auction left join auction_bid ab on auction.id = ab.auction_id ${whereQ}`;
    const [ countResult ] = await conn.query(countQuery);
    const resSearch: AucSearch = {
        auctions: aucResult,
        count: countResult[0].count
    }
    conn.release();
    return resSearch;
}

const createAuc = async(title: string, description: string, categoryId: number, endDate: string, reserve: number, userId: number) : Promise<AucId> => {
    Logger.info(`Making a auction.`);
    const conn = await getPool().getConnection();

    const query = `insert into auction set title = ?, description = ?, end_date = ?, reserve = ?, category_id = ?, seller_id = ?`;
    const [ result ] = await conn.query(query, [title, description, endDate, reserve, categoryId, userId]);
    conn.release();

    return {
        auctionId: result.insertId
    };
}

const checkCat = async(categoryId: number) : Promise<CatId> => {
    Logger.info(`Finding category id to ensure it exists.`);
    const conn = await getPool().getConnection();

    const query = `select id as auctionId from category where id = ?`;
    const [ result ] = await conn.query(query, [categoryId]);
    conn.release();

    return result[0];
}

const getOne = async(id: number) : Promise<AuctionMax[]> => {
    Logger.info(`Finding and auction related to id: ${id}.`);
    const conn = await getPool().getConnection();

    const values = "auction.id as auctionId, title, category_id as categoryId, seller_id as sellerId," +
        " first_name as sellerFirstName, last_name as sellerLastName, auction.image_filename as imageName, reserve, (select count(auction_id) from auction_bid where auction_bid.auction_id = auction.id) as numBids, " +
        " (select max(amount) from auction_bid where auction_bid.auction_id = auction.id) as highestBid, end_date as endDate, description";
    const query = `select ${values} from auction inner join user u on auction.seller_id = u.id left join auction_bid ab on auction.id = ab.auction_id where auction.id = ?`;
    const [ result ] = await conn.query(query, [id]);
    conn.release();

    return result;
}

const alter = async(data: AuctionMax, id: number) : Promise<any> => {
    Logger.info(`Finding and auction related to id: ${id}.`);
    const conn = await getPool().getConnection();

    const query = `update auction set title = ?, description = ?, category_id = ?, end_date = ?, reserve = ? where id = ?`;
    const [ result ] = await conn.query(query, [data.title, data.description, data.categoryId, data.endDate, data.reserve, id]);
    conn.release();

    return result;
}

const deleteAuc = async(id: number) : Promise<any> => {
    Logger.info(`Deleting an auction related to id: ${id}.`);
    const conn = await getPool().getConnection();

    const query = `delete from auction where id = ?`;
    const [ result ] = await conn.query(query, [id]);
    conn.release();

    return result;
}

const getCat = async() : Promise<Category[]> => {
    Logger.info(`Finds all categories.`);
    const conn = await getPool().getConnection();

    const query = `select id as categoryId, name from category`;
    const [ result ] = await conn.query(query);
    conn.release();

    return result;
}

const getAucImage = async(id: number) : Promise<any> => {
    Logger.info(`Finding auction photo with id: ${id}.`);
    const conn = await getPool().getConnection();

    const query = "select image_filename as imageFilename from auction where id = ?";
    const [ result ] = await conn.query( query, [ id ] );

    conn.release(result);
    return result;
}

const setAucImage = async(id: number, ext: string) : Promise<any> => {
    Logger.info(`Sets an auction photo with id: ${id}.`);
    const conn = await getPool().getConnection();
    const query = "update auction set image_filename = ? where id = ?";
    const [ result ] = await conn.query( query, [ `auction_${id}.${ext}`, id ] );
    return result;
}

const viewBids = async(id: number) : Promise<any> => {
    Logger.info(`Get all bids on an auction with id: ${id}.`);
    const conn = await getPool().getConnection();

    const query = "select auction_bid.id as bidderId, amount, first_name as firstName, last_name as lastName, timestamp from auction_bid inner join user u on auction_bid.user_id = u.id where auction_id = ? order by amount desc";
    const [ result ] = await conn.query( query, [ id ] );
    return result;
}

const makeBid = async(aucId: number, userId: number, amount: number) : Promise<any> => {
    Logger.info(`Create a bid on an auction with id: ${aucId}.`);
    const conn = await getPool().getConnection();
    const now = new Date(Date.now());
    const dateString = now.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    const query = "insert into auction_bid set auction_id = ?, user_id = ?, amount = ?, timestamp = ?";
    const [ result ] = await conn.query( query, [aucId, userId, amount, dateString] );
    return result;
}

export {findAuc, createAuc, checkCat, getOne, alter, deleteAuc, getCat, getAucImage, setAucImage, viewBids, makeBid}
