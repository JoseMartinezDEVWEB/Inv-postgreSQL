import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Barcode, Package } from 'lucide-react';
import { productosApi } from '../services/api';
import toast from 'react-hot-toast';

/**
 * SearchBarcodeModal
 * Modal especializado para buscar productos por código de barras.
 * Tema: Gray-600 (Gris oscuro)
 */
const SearchBarcodeModal = ({ 
  isOpen, 
  onClose, 
  onSelect 
}) => {
  const [barcodeQuery, setBarcodeQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  
  const searchInputRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setBarcodeQuery('');
      setSearchResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || barcodeQuery.length < 3) {
      setSearchResults([]);
      return;
    }

    const search = async () => {
      setIsSearching(true);
      try {
        const response = await productosApi.getAllGenerales({ 
          buscar: barcodeQuery, 
          limite: 50, 
          soloActivos: true 
        });
        
        const raw = response.data?.datos;
        const list = Array.isArray(raw) ? raw : (raw?.productos || []);
        
        const filtered = list.filter(p => 
          (p.codigoBarras || '').toLowerCase().includes(barcodeQuery.toLowerCase()) ||
          (p.sku || '').toLowerCase().includes(barcodeQuery.toLowerCase())
        );

        setSearchResults(filtered);
        setActiveIndex(0);
      } catch (error) {
        console.error('Error buscando por código:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const delay = setTimeout(search, 300);
    return () => clearTimeout(delay);
  }, [barcodeQuery, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter' && searchResults.length > 0) {
        e.preventDefault();
        onSelect(searchResults[activeIndex]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, searchResults, activeIndex, onSelect, onClose]);

  useEffect(() => {
    if (resultsRef.current) {
      const activeElement = resultsRef.current.children[activeIndex];
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  if (!isOpen) return null;

  const highlightMatch = (text, term) => {
    if (!text || !term || term.length < 2) return text;
    const parts = text.split(new RegExp(`(${term})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === term.toLowerCase() 
        ? <span key={i} className="bg-yellow-200 text-black font-bold px-0.5 rounded-sm">{part}</span> 
        : part
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[110] backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-4xl h-[70vh] overflow-hidden">
        <div className="bg-gray-600 p-4 flex items-center justify-between text-white">
          <div className="flex items-center space-x-3">
            <Barcode className="w-6 h-6" />
            <h3 className="text-xl font-bold uppercase tracking-tight">Búsqueda por Código de Barras</h3>
          </div>
          <button 
            onClick={onClose} 
            className="hover:bg-gray-500 p-2 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 bg-gray-50 border-b">
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              value={barcodeQuery}
              onChange={(e) => setBarcodeQuery(e.target.value)}
              placeholder="Ingrese el número del código de barras..."
              className="w-full pl-12 pr-4 py-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-gray-600 focus:ring-4 focus:ring-gray-100 text-2xl text-gray-800 transition-all font-mono"
              autoComplete="off"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6" />
            {isSearching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="w-6 h-6 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          <p className="mt-2 text-sm text-gray-500">Escriba al menos 3 dígitos para buscar coincidencias parciales.</p>
        </div>

        <div 
          ref={resultsRef}
          className="flex-1 overflow-y-auto divide-y divide-gray-100"
        >
          {searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-10 text-center">
              <Package className="w-20 h-20 opacity-10 mb-4" />
              <p className="text-xl font-medium">
                {barcodeQuery.length < 3 
                  ? 'Ingrese el código para buscar' 
                  : `No se encontraron productos con el código "${barcodeQuery}"`}
              </p>
            </div>
          ) : (
            searchResults.map((producto, index) => (
              <button
                key={producto.id || producto._id}
                onClick={() => onSelect(producto)}
                className={`w-full px-6 py-4 text-left transition-all flex items-center justify-between group ${
                  index === activeIndex ? 'bg-gray-600 text-white' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex-1">
                  <div className={`font-bold text-lg ${index === activeIndex ? 'text-white' : 'text-gray-800'}`}>
                    {producto.nombre}
                  </div>
                  <div className={`text-sm font-mono mt-1 ${index === activeIndex ? 'text-gray-200' : 'text-gray-500'}`}>
                    CÓDIGO: {highlightMatch(producto.codigoBarras || producto.sku || 'N/A', barcodeQuery)}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-black ${index === activeIndex ? 'text-white' : 'text-gray-700'}`}>
                    ${(producto.costo || producto.costoBase || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </div>
                  <div className={`text-xs uppercase font-bold opacity-70 ${index === activeIndex ? 'text-gray-200' : 'text-gray-400'}`}>
                    {producto.unidad || 'Unidad'}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="p-4 bg-gray-100 flex items-center justify-between">
          <div className="flex items-center space-x-4 text-xs text-gray-500 font-bold uppercase tracking-widest">
            <div className="flex items-center space-x-1">
              <span className="px-2 py-1 bg-white rounded border border-gray-300 shadow-sm">↑↓</span>
              <span>Navegar</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="px-2 py-1 bg-white rounded border border-gray-300 shadow-sm">ENTER</span>
              <span>Seleccionar</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md font-bold transition-all uppercase text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchBarcodeModal;
