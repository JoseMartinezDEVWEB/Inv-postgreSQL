import React, { useState, useEffect } from 'react';
import { Upload, FileText, Check, AlertCircle, Loader, Key, CheckCircle, Info } from 'lucide-react';
import Modal, { ModalBody, ModalFooter } from './Modal';
import Button from './Button';
import { importarProductosDesdeArchivo } from '../../services/importService';
import { toast } from 'react-hot-toast';

const ImportModal = ({ isOpen, onClose, onImport }) => {
    const [file, setFile]           = useState(null);
    const [loading, setLoading]     = useState(false);
    const [step, setStep]           = useState(1);
    const [previewData, setPreviewData] = useState([]);
    const [resultado, setResultado] = useState(null);
    const [apiKey, setApiKey]       = useState('');
    const [logs, setLogs]           = useState([]);

    useEffect(() => {
        const savedKey = localStorage.getItem('gemini_api_key');
        if (savedKey) setApiKey(savedKey);
    }, []);

    useEffect(() => {
        if (!isOpen) {
            setStep(1);
            setFile(null);
            setPreviewData([]);
            setResultado(null);
            setLogs([]);
        }
    }, [isOpen]);

    const isPDF = file && file.name.toLowerCase().endsWith('.pdf');

    const addLog = (msg) => setLogs(prev => [...prev, msg]);

    const handleFileChange = (e) => {
        if (e.target.files?.[0]) {
            setFile(e.target.files[0]);
            setLogs([]);
        }
    };

    const handleProcess = async () => {
        if (!file) { toast.error('Por favor selecciona un archivo'); return; }

        setLoading(true);
        setLogs([]);
        addLog('Iniciando procesamiento...');

        try {
            const extension = file.name.split('.').pop().toLowerCase();
            if (!['xlsx', 'xls', 'pdf'].includes(extension)) {
                throw new Error('Formato no soportado. Use XLSX, XLS o PDF');
            }

            addLog('Enviando archivo al servidor...');
            if (isPDF) addLog('PDF detectado: extrayendo texto y buscando productos...');
            else        addLog('Excel detectado: leyendo columnas de productos...');

            if (apiKey) localStorage.setItem('gemini_api_key', apiKey);

            const res = await importarProductosDesdeArchivo(file, apiKey || null);

            // res puede ser array (legado) o { productos, totalCreados, ... }
            const productos  = Array.isArray(res) ? res : (res?.productos || []);
            const resTotal   = Array.isArray(res) ? null : res;

            if (productos.length === 0 && !resTotal?.totalCreados) {
                throw new Error('No se encontraron productos válidos en el archivo');
            }

            setPreviewData(productos);
            setResultado(resTotal);
            setStep(2);
            const total = resTotal?.totalProcesados ?? productos.length;
            addLog(`✅ ${total} productos procesados correctamente.`);
            toast.success(
                resTotal
                  ? `${resTotal.totalCreados} creados, ${resTotal.totalActualizados} actualizados`
                  : `${productos.length} productos importados`
            );

        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.mensaje || error.message || 'Error al procesar el archivo';
            toast.error(msg);
            addLog(`❌ Error: ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmImport = () => {
        onImport(previewData);
        onClose();
    };

    // La importación ya ocurrió en el servidor; el botón solo cierra
    const canProcess = !!file && (!isPDF || true); // Excel siempre, PDF con o sin API key

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Importar Productos (Excel / PDF)" size="xl">
            <ModalBody className="space-y-5">

                {step === 1 && (
                    <div className="space-y-4">

                        {/* Info general */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
                            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-blue-800">
                                <p className="font-semibold mb-1">Importación de productos al catálogo general</p>
                                <ul className="list-disc list-inside space-y-0.5 text-blue-700 text-xs">
                                    <li><strong>Excel (.xlsx / .xls)</strong>: columnas Nombre/Artículo, Costo/Precio, Código/SKU — no requiere configuración adicional.</li>
                                    <li><strong>PDF</strong>: se extrae texto automáticamente (sin IA).</li>
                                </ul>
                            </div>
                        </div>

                        {/* API Key — solo relevante para PDF */}
                        {isPDF && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                <div className="flex items-start gap-2">
                                    <Key className="w-4 h-4 text-yellow-600 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-yellow-900 mb-1">API Key de Gemini (opcional para PDFs complejos)</p>
                                        <div className="flex gap-2">
                                            <input
                                                type="password"
                                                placeholder="AIz... (opcional)"
                                                className="flex-1 text-sm border border-yellow-300 rounded px-2 py-1 focus:ring-yellow-400 focus:border-yellow-400"
                                                value={apiKey}
                                                onChange={(e) => setApiKey(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Drop zone */}
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer">
                            <input
                                type="file"
                                accept=".xlsx,.xls,.pdf"
                                onChange={handleFileChange}
                                className="hidden"
                                id="file-upload"
                            />
                            <label htmlFor="file-upload" className="cursor-pointer block">
                                {file ? (
                                    <div className="flex items-center justify-center gap-2 text-green-600">
                                        <FileText className="w-8 h-8" />
                                        <span className="font-medium text-lg">{file.name}</span>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Upload className="w-10 h-10 text-gray-400 mx-auto" />
                                        <p className="text-gray-600">Arrastra tu archivo aquí o haz clic para seleccionar</p>
                                        <p className="text-xs text-gray-400">Formatos: .xlsx, .xls, .pdf · Máx. 10 MB</p>
                                    </div>
                                )}
                            </label>
                        </div>

                        {/* Logs */}
                        {(loading || logs.length > 0) && (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono max-h-28 overflow-y-auto">
                                {logs.map((log, idx) => (
                                    <div key={idx} className="text-gray-700">&gt; {log}</div>
                                ))}
                                {loading && <div className="animate-pulse text-blue-500">&gt; Procesando...</div>}
                            </div>
                        )}
                    </div>
                )}

                {step === 2 && resultado && (
                    <div className="space-y-4">
                        {/* Resumen */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold text-green-700">{resultado.totalCreados?.toLocaleString()}</p>
                                <p className="text-xs text-green-600 mt-0.5">Nuevos creados</p>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold text-blue-700">{resultado.totalActualizados?.toLocaleString()}</p>
                                <p className="text-xs text-blue-600 mt-0.5">Actualizados</p>
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold text-gray-700">{resultado.totalProcesados?.toLocaleString()}</p>
                                <p className="text-xs text-gray-500 mt-0.5">Total procesados</p>
                            </div>
                        </div>

                        {/* Preview de muestra */}
                        {previewData.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="text-sm font-semibold text-gray-700">
                                        Vista previa ({previewData.length} de {resultado.totalProcesados?.toLocaleString()} productos)
                                    </h4>
                                    <button onClick={() => setStep(1)} className="text-xs text-gray-400 hover:text-gray-600 underline">
                                        Importar otro archivo
                                    </button>
                                </div>
                                <div className="max-h-[40vh] overflow-y-auto border border-gray-200 rounded-lg">
                                    <table className="min-w-full divide-y divide-gray-100 text-sm">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase font-medium">Nombre</th>
                                                <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase font-medium">Costo</th>
                                                <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase font-medium">Código</th>
                                                <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase font-medium">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-100">
                                            {previewData.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="px-3 py-2 font-medium text-gray-900 truncate max-w-[200px]">{item.nombre}</td>
                                                    <td className="px-3 py-2 text-green-700">${(item.costoBase || 0).toFixed(2)}</td>
                                                    <td className="px-3 py-2 text-gray-500 font-mono text-xs">{item.codigoBarras || '—'}</td>
                                                    <td className="px-3 py-2">
                                                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                                            item.accion === 'actualizado'
                                                              ? 'bg-blue-100 text-blue-700'
                                                              : 'bg-green-100 text-green-700'
                                                        }`}>
                                                            {item.accion === 'actualizado' ? 'actualizado' : 'nuevo'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {resultado.totalProcesados > previewData.length && (
                                    <p className="text-xs text-gray-400 mt-1 text-center">
                                        Mostrando {previewData.length} de {resultado.totalProcesados?.toLocaleString()} — todos fueron importados al catálogo.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Productos desde array legado (sin resultado) */}
                        {!resultado && previewData.length > 0 && (
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-1">{previewData.length} productos importados</h4>
                                <div className="max-h-[40vh] overflow-y-auto border border-gray-200 rounded-lg">
                                    <table className="min-w-full divide-y divide-gray-100 text-sm">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase font-medium">Nombre</th>
                                                <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase font-medium">Costo</th>
                                                <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase font-medium">Código</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-100">
                                            {previewData.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="px-3 py-2 font-medium text-gray-900">{item.nombre}</td>
                                                    <td className="px-3 py-2 text-green-700">${item.costoBase || 0}</td>
                                                    <td className="px-3 py-2 text-gray-500 font-mono text-xs">{item.codigoBarras || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </ModalBody>

            <ModalFooter>
                <Button variant="outline" onClick={onClose} disabled={loading}>
                    {step === 2 ? 'Cerrar' : 'Cancelar'}
                </Button>
                {step === 1 && (
                    <Button onClick={handleProcess} isLoading={loading} disabled={!file || loading}>
                        {loading ? 'Procesando...' : 'Analizar e Importar'}
                    </Button>
                )}
                {step === 2 && (
                    <Button variant="primary" onClick={handleConfirmImport}>
                        ✓ Listo
                    </Button>
                )}
            </ModalFooter>
        </Modal>
    );
};

export default ImportModal;
