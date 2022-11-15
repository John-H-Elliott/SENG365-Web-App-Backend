import {Express} from "express";
import {rootUrl} from "./base.routes"

import * as auctions from '../controllers/auctions.controller';

module.exports = (app: Express) => {
    app.route(rootUrl + '/auctions')
        .get(auctions.viewAuctions);

    app.route(rootUrl + '/auctions')
        .post(auctions.addAuction);

    app.route(rootUrl + '/auctions/categories')
        .get(auctions.viewCategories);

    app.route(rootUrl + '/auctions/:id')
        .get(auctions.viewOne);

    app.route(rootUrl + '/auctions/:id')
        .patch(auctions.updateAuction);

    app.route(rootUrl + '/auctions/:id')
        .delete(auctions.removeAuction);

    app.route(rootUrl + '/auctions/:id/image')
        .get(auctions.getAucImage);

    app.route(rootUrl + '/auctions/:id/image')
        .put(auctions.setAucImage);

    app.route(rootUrl + '/auctions/:id/bids')
        .get(auctions.viewBids);

    app.route(rootUrl + '/auctions/:id/bids')
        .post(auctions.makeBid);
};