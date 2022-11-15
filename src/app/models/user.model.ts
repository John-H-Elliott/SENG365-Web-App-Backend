import {getPool} from "../../config/db";
import Logger from "../../config/logger";
import bcrypt from "bcrypt";



const insert = async(firstName: string, lastName: string, email: string, password: string) : Promise<any> => {
    Logger.info(`Adding user ${firstName} to the database`);
    const conn = await getPool().getConnection();
    const query = 'insert into user (email, first_name, last_name, password) values ( ?, ?, ?, ?)';

    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    password = await bcrypt.hash(password, salt);
    const [ result ] = await conn.query( query, [ email, firstName, lastName, password ] );

    conn.release();
    return result;
}


const setAuth = async(email: string, token: string) : Promise<UserId[]> => {
    Logger.info(`Finding user ${email} in the database and setting a auth token.`);
    const conn = await getPool().getConnection();

    const query = 'update user set auth_token = ? where email = ?';
    const [ ignore ] = await conn.query( query, [ token, email ] );

    const idQuery = 'select id as userId from user where email = ?';
    const [ idResult ] = await conn.query(idQuery, [ email ] );
    conn.release();
    return idResult;
}

const removeAuth = async(token: string) : Promise<any> => {
    Logger.info(`Finding user with token: ${token} and removing it.`);
    const conn = await getPool().getConnection();

    const query = "update user set auth_token = NULL where auth_token = ?";
    const [ result ] = await conn.query( query, [ token ] );

    conn.release();
    return result;
}

const getOne = async(id: number) : Promise<User[]> => {
    Logger.info(`Finding user with id: ${id}.`);
    const conn = await getPool().getConnection();

    const query = "select first_name as firstName, last_name as lastName, password, email, auth_token from user where id = ?";
    const [ result ] = await conn.query( query, [ id ] );

    conn.release();
    return result;
}

const getOneEmail = async(email: string) : Promise<User[]> => {
    Logger.info(`Finding user with email: ${email}.`);
    const conn = await getPool().getConnection();

    const query = "select first_name as firstName, last_name as lastName, password, email, auth_token from user where email = ?";
    const [ result ] = await conn.query( query, [ email ] );

    conn.release();
    return result;
}

const alter = async(data: User, id: number) : Promise<any> => {
    Logger.info(`Updating a user with id: ${id}.`);
    const conn = await getPool().getConnection();

    const query = "update user set first_name = ?, last_name = ?, email = ?, password = ? where id = ?";
    const [ result ] = await conn.query( query, [ data.firstName, data.lastName, data.email, data.password, id ] );

    conn.release();
    return result;
}


const getOnePhoto = async(id: number) : Promise<UserPhoto[]> => {
    Logger.info(`Finding user photo with id: ${id}.`);
    const conn = await getPool().getConnection();

    const query = "select image_filename as imageFilename from user where id = ?";
    const [ result ] = await conn.query( query, [ id ] );

    conn.release();
    return result;
}

const setPhoto = async (id: number, ext: string) :Promise<any> => {
    Logger.info(`Updating a user photo with id: ${id}.`);
    const conn = await getPool().getConnection();

    const query = "update user set image_filename = ? where id = ?";
    const [ result ] = await conn.query( query, [ `user_${id}.${ext}`, id ] );
    return result;
}

const deletePhoto = async (id: number, token: string) :Promise<any> => {
    Logger.info(`Deleting a user photo with id: ${id}.`);
    const conn = await getPool().getConnection();
    const query = "update user set image_filename = null where id = ? and auth_token = ?";
    const [ result ] = await conn.query( query, [ id, token] );
    return result;
}

const getAuth = async (token: string) :Promise<UserId[]> => {
    Logger.info(`Finding any users with token: ${token}.`);
    const conn = await getPool().getConnection();
    const query = "select id as userId from user where auth_token = ?";
    const [ result ] = await conn.query( query, [token] );
    return result;
}


export{insert, setAuth, removeAuth, getOne, alter, getOnePhoto, setPhoto, deletePhoto, getOneEmail, getAuth}