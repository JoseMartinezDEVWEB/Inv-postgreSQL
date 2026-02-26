import express from 'express'
import saludController from '../controllers/saludController.js'

const router = express.Router()

router.get('/', saludController.checkSalud)
router.get('/db', saludController.checkDB)
router.get('/sistema', saludController.getSystemInfo)

export default router
