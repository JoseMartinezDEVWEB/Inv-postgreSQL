import express from 'express'
import usuariosController from '../controllers/usuariosController.js'
import { validarJWT, validarRol, validarSubordinado } from '../middlewares/auth.js'
import { validar, schemaRegistroUsuario } from '../middlewares/validation.js'

const router = express.Router()

router.use(validarJWT)
router.use(validarRol('contable', 'contador', 'administrador'))

router.get('/subordinados', usuariosController.obtenerSubordinados)
router.post('/', validar(schemaRegistroUsuario), usuariosController.crearUsuario)
router.get('/:id', usuariosController.obtenerUsuario)
router.put('/:id', validarSubordinado, usuariosController.actualizarUsuario)
router.patch('/:id/password', validarSubordinado, usuariosController.cambiarPasswordUsuario)
router.delete('/:id', validarSubordinado, usuariosController.desactivarUsuario)

export default router
