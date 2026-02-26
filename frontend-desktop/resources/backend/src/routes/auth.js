import express from 'express'
import authController from '../controllers/authController.js'
import { validarJWT } from '../middlewares/auth.js'
import {
  validar,
  schemaLoginUsuario,
  schemaRegistroUsuario,
  schemaCambiarPassword,
} from '../middlewares/validation.js'

const router = express.Router()

// Rutas públicas
router.post('/login', validar(schemaLoginUsuario), authController.login)
router.post('/registro', validar(schemaRegistroUsuario), authController.registro)
router.post('/refresh', authController.refresh)

// Rutas protegidas
router.post('/logout', authController.logout)
router.get('/perfil', validarJWT, authController.obtenerPerfil)
router.put('/perfil', validarJWT, authController.actualizarPerfil)
router.put('/cambiar-password', validarJWT, validar(schemaCambiarPassword), authController.cambiarPassword)

export default router
