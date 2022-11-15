import {Request, Response} from "express";
import Logger from '../../config/logger';
import * as user from '../models/user.model';
import crypto from "crypto";
import fs from 'mz/fs';
import bcrypt from "bcrypt";

const imageDirectory = './storage/images/';



const register = async (req: Request, res: Response):Promise<void> => {
    Logger.http(`POST create a user with a name: ${req.body.firstName}`)
    // Checks all fields are present.
    if (!(req.body.firstName && req.body.lastName && req.body.email && req.body.password)){
        res.status(400).send("Please provide all needed fields.");
        return
    }

    const firstIndex = req.body.email.indexOf('@'); // -1 if not found.
    if (firstIndex !== req.body.email.lastIndexOf('@')) {
        res.status(400).send("Please provide a valid email (Only one @ symbol allowed).");
        return;
    } else if (firstIndex <= 0 || firstIndex === (req.body.email.length - 1)) { // Either not found or at the start/end of the string.
        res.status(400).send("Please provide a valid email.");
        return;
    }

    const firstName = req.body.firstName;
    const lastName = req.body.lastName;
    const email = req.body.email;
    const password = req.body.password;
    try {
        const existingUser = await user.getOneEmail(email);
        if (existingUser.length !== 0) {
            res.status(400).send(`User with that email already exists.`);
            return;
        }
        const result = await user.insert(firstName, lastName, email, password);
        res.status(201).send({"userId": result.insertId} );
        return;
    } catch (err) {
        res.status(500).send(`ERROR creating user ${firstName}: ${err}`);
        return;
    }
};

const login = async (req: Request, res: Response):Promise<void> => {
    Logger.http(`POST login a user with a email: ${req.body.email}`)
    // Checks all fields are present.
    if (!(req.body.email && req.body.password)){
        res.status(400).send("Please provide all needed fields.");
        return
    }

    const firstIndex = req.body.email.indexOf('@'); // -1 if not found.
    if (firstIndex !== req.body.email.lastIndexOf('@')) {
        res.status(400).send("Please provide a valid email (Only one @ symbol allowed).");
        return;
    } else if (firstIndex <= 0 || firstIndex === (req.body.email.length - 1)) { // Either not found or at the start/end of the string.
        res.status(400).send("Please provide a valid email.");
        return;
    }

    const email = req.body.email;
    const password = req.body.password;
    const token = crypto.randomBytes(64).toString('hex');
    try {
        const passRes = await user.getOneEmail(email);
        if(!(await bcrypt.compare(password, passRes[0].password))) {
            res.status(400).send("No User with that password and/or email.");
            return;
        }
        const result = await user.setAuth(email, token);
        if (result.length === 0) {
            res.status(400).send("No User with that password and/or email.");
            return;
        } else {
            res.status(200).send({"userId": result[0].userId, "token": token});
            return;
        }

    } catch(err) {
        res.status(500).send(`ERROR login user ${email}: ${err}`);
        return;
    }
};

const logout = async (req: Request, res: Response):Promise<void> => {
    Logger.http(`POST logout a user with token: ${req.header("X-Authorization")}`)

    if (!req.header("X-Authorization")) {
        res.status(401).send(`Please ensure token is given.`);
        return;
    }
    const token = req.header("X-Authorization");

    try {
        const result = await user.removeAuth(token);
        if( result.affectedRows === 0 ){
            res.status(401).send(`User is not authorized`);
            return;
        } else {
            res.status( 200).send( `Removed token ${token} from user` );
            return;
        }
    } catch(err) {
        res.status(500).send(`ERROR logout with token ${token}: ${err}`);
        return;
    }
};

const findId = async (req: Request, res: Response):Promise<void> => {
    Logger.http(`GET user details for: ${req.params.id}`)
    if ((req.params.id.replace(/\s/g, "") === "") || isNaN(Number(req.params.id)) || ((Number(req.params.id) % 1) !== 0)) {
        res.status(404).send(`User can not be found.`);
        return;
    }
    const id = req.params.id;

    const token = req.header("X-Authorization"); // Check if user auth.

    try {
        const result = await user.getOne(parseInt(id, 10));
        if(result.length === 0) {
            res.status(404).send(`User can not be found.`);
            return;
        }
        const foundToken = result[0].auth_token;
        delete result[0].auth_token;
        delete result[0].password;
        if ((token !== null) && (foundToken === token)) {
            res.status( 200 ).send(result[0]);
            return;
        } else { // Defaults to this if no token is provided.
            delete result[0].email;
            res.status( 200 ).send(result[0]);
            return;
        }
    } catch(err) {
        res.status(500).send(`ERROR getting user ${id}: ${err}`);
        return;
    }
};

const updateId = async (req: Request, res: Response):Promise<void> => {
    Logger.http(`PATCH update user details for: ${req.params.id}`)

    if ((req.params.id.replace(/\s/g, "") === "") || isNaN(Number(req.params.id)) || ((Number(req.params.id) % 1) !== 0)) {
        res.status(404).send(`User can not be found.`);
        return;
    }
    const id = req.params.id;

    if (!req.header("X-Authorization")) {
        res.status(401).send("Please ensure token is given.");
        return;
    }
    const token = req.header("X-Authorization"); // Check if user auth.

    try {
        const dataResult = await user.getOne(parseInt(id, 10)); // Gets a user to be updated.
        if (dataResult.length === 0) {
            res.status(404).send("User not found with that id.");
            return;
        } else if ((!dataResult[0].auth_token) || (dataResult[0].auth_token !== token)) {
            res.status(403).send("Invalid token used.");
            return;
        }

        if (req.body.hasOwnProperty("email")) {
            const firstIndex = req.body.email.indexOf('@');
            if (firstIndex !== req.body.email.lastIndexOf('@')) {
                res.status(400).send("Please provide a valid email (Only one @ symbol allowed).");
                return;
            } else if (firstIndex <= 0 || firstIndex === (req.body.email.length - 1)) { // Either not found or at the start/end of the string.
                res.status(400).send("Please provide a valid email.");
                return;
            }
            dataResult[0].email = req.body.email;
        }

        if (req.body.hasOwnProperty("password")) {
            if (!req.body.hasOwnProperty("currentPassword")) {
                res.status(400).send("Please provide a the current password.");
                return;
            }
            if (await bcrypt.compare(req.body.currentPassword, dataResult[0].password)) {
                const saltRounds = 10;
                const salt = await bcrypt.genSalt(saltRounds);
                dataResult[0].password = await bcrypt.hash(req.body.currentPassword, salt);
            } else {
                res.status(400).send("Please provide a correct current password.");
                return;
            }
        }

        if (req.body.hasOwnProperty("firstName")) {
            dataResult[0].firstName = req.body.firstName;
        }
        if (req.body.hasOwnProperty("lastName")) {
            dataResult[0].lastName = req.body.lastName;
        }
        await user.alter(dataResult[0], parseInt(id, 10));
        res.status(200).send( `User ${id} data updated.` );
        return;
    } catch(err) {
        res.status(500).send(`ERROR login user : ${err}`);
        return;
    }
};

const getImage = async (req: Request, res: Response):Promise<void> => {
    Logger.http(`GET find user photo for: ${req.params.id}`)

    if ((req.params.id.replace(/\s/g, "") === "") || isNaN(Number(req.params.id)) || ((Number(req.params.id) % 1) !== 0)) {
        res.status(404).send(`User can not be found.`);
        return;
    }
    const id = req.params.id;

    try {
        const result = await user.getOnePhoto(parseInt(id, 10));
        if((result.length === 0) || (result[0].imageFilename === null)) {
            res.status(404).send(`User photo can not be found.`);
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
        res.status(500).send(`ERROR getting user ${id}: ${err}`);
        return;
    }
};

const setImage = async (req: Request, res: Response):Promise<void> => {
    Logger.http(`PUT a user photo for: ${req.params.id}`)

    if ((req.params.id.replace(/\s/g, "") === "") || isNaN(Number(req.params.id)) || ((Number(req.params.id) % 1) !== 0)) {
        res.status(404).send(`User can not be found.`);
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
        const dataResult = await user.getOne(parseInt(id, 10)); // Gets a user to be updated.
        if (dataResult.length === 0) {
            res.status(404).send("User not found with that id.");
            return;
        } else if ((!dataResult[0].auth_token) || (dataResult[0].auth_token !== token)) {
            res.status(403).send("Invalid token used.");
            return;
        }

        const currImage = await user.getOnePhoto(parseInt(id, 10));
        await user.setPhoto(parseInt(id, 10), ext);
        await fs.writeFileSync(`${imageDirectory}user_${id}.${ext}`, data); // create/replace image in local
        if (currImage[0].imageFilename !== null) {
            res.status(200).send(`Image updated for user ${id}`);
            return;
        } else {
            res.status(201).send(`Image created for user ${id}`);
            return;
        }

    } catch(err) {
        res.status(500).send(`ERROR getting user ${id}: ${err}`);
        return;
    }
};

const deleteImage = async (req: Request, res: Response):Promise<void> => {
    Logger.http(`DELETE a user photo for: ${req.params.id}`)

    if ((req.params.id.replace(/\s/g, "") === "") || isNaN(Number(req.params.id)) || ((Number(req.params.id) % 1) !== 0)) {
        res.status(404).send(`User can not be found.`);
        return;
    }
    const id = req.params.id;

    if (!req.header("X-Authorization")) {
        res.status(401).send("Please ensure token is given.");
        return;
    }
    const token = req.header("X-Authorization");

    try {
        const dataResult = await user.getOne(parseInt(id, 10)); // Gets a user to be updated.
        if (dataResult.length === 0) {
            res.status(404).send("User not found with that id.");
            return;
        } else if ((!dataResult[0].auth_token) || (dataResult[0].auth_token !== token)) {
            res.status(403).send("Invalid token used.");
            return;
        }

        const currImage = await user.getOnePhoto(parseInt(id, 10));
        await  user.deletePhoto(parseInt(id, 10), token);
        if (await fs.exists(`${imageDirectory}${currImage[0].imageFilename}`)) {
            await fs.unlink(`${imageDirectory}${currImage[0].imageFilename}`); // create/replace image in local
        }
        res.status(200).send(`Image deleted for user ${id}`);
    } catch(err) {
        res.status(500).send(`ERROR getting user ${id}: ${err}`);
        return;
    }
};

export {register, login, logout, findId, updateId, getImage, setImage, deleteImage}