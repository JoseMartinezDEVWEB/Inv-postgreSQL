import React, { useState, useEffect } from 'react';
import { Upload, FileText, Key } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import { importarProductosDesdeArchivo } from '../../services/importService';
import { toast } from 'react-hot-toast';

const ImportModal = ({ isOpen, onClose, onImport }) => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: Upload, 2: Preview
    const [previewData, setPreviewData] = useState([]);
    const [apiKey, setApiKey] = useState('');
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        // Cargar API Key del localStorage si existe
        const savedKey = localStorage.getItem('gemini_api_key');
        if (savedKey) setApiKey(savedKey);
    }, []);

    const addLog = (msg) => setLogs(prev => [...prev, msg]);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleProcess = async () => {
        if (!file) {
            toast.error("Por favor selecciona un archivo");
            return;
        }

        setLoading(true);
        setLogs([]);
        addLog("Iniciando procesamiento...");

        try {
            const extension = file.name.split('.').pop().toLowerCase();
            
            if (!['xlsx', 'xls', 'pdf'].includes(extension)) {
                throw new Error("Formato no soportado. Use XLSX, XLS o PDF");
            }

            addLog("Enviando archivo al servidor...");
            addLog("El servidor procesará el archivo con Python e IA...");

            // Guardar API Key para futuros usos
            if (apiKey) localStorage.setItem('gemini_api_key', apiKey);

            // Usar el nuevo servicio que llama al backend Python
            const processedData = await importarProductosDesdeArchivo(file, apiKey);

            if (Array.isArray(processedData) && processedData.length > 0) {
                setPreviewData(processedData);
                setStep(2);
                addLog(`Se encontraron ${processedData.length} productos.`);
            } else {
                throw new Error("No se encontraron productos válidos en el archivo");
            }

        } catch (error) {
            console.error(error);
            const errorMessage = error.response?.data?.mensaje || error.message || "Error al procesar el archivo";
            toast.error(errorMessage);
            addLog(`Error: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmImport = async () => {
        try {
            // Los productos ya están en la base de datos, solo notificar
            onImport(previewData);
            onClose();
            // Reset states
            setStep(1);
            setFile(null);
            setPreviewData([]);
            setLogs([]);
        } catch (error) {
            console.error('Error al confirmar importación:', error);
            toast.error('Error al finalizar la importación');
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Importar Productos (Excel / PDF AI)"
            size="xl"
        >
            <div className="space-y-6">
                {step === 1 && (
                    <div className="space-y-4">
                        {/* Input de API Key */}
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <div className="flex items-start gap-3">
                                <Key className="w-5 h-5 text-blue-600 mt-1" />
                                <div className="flex-1">
                                    <h4 className="font-medium text-blue-900">Configuración de IA (Gemini)</h4>
                                    <p className="text-sm text-blue-700 mb-2">
                                        Para usar la inteligencia artificial gratuita de Google y leer tus archivos PDF o Excel desordenados, necesitas una API Key.
                                    </p>
                                    <div className="flex gap-2">
                                        <input
                                            type="password"
                                            placeholder="Pega tu API Key aquí (comienza con 'AIz...')"
                                            className="flex-1 text-sm border-blue-300 rounded px-3 py-1 focus:ring-blue-500 focus:border-blue-500"
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                        />
                                        <a
                                            href="https://aistudio.google.com/app/apikey"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs bg-white text-blue-600 px-3 py-1 rounded border border-blue-300 hover:bg-blue-50 flex items-center"
                                        >
                                            Obtener Key Gratis
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors">
                            <input
                                type="file"
                                accept=".xlsx, .xls, .pdf"
                                onChange={handleFileChange}
                                className="hidden"
                                id="file-upload"
                            />
                            <label htmlFor="file-upload" className="cursor-pointer block">
                                {file ? (
                                    <div className="flex items-center justify-center space-x-2 text-green-600">
                                        <FileText className="w-8 h-8" />
                                        <span className="font-medium text-lg">{file.name}</span>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Upload className="w-10 h-10 text-gray-400 mx-auto" />
                                        <p className="text-gray-600">Arrastra tu archivo aquí o haz clic para seleccionar</p>
                                        <p className="text-xs text-gray-400">Formatos: .xlsx, .xls, .pdf</p>
                                    </div>
                                )}
                            </label>
                        </div>

                        {loading && (
                            <div className="bg-gray-100 p-4 rounded-lg text-sm font-mono max-h-32 overflow-y-auto">
                                {logs.map((log, idx) => (
                                    <div key={idx} className="text-gray-700">&gt; {log}</div>
                                ))}
                                <div className="animate-pulse text-blue-600">&gt; Procesando...</div>
                            </div>
                        )}
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-lg text-gray-800">Vista Previa ({previewData.length} productos encontrados)</h4>
                            <button
                                onClick={() => setStep(1)}
                                className="text-sm text-gray-500 hover:text-gray-700 underline"
                            >
                                Volver a cargar
                            </button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto border rounded-lg">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Costo</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {previewData.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.nombre}</td>
                                            <td className="px-6 py-4 text-sm text-green-600 font-medium">${item.costoBase || 0}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500 font-mono">{item.codigoBarras || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-blue-600">{item.categoria}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                {step === 1 && (
                    <Button onClick={handleProcess} disabled={!file || !apiKey || loading}>
                        {loading ? 'Procesando...' : 'Analizar Archivo'}
                    </Button>
                )}
                {step === 2 && (
                    <Button onClick={handleConfirmImport}>
                        Importar Productos
                    </Button>
                )}
            </div>
        </Modal>
    );
};

export default ImportModal;














