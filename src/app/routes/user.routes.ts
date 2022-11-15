import {Express} from "express";
import {rootUrl} from "./base.routes"

import * as user from '../controllers/user.controller';

module.exports = (app: Express) => {
    app.route(rootUrl + '/users/register')
        .post(user.register);

    app.route(rootUrl + '/users/login')
        .post(user.login);

    app.route(rootUrl + '/users/logout')
        .post(user.logout);

    app.route(rootUrl + '/users/:id')
        .get(user.findId);

    app.route(rootUrl + '/users/:id')
        .patch(user.updateId);

    app.route(rootUrl + '/users/:id/image')
        .get(user.getImage);

    app.route(rootUrl + '/users/:id/image')
        .put(user.setImage);

    app.route(rootUrl + '/users/:id/image')
        .delete(user.deleteImage);
};