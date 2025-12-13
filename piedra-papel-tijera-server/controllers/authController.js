import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/GameUser.js';

export const register = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ msg: 'Faltan campos obligatorios' });
        }

        const existeUsuario = await User.findOne({ where: { username } });
        if (existeUsuario) {
            return res.status(400).json({ msg: 'El nombre de usuario ya está en uso' });
        }

        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(password, salt);

        const nuevoUsuario = await User.create({
            username,
            password: hashedPassword
        });

        res.status(201).json({
            msg: 'Usuario creado exitosamente',
            uid: nuevoUsuario.id,
            username: nuevoUsuario.username
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: 'Error en el servidor' });
    }
};

export const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        const usuario = await User.findOne({ where: { username } });
        if (!usuario) {
            return res.status(400).json({ msg: 'Usuario o contraseña incorrectos' });
        }

        const validPassword = bcrypt.compareSync(password, usuario.password);
        if (!validPassword) {
            return res.status(400).json({ msg: 'Usuario o contraseña incorrectos' });
        }

        const token = jwt.sign(
            { uid: usuario.id, username: usuario.username }, 
            process.env.JWT_SECRET || 'token_jugar', 
            { expiresIn: '5h' }
        );

        res.json({
            msg: 'Login correcto',
            token,
            uid: usuario.id,
            username: usuario.username
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: 'Error en el servidor' });
    }
};