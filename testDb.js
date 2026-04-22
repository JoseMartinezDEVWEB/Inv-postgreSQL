const db = require('./backend/models');
async function test() {
  try {
    const sesion = await db.SesionInventario.findOne({
      include: [
        { model: db.ProductoContado, as: 'productosContados' }
      ],
      order: [
        [{ model: db.ProductoContado, as: 'productosContados' }, 'updatedAt', 'DESC']
      ]
    });
    console.log('Sesion ID:', sesion ? sesion.id : 'None');
    console.log('Productos:', sesion && sesion.productosContados ? sesion.productosContados.length : 'N/A');
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit();
}
test();
